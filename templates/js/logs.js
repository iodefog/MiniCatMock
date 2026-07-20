// ─── 实时日志终端渲染 ───
function renderTerminalLogs() {
    const container = document.getElementById('terminal-log-output');
    if (!container) return;

    if (!window.allCapturedLogs || window.allCapturedLogs.length === 0) {
        container.innerHTML = `<div class="terminal-empty">⏳ 暂无网络流量数据，请在设备上发送请求...</div>`;
        return;
    }

    const logs = [...window.allCapturedLogs].reverse(); // 最旧的在最上面，最新的在最下面
    let html = '';
    logs.forEach(log => {
        let tag = '';
        let tagClass = '';
        if (log.loading) {
            tag = '[PENDING]';
            tagClass = 'term-pending';
        } else if (log.mock_matched) {
            tag = '[MOCK 🎯]';
            tagClass = 'term-mock';
        } else {
            tag = '[PROXY ⚡]';
            tagClass = 'term-proxy';
        }

        const method = log.method || 'GET';
        const methodClass = `term-method-${method.toLowerCase()}`;
        const statusText = log.loading ? '...' : (log.status || '透传');
        let statusClass = 'term-status-ok';
        if (!log.loading) {
            if (log.status >= 400) {
                statusClass = 'term-status-err';
            } else if (log.status >= 300) {
                statusClass = 'term-status-warn';
            }
        }

        const durationText = log.loading ? '' : `(${log.duration_ms || 0}ms)`;

        html += `<div class="terminal-line">
            <span class="term-time">${log.time || ''}</span>
            <span class="term-tag ${tagClass}">${tag.padEnd(9)}</span>
            <span class="term-method ${methodClass}">${method.padEnd(6)}</span>
            <span class="term-path">${log.path || ''}</span>
            <span class="term-arrow">➔</span>
            <span class="term-status ${statusClass}">${statusText}</span>
            <span class="term-duration">${durationText}</span>
        </div>`;
    });
    container.innerHTML = html;
    
    // 自动滚动到终端底部
    container.scrollTop = container.scrollHeight;
}

// ─── 实时流量统计面板渲染 ───
function renderAnalyticsData() {
    const container = document.getElementById('analytics-layout');
    if (!container) return;

    const localCount = window.allCapturedLogs.length;
    const localMockHits = window.allCapturedLogs.filter(log => log.mock_matched).length;
    
    // 如果后端提供了完整的 session 统计，就用后端的，防止本地超过 200 条被截断
    const realTotal = (window.sessionTotal !== undefined && window.sessionTotal > localCount) ? window.sessionTotal : localCount;
    const realMockHits = (window.sessionMocked !== undefined && window.sessionMocked > localMockHits) ? window.sessionMocked : localMockHits;
    
    const hitRate = realTotal > 0 ? Math.round((realMockHits / realTotal) * 100) : 0;

    // 已命中 Mock 累计次数的更新挪到了 loadTelemetryStats 中，这里不再覆盖，以免冲突
    // 但如果由于网络原因还没拉到数据，这里可以先用本地的显示一下
    const statsTotalMocked = document.getElementById('stats-total-mocked');
    if (statsTotalMocked && window.sessionMocked === undefined) {
        statsTotalMocked.innerText = localMockHits + ' 次';
    }

    // 计算平均延迟
    const completedLogs = window.allCapturedLogs.filter(log => !log.loading && log.duration_ms !== undefined && log.duration_ms !== null);
    const avgDelay = completedLogs.length > 0
        ? Math.round(completedLogs.reduce((acc, log) => acc + log.duration_ms, 0) / completedLogs.length)
        : 0;

    // 计算总数据流量
    const totalBytes = window.allCapturedLogs.reduce((acc, log) => {
        return acc + (log.req_size || 0) + (log.resp_size || 0);
    }, 0);
    
    function formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // 同步更新 DOM 统计指标
    document.getElementById('metric-total').innerText = realTotal;
    document.getElementById('metric-mock-hits').innerText = realMockHits;
    document.getElementById('metric-hit-rate').innerText = hitRate + '%';
    document.getElementById('metric-avg-delay').innerText = avgDelay + 'ms';
    const dataSizeEl = document.getElementById('metric-data-size');
    if (dataSizeEl) dataSizeEl.innerText = formatBytes(totalBytes);

    // 计算请求方法占比
    const methodCounts = {};
    window.allCapturedLogs.forEach(log => {
        const method = log.method || 'GET';
        methodCounts[method] = (methodCounts[method] || 0) + 1;
    });

    let methodsHtml = '';
    const sortedMethods = Object.entries(methodCounts).sort((a, b) => b[1] - a[1]);
    sortedMethods.forEach(([method, count]) => {
        const pct = localCount > 0 ? Math.round((count / localCount) * 100) : 0;
        methodsHtml += `
            <div class="chart-bar-row">
                <span class="bar-label method-badge ${method.toLowerCase()}">${method}</span>
                <div class="bar-wrapper">
                    <div class="bar-fill" style="width: ${pct}%; background-color: var(--term-method-${method.toLowerCase()}, var(--accent));"></div>
                </div>
                <span class="bar-value">${count} 次 (${pct}%)</span>
            </div>
        `;
    });
    if (methodsHtml === '') {
        methodsHtml = '<div class="terminal-empty" style="color: var(--text-dim);">📊 暂无方法分布数据</div>';
    }
    document.getElementById('chart-methods-container').innerHTML = methodsHtml;

    // 计算命中最高峰的 mock 规则
    const ruleHits = {};
    window.allCapturedLogs.forEach(log => {
        if (log.mock_matched && log.mock_rule_name) {
            ruleHits[log.mock_rule_name] = (ruleHits[log.mock_rule_name] || 0) + 1;
        }
    });

    let rulesHtml = '';
    const sortedRules = Object.entries(ruleHits).sort((a, b) => b[1] - a[1]).slice(0, 5);
    sortedRules.forEach(([ruleName, count]) => {
        rulesHtml += `
            <div class="popular-rule-item">
                <div class="rule-item-info">
                    <span class="rule-bullet">🎯</span>
                    <span class="rule-name-text">${ruleName}</span>
                </div>
                <span class="rule-hit-badge">${count} 次击中</span>
            </div>
        `;
    });
    if (rulesHtml === '') {
        rulesHtml = '<div class="terminal-empty" style="color: var(--text-dim);">🎯 暂无 Mock 命中纪录</div>';
    }
    document.getElementById('popular-rules-container').innerHTML = rulesHtml;
}

// ─── 二维码生成 ───
let tunnelPollInterval = null;

async function initQrCode() {
    try {
        const res = await fetch('/api/server-info');
        const info = await res.json();

        document.querySelectorAll('.mac-ip-code').forEach(el => el.innerText = info.ip);

        document.getElementById('mock-url-text').innerText = info.mock_url;
        document.getElementById('qrcode-loading').style.display = 'none';

        if (info.os_name === 'nt') {
            document.getElementById('win-firewall-warning').style.display = 'block';
        }

        const qrEl = document.getElementById('qrcode');
        qrEl.style.display = 'inline-block';
        qrEl.innerHTML = '';

        new QRCode(qrEl, {
            text: info.mock_url,
            width: 148,
            height: 148,
            correctLevel: QRCode.CorrectLevel.H
        });

        // 根据后端配置初始化 UI 连接模式
        if (info.localtunnel_active) {
            const tunnelRadio = document.querySelector('input[name="connection-mode"][value="tunnel"]');
            if (tunnelRadio) tunnelRadio.checked = true;

            const lanLabel = document.getElementById('mode-lan-label');
            const tunnelLabel = document.getElementById('mode-tunnel-label');
            if (tunnelLabel && lanLabel) {
                tunnelLabel.classList.add('active');
                lanLabel.classList.remove('active');
            }

            document.getElementById('tunnel-status-container').style.display = 'block';
            document.getElementById('tunnel-security-warning').style.display = 'block';

            if (info.localtunnel_url) {
                updateTunnelStatusUI('active', info.localtunnel_url);
            } else if (info.localtunnel_error) {
                updateTunnelStatusUI('failed', null, info.localtunnel_error);
            } else {
                updateTunnelStatusUI('connecting');
                if (tunnelPollInterval) clearInterval(tunnelPollInterval);
                tunnelPollInterval = setInterval(pollTunnelStatus, 1500);
            }
        } else {
            const lanRadio = document.querySelector('input[name="connection-mode"][value="lan"]');
            if (lanRadio) lanRadio.checked = true;

            const lanLabel = document.getElementById('mode-lan-label');
            const tunnelLabel = document.getElementById('mode-tunnel-label');
            if (tunnelLabel && lanLabel) {
                lanLabel.classList.add('active');
                tunnelLabel.classList.remove('active');
            }
            
            document.getElementById('tunnel-status-container').style.display = 'none';
            document.getElementById('tunnel-security-warning').style.display = 'none';
        }
    } catch (err) {
        document.getElementById('qrcode-loading').innerText = '⚠️ 获取 IP 失败，请确认服务已启动';
    }
}

async function onConnectionModeChange(mode) {
    const lanLabel = document.getElementById('mode-lan-label');
    const tunnelLabel = document.getElementById('mode-tunnel-label');
    
    if (mode === 'lan') {
        if (lanLabel && tunnelLabel) {
            lanLabel.classList.add('active');
            tunnelLabel.classList.remove('active');
        }
        
        document.getElementById('tunnel-status-container').style.display = 'none';
        document.getElementById('tunnel-security-warning').style.display = 'none';
        if (tunnelPollInterval) {
            clearInterval(tunnelPollInterval);
            tunnelPollInterval = null;
        }
        
        await setTunnelEnabledOnServer(false);
        initQrCode();
    } else {
        if (lanLabel && tunnelLabel) {
            tunnelLabel.classList.add('active');
            lanLabel.classList.remove('active');
        }
        
        document.getElementById('tunnel-status-container').style.display = 'block';
        document.getElementById('tunnel-security-warning').style.display = 'block';
        updateTunnelStatusUI('connecting');
        
        await setTunnelEnabledOnServer(true);
        
        if (tunnelPollInterval) clearInterval(tunnelPollInterval);
        tunnelPollInterval = setInterval(pollTunnelStatus, 1500);
        pollTunnelStatus(); // 立即执行一次轮询
    }
}

async function setTunnelEnabledOnServer(enabled) {
    try {
        await fetch('/api/localtunnel/toggle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enabled: enabled })
        });
    } catch (e) {
        console.error('Failed to toggle localtunnel on server:', e);
    }
}

async function pollTunnelStatus() {
    try {
        const res = await fetch('/api/server-info');
        if (!res.ok) return;
        const info = await res.json();
        
        const currentMode = document.querySelector('input[name="connection-mode"]:checked')?.value;
        if (currentMode !== 'tunnel') {
            if (tunnelPollInterval) {
                clearInterval(tunnelPollInterval);
                tunnelPollInterval = null;
            }
            return;
        }
        
        if (info.localtunnel_url) {
            if (tunnelPollInterval) {
                clearInterval(tunnelPollInterval);
                tunnelPollInterval = null;
            }
            updateTunnelStatusUI('active', info.localtunnel_url);
            
            document.getElementById('mock-url-text').innerText = info.mock_url;
            const qrEl = document.getElementById('qrcode');
            qrEl.style.display = 'inline-block';
            qrEl.innerHTML = '';
            new QRCode(qrEl, {
                text: info.mock_url,
                width: 148,
                height: 148,
                correctLevel: QRCode.CorrectLevel.H
            });
        } else if (info.localtunnel_error) {
            if (tunnelPollInterval) {
                clearInterval(tunnelPollInterval);
                tunnelPollInterval = null;
            }
            updateTunnelStatusUI('failed', null, info.localtunnel_error);
        } else {
            updateTunnelStatusUI('connecting');
        }
    } catch (e) {
        console.error('Error polling tunnel status:', e);
    }
}

let lastTunnelUrl = '';

function updateTunnelStatusUI(status, url = '', error = '') {
    const badge = document.getElementById('tunnel-status-badge');
    const copyBtn = document.getElementById('tunnel-url-copy-btn');
    const isEn = window.location.pathname.includes('/en');
    
    if (!badge || !copyBtn) return;
    
    if (status === 'connecting') {
        badge.innerText = isEn ? '⏳ Initializing cross-network tunnel...' : '⏳ 正在初始化跨网通道...';
        badge.style.color = 'var(--text-dim)';
        badge.style.borderColor = 'var(--border)';
        copyBtn.style.display = 'none';
    } else if (status === 'active') {
        badge.innerText = isEn ? '🟢 Cross-network tunnel ready' : '🟢 跨网通道已就绪';
        badge.style.color = '#10b981';
        badge.style.borderColor = '#10b981';
        copyBtn.style.display = 'inline-block';
        lastTunnelUrl = url;
    } else if (status === 'failed') {
        const errorMsg = error ? ` (${error})` : '';
        badge.innerText = (isEn ? '❌ Failed to establish tunnel' : '❌ 跨网通道建立失败') + errorMsg;
        badge.style.color = '#ef4444';
        badge.style.borderColor = '#ef4444';
        copyBtn.style.display = 'none';
    }
}

function copyTunnelUrl() {
    if (!lastTunnelUrl) return;
    navigator.clipboard.writeText(lastTunnelUrl).then(() => {
        showToast(window.location.pathname.includes('/en') ? '✅ Link copied to clipboard!' : '✅ 链接已复制到剪贴板！');
    }).catch(err => {
        console.error('Could not copy text: ', err);
    });
}

// 与后端 replay_request 完全一致的内部代理头过滤集合
const PROXY_EXCLUDED_HEADERS = new Set([
    'host', 'x-original-url', 'x-original-host', 'content-length',
    'x-forwarded-proto', 'x-forwarded-for', 'x-forwarded-port',
    'x-forwarded-host', 'x-real-ip', 'x-scheme', 'connection',
    'keep-alive', 'accept-encoding'
]);

function buildCleanHeaders(rawHeaders) {
    const clean = {};
    for (const [key, value] of Object.entries(rawHeaders)) {
        if (!PROXY_EXCLUDED_HEADERS.has(key.toLowerCase())) {
            clean[key] = value;
        }
    }
    return clean;
}

// 自动刷新 URL 中的时间戳参数为当前时间
// 策略：检测值为纯数字且长度10~13位（Unix秒级/毫秒级），不依赖参数名，覆盖所有命名风格
function refreshTimestampsInUrl(url) {
    try {
        const parsed = new URL(url);
        const nowSec = Math.floor(Date.now() / 1000);
        const nowMs = Date.now();
        let changed = false;
        for (const [key, value] of parsed.searchParams.entries()) {
            // 纯数字且长度10位(秒级)或13位(毫秒级)
            if (/^\d{10}$/.test(value)) {
                parsed.searchParams.set(key, nowSec);
                changed = true;
            } else if (/^\d{13}$/.test(value)) {
                parsed.searchParams.set(key, nowMs);
                changed = true;
            }
        }
        return changed ? parsed.toString() : url;
    } catch (e) {
        return url;
    }
}

function copyAsCurl() {
    if (!currentSelectedLogId) {
        showToast('⚠️ 请先在左侧选择一条请求', '#f59e0b');
        return;
    }
    const log = window.capturedLogsMap[currentSelectedLogId];
    if (!log) return;

    // 优先读取用户在 UI 中编辑过的 URL，并自动刷新时间戳
    const editedUrl = (document.getElementById('rule-original-url')?.value || '').trim();
    const baseUrl = editedUrl || log.original_url || log.url;
    const url = refreshTimestampsInUrl(baseUrl);
    // 如果时间戳被刷新，同步更新输入框让用户可见
    if (url !== baseUrl) document.getElementById('rule-original-url').value = url;

    const method = log.method || 'GET';
    const cleanHeaders = buildCleanHeaders(log.headers || {});
    const body = log.body;

    let curlCmd = `curl -X ${method} "${url}"`;

    for (const [key, value] of Object.entries(cleanHeaders)) {
        const escapedValue = String(value).replace(/"/g, '\\"');
        curlCmd += ` \\\n  -H "${key}: ${escapedValue}"`;
    }

    if (method !== 'GET' && body) {
        let bodyStr = typeof body === 'object' ? JSON.stringify(body) : String(body);
        const escapedBody = bodyStr.replace(/"/g, '\\"');
        curlCmd += ` \\\n  -d "${escapedBody}"`;
    }

    navigator.clipboard.writeText(curlCmd).then(() => {
        showToast('📋 cURL 命令已成功复制到剪切板！');
    }).catch(() => {
        showToast('❌ 复制失败，请手动选择复制', '#ef4444');
    });
}

async function replayRequest() {
    if (!currentSelectedLogId) {
        showToast('⚠️ 请先在左侧选择一条请求', '#f59e0b');
        return;
    }
    const log = window.capturedLogsMap[currentSelectedLogId];
    if (!log) return;

    // 优先读取用户在 UI 中编辑过的 URL，并自动刷新时间戳
    const editedUrl = (document.getElementById('rule-original-url')?.value || '').trim();
    const baseUrl = editedUrl || log.original_url || log.url;
    const url = refreshTimestampsInUrl(baseUrl);
    if (url !== baseUrl) document.getElementById('rule-original-url').value = url;
    const method = log.method || 'GET';
    const cleanHeaders = buildCleanHeaders(log.headers || {});
    const body = log.body;

    // 调试：在控制台输出实际发送的参数
    console.log('🚀 [重发] URL:', url, ' method:', method, ' headers:', cleanHeaders, ' body:', body);

    const replayBtn = document.getElementById('btn-replay-req');
    const originalText = replayBtn.innerHTML;
    replayBtn.innerHTML = '⚡ 正在发起后台重发...';
    replayBtn.disabled = true;
    replayBtn.style.opacity = '0.7';

    try {
        const res = await fetch('/api/replay-request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url: url,
                method: method,
                headers: cleanHeaders,
                body: body
            })
        });

        const result = await res.json();
        console.log('🔁 [重发响应]:', result);
        if (result.error) {
            showToast('❌ ' + result.error, '#ef4444');
        } else {
            showToast('🎉 请求成功！状态码: ' + result.status_code);

            let responseStr = '';
            if (typeof result.data === 'object') {
                responseStr = JSON.stringify(result.data, null, 4);
            } else {
                responseStr = String(result.data);
            }

            document.getElementById('rule-body').value = responseStr;
            syncRawToTree();

            if (activeEditorMode === 'tree') {
                switchEditorMode('tree');
            }
        }
    } catch (err) {
        console.error('❌ 前端回填或网络连接异常:', err);
        showToast('❌ 请求或回填失败，请查看控制台报错', '#ef4444');
    } finally {
        replayBtn.innerHTML = originalText;
        replayBtn.disabled = false;
        replayBtn.style.opacity = '1';
    }
}

// 全局日志缓存，用于本地搜索与过滤，免除网络延迟
window.allCapturedLogs = [];
window.currentLogFilter = 'all';
window.filterLogsEnabled = true; // 过滤根路径日志默认开启

// ─── 切换日志过滤开关：过滤掉 path 仅为 "/" 的请求 ───
function toggleLogFilter() {
    window.filterLogsEnabled = !window.filterLogsEnabled;
    const toggleBtn = document.getElementById('filter-logs-toggle');
    if (toggleBtn) {
        if (window.filterLogsEnabled) {
            toggleBtn.classList.add('active');
        } else {
            toggleBtn.classList.remove('active');
        }
    }
    renderFilteredLogs();
}

// ─── 获取抓包列表 ───
async function loadLogs() {
    try {
        const res = await fetch('/api/logs');
        const logs = await res.json();

        // 检查当前选中的 log 是否从 loading 变为了完成状态
        let shouldRefreshDetails = false;
        if (currentSelectedLogId && window.capturedLogsMap) {
            const oldLog = window.capturedLogsMap[currentSelectedLogId];
            const newLog = logs.find(l => l.id === currentSelectedLogId);
            if (oldLog && oldLog.loading && newLog && !newLog.loading) {
                shouldRefreshDetails = true;
            }
        }

        window.allCapturedLogs = logs;
        renderFilteredLogs();

        if (shouldRefreshDetails) {
            const activeEl = document.querySelector('.log-item.active');
            if (activeEl) {
                selectLog(activeEl, currentSelectedLogId);
            }
        }

        // 🚀 实时同步子选项卡渲染
        if (typeof currentSubTab !== 'undefined') {
            if (currentSubTab === 'logs') {
                renderTerminalLogs();
            } else if (currentSubTab === 'analytics') {
                renderAnalyticsData();
            }
        }
    } catch (e) { }
}

// ─── 设置过滤器类型 ───
function setLogFilter(filterType, element) {
    window.currentLogFilter = filterType;

    // 切换按钮的 active 状态
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    if (element) {
        element.classList.add('active');
    }

    renderFilteredLogs();
}

// ─── 搜索框输入触发过滤 ───
function filterLogs() {
    renderFilteredLogs();
}

// ─── 渲染过滤后的日志列表 ───
window.displayUrlInsteadOfPath = false;
function toggleUrlDisplay(checked) {
    window.displayUrlInsteadOfPath = checked;
    renderFilteredLogs();
}

function renderFilteredLogs() {
    const container = document.getElementById('log-list');
    const badge = document.getElementById('log-badge');
    if (!container) return;

    const searchQuery = (document.getElementById('log-search-input')?.value || '').toLowerCase().trim();
    const filterType = window.currentLogFilter;

    // 进行智能双向检索
    const filtered = window.allCapturedLogs.filter(log => {
        // 1. HTTP 方法 / Mock 状态分类过滤 (始终生效)
        if (filterType === 'GET' && log.method !== 'GET') return false;
        if (filterType === 'POST' && log.method !== 'POST') return false;
        if (filterType === 'mocked' && !log.mock_matched) return false;
        if (filterType === 'missed' && log.mock_matched) return false;
        if (filterType === 'error' && !(log.status >= 400 || (log.status === 0 && !log.loading) || log.error || log.business_error)) return false;

        // 1.5 过滤根路径日志 (开启过滤日志时，隐藏 path 仅为 "/" 的请求)
        if (window.filterLogsEnabled && log.path === '/') return false;

        // 2. 检索框匹配 (支持过滤 Path, Method, Query参数, RequestBody, Headers)
        if (searchQuery) {
            const pathMatch = (log.path || '').toLowerCase().includes(searchQuery);
            const methodMatch = (log.method || '').toLowerCase().includes(searchQuery);

            // 安全序列化匹配
            const queryMatch = JSON.stringify(log.query_params || {}).toLowerCase().includes(searchQuery);
            const bodyMatch = typeof log.body === 'string'
                ? log.body.toLowerCase().includes(searchQuery)
                : JSON.stringify(log.body || {}).toLowerCase().includes(searchQuery);
            const headersMatch = JSON.stringify(log.headers || {}).toLowerCase().includes(searchQuery);

            return pathMatch || methodMatch || queryMatch || bodyMatch || headersMatch;
        }

        return true;
    });

    // 更新日志角标数量
    if (badge) {
        badge.innerText = filtered.length;
    }

    if (filtered.length === 0) {
        container.innerHTML = `
                    <div class="empty-state">
                        <div class="icon">🔍</div>
                        无匹配的请求记录<br>
                        <span style="font-size: 11px; color: var(--text-dim);">尝试更换关键词或过滤器</span>
                    </div>`;
        return;
    }

    let itemsHtml = '';
    filtered.forEach(log => {
        const isActive = currentSelectedLogId === log.id ? 'active' : '';
        const matchedBadge = log.mock_matched
            ? `<span class="mock-badge">🟢 Mock</span>`
            : `<span class="mock-badge missed">⚡ 透传</span>`;

        // 响应码 badge
        let statusBadge = '';
        if (log.loading) {
            statusBadge = `<span class="status-badge loading">⏳ 请求中</span>`;
        } else if (log.status) {
            // 业务层错误（HTTP 200 但响应体携带失败的业务状态码，如 status:100）也标红
            const isErr = log.status >= 400 || log.business_error;
            const cls = isErr ? 'err' : 'ok';
            const shownStatus = (log.business_error && log.business_status != null) ? log.business_status : log.status;
            const bizTitle = log.business_error ? ' title="业务层错误（响应体 status 非成功）"' : '';
            statusBadge = `<span class="status-badge ${cls}"${bizTitle}>${shownStatus}${log.business_error ? ' ⚠' : ''}</span>`;
        }

        // 耗时 badge
        const timingBadge = (log.duration_ms != null)
            ? `<span class="timing-badge">${log.duration_ms}ms</span>`
            : '';

        const qParamsStr = Object.keys(log.query_params || {}).length
            ? `<div style="font-size: 10px; color: var(--accent); margin-top: 4px; font-family: 'JetBrains Mono', monospace; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">?${new URLSearchParams(log.query_params).toString()}</div>`
            : '';

        // 将日志放入全局内存缓存中，规避 HTML 属性中含特殊字符（如单引号/双引号）导致属性断裂而点击无反应的 Bug
        window.capturedLogsMap = window.capturedLogsMap || {};
        window.capturedLogsMap[log.id] = log;
        
        const displayPath = window.displayUrlInsteadOfPath ? (log.original_url || log.url) : log.path;
        const finalQParamsStr = window.displayUrlInsteadOfPath ? '' : qParamsStr;

        itemsHtml += `
                    <div class="log-item ${isActive}" onclick="selectLog(this, ${log.id})">
                        <div class="log-meta">
                            <span class="method ${log.method}">${log.method}</span>
                            <div style="display:flex;align-items:center;gap:4px;">
                                ${matchedBadge}
                                ${statusBadge}
                            </div>
                        </div>
                        <div class="url-path">${displayPath}</div>
                        ${finalQParamsStr}
                        <div class="log-footer">
                            <span>🕐 ${log.time}</span>
                            <span class="size-badge" style="font-size: 10px; color: var(--text-dim); margin-left: 6px;">⬆ ${log.req_size != null ? (log.req_size < 1024 ? log.req_size + ' B' : (log.req_size/1024).toFixed(1) + ' KB') : '0 B'} ⬇ ${log.resp_size != null ? (log.resp_size < 1024 ? log.resp_size + ' B' : (log.resp_size/1024).toFixed(1) + ' KB') : '0 B'}</span>
                            ${timingBadge}
                        </div>
                    </div>
                `;
    });
    container.innerHTML = itemsHtml;
}

// ─── 清空请求 ───
let clearingLogs = false;
async function clearLogs(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    // 防止重复点击导致弹窗二次出现
    if (clearingLogs) return;
    clearingLogs = true;
    if (!confirm('确定要清空所有实时请求列表吗？')) {
        clearingLogs = false;
        return;
    }
    try {
        const res = await fetch('/api/logs', { method: 'DELETE' });
        if (res.ok) {
            currentSelectedLogId = null;
            document.getElementById('no-selection-state').style.display = 'block';
            document.getElementById('details-layout').style.display = 'none';
            showToast('🗑️ 请求列表已清空');
            loadLogs();
        }
    } catch (e) {
        showToast('❌ 清空失败', '#ef4444');
    }
    clearingLogs = false;
}

