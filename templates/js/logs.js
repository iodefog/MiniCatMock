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

// ─── 神策(Sensors Data)埋点解密（客户端兜底）───
// 即使服务端未重启、或抓到的是历史加密日志，也能在「请求详情」里明文展示。
// 算法：data_list=URL安全的base64(gzip(json)) → base64解码 → gzip解压 → JSON。
async function decodeSensorsBodyAsync(rawStr) {
    if (!rawStr || typeof rawStr !== 'string' || !rawStr.includes('data_list=')) return null;
    try {
        const params = new URLSearchParams(rawStr);
        const enc = params.get('data_list');
        if (!enc) return null;
        // URL-safe base64 → 标准 base64
        const b64 = enc.replace(/-/g, '+').replace(/_/g, '/');
        const bin = atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        const ds = new DecompressionStream('gzip');
        const stream = new Response(bytes).body.pipeThrough(ds);
        const buf = await new Response(stream).arrayBuffer();
        const text = new TextDecoder('utf-8').decode(buf);
        JSON.parse(text); // 校验是否为合法 JSON
        return text;
    } catch (e) {
        return null;
    }
}

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

// ─── 增量刷新抓包列表（仅追加新条目，用于自动轮询）───
async function incrementalLoadLogs() {
    try {
        const res = await fetch('/api/logs');
        const logs = await res.json();

        // 首次加载，全量写入
        if (!window.allCapturedLogs || window.allCapturedLogs.length === 0) {
            window.allCapturedLogs = logs;
            renderFilteredLogs();
            return;
        }

        // 找新条目（日志按最新在前排列）
        const existingIds = new Set(window.allCapturedLogs.map(l => l.id));
        const newLogs = logs.filter(l => !existingIds.has(l.id));
        if (newLogs.length === 0) return; // 无新增，不动 DOM

        // 有新增，追加到头部
        window.allCapturedLogs = [...newLogs, ...window.allCapturedLogs];

        // 重绘列表（renderFilteredLogs 内部已通过 currentSelectedLogId 保留 active 样式）
        renderFilteredLogs();
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

    // 选择普通过滤器时，清除路径过滤的高亮标记
    updatePathFilterIndicator();
    renderFilteredLogs();
}

// ─── 搜索框输入触发过滤 ───
function filterLogs() {
    const input = document.getElementById('log-search-input');
    const q = input ? input.value.trim() : '';
    if (window.aiSearchMode) {
        if (!q) { window.aiSearchCondition = null; renderFilteredLogs(); return; }
        // AI 语义搜索模式：防抖触发意图解析，期间先用已有条件即时渲染
        clearTimeout(window._aiSearchTimer);
        window._aiSearchTimer = setTimeout(() => runAISemanticSearch(q), 700);
        renderFilteredLogs();
        return;
    }
    renderFilteredLogs();
}

// ─── AI 语义搜索：切换模式 ───
function toggleAISearch() {
    window.aiSearchMode = !window.aiSearchMode;
    const icon = document.getElementById('log-ai-search-toggle');
    const input = document.getElementById('log-search-input');
    if (icon) {
        if (window.aiSearchMode) {
            icon.style.background = 'var(--purple)';
            icon.style.color = '#fff';
            icon.style.borderColor = 'var(--purple)';
            icon.title = 'AI 语义搜索：开（点击关闭）';
        } else {
            icon.style.background = 'transparent';
            icon.style.color = 'var(--purple)';
            icon.style.borderColor = 'transparent';
            icon.title = '切换 AI 语义搜索';
        }
    }
    if (input) {
        input.placeholder = window.aiSearchMode
            ? (typeof currentLang !== 'undefined' && currentLang === 'en' ? 'AI search: e.g. "all requests of sf001/list"' : 'AI 语义搜索：如"提取所有 sf001/list 的请求"')
            : (typeof currentLang !== 'undefined' && currentLang === 'en' ? 'AI natural language search...' : 'AI 自然语言搜索 / 搜索路径...');
    }
    if (!window.aiSearchMode) window.aiSearchCondition = null;
    if (window.aiSearchMode && input && input.value.trim()) {
        runAISemanticSearch(input.value.trim());
    } else {
        renderFilteredLogs();
    }
}

// ─── AI 语义搜索：把自然语言解析为过滤条件并应用 ───
async function runAISemanticSearch(query) {
    const cfg = loadAIConfig();
    if (!cfg.apiKey) {
        showToast((typeof currentLang !== 'undefined' && currentLang === 'en' ? '⚠️ Please configure API Key for AI search' : '⚠️ 请先配置 API Key 才能使用 AI 语义搜索'), '#f59e0b');
        return;
    }
    try {
        const systemPrompt = `你是一个日志搜索条件解析器。根据用户的中文/英文自然语言，提取过滤条件并以纯 JSON 返回，不要任何解释或 Markdown。
字段定义：
- pathContains: 字符串，若用户提到某个接口路径(如 sf001/list)，取其路径片段(不含域名、不含查询参数)
- method: 字符串，HTTP 方法 GET/POST/PUT/DELETE 之一，若提及
- statusMin: 数字，若提及"错误/失败/异常/出错"则给 400，否则省略
- onlyMock: 布尔，若提及"mock/模拟/命中"则为 true
- onlyPass: 布尔，若提及"透传/未命中/代理"则为 true
- keywords: 字符串数组，其他需要全文匹配的关键词
示例："提取所有 sf001/list 的请求" => {"pathContains":"sf001/list"}
只返回 JSON。`;
        const text = await callAIComplete(cfg, systemPrompt, query);
        let cond = null;
        try {
            const m = text.match(/\{[\s\S]*\}/);
            cond = m ? JSON.parse(m[0]) : null;
        } catch (e) { cond = null; }
        window.aiSearchCondition = cond;
        if (!cond) {
            showToast((typeof currentLang !== 'undefined' && currentLang === 'en' ? '🤖 Could not parse intent, showing all' : '🤖 未能解析搜索意图，已显示全部'), '#a855f7');
        }
        renderFilteredLogs();
    } catch (e) {
        showToast('AI 语义搜索失败: ' + e.message, '#ef4444');
    }
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
    initLogLongPress(); // 绑定一次长按/右键浮层（幂等）

    const searchQuery = (document.getElementById('log-search-input')?.value || '').toLowerCase().trim();
    const filterType = window.currentLogFilter;

    // 进行智能双向检索（普通模式 + AI 语义模式）
    const aiActive = window.aiSearchMode && !!window.aiSearchCondition;
    const filtered = window.allCapturedLogs.filter(log => {
        // 1. HTTP 方法 / Mock 状态分类过滤 (始终生效)
        if (filterType === 'GET' && log.method !== 'GET') return false;
        if (filterType === 'POST' && log.method !== 'POST') return false;
        if (filterType === 'mocked' && !log.mock_matched) return false;
        if (filterType === 'missed' && log.mock_matched) return false;
        if (filterType === 'error' && !(log.status >= 400 || (log.status === 0 && !log.loading) || log.error || log.business_error)) return false;
        // 路径过滤（由「过滤日志」浮层配置，如 /sa（神策）、/ioslog 等）：仅显示 path 以指定前缀开头的请求
        if (typeof filterType === 'string' && filterType.startsWith('path:')) {
            const prefix = filterType.slice(5);
            if (prefix && !(log.path || '').startsWith(prefix)) return false;
        }

        // 1.5 过滤根路径日志 (开启过滤日志时，隐藏 path 仅为 "/" 的请求)
        if (window.filterLogsEnabled && log.path === '/') return false;

        // 1.6 已配置路径过滤（由「过滤日志」浮层配置的路径，如 /sa 神策埋点、/ioslog）：
        //     过滤日志开启时，这些路径在主包列表中不再显示（按 path 前缀匹配）。
        //     当前正在「仅查看」的聚焦路径除外，避免点了聚焦反而把自己藏起来。
        if (window.filterLogsEnabled && Array.isArray(window.logPathFilters) && window.logPathFilters.length) {
            const activePath = (typeof filterType === 'string' && filterType.startsWith('path:')) ? filterType.slice(5) : '';
            const lp = log.path || '';
            for (const f of window.logPathFilters) {
                const p = f.path || '';
                if (p && p !== activePath && lp.startsWith(p)) return false;
            }
        }

        // 2a. AI 语义搜索条件（结构化过滤，优先于普通子串匹配）
        if (aiActive) {
            const c = window.aiSearchCondition;
            if (c.pathContains && !(log.path || '').toLowerCase().includes(String(c.pathContains).toLowerCase())) return false;
            if (c.method && (log.method || '').toUpperCase() !== String(c.method).toUpperCase()) return false;
            if (c.statusMin && !(log.status >= c.statusMin)) return false;
            if (c.onlyMock && !log.mock_matched) return false;
            if (c.onlyPass && log.mock_matched) return false;
            if (c.keywords && Array.isArray(c.keywords) && c.keywords.length) {
                const hay = ((log.path || '') + ' ' + (log.method || '') + ' ' + JSON.stringify(log.query_params || {}) + ' ' + JSON.stringify(log.body || {})).toLowerCase();
                if (!c.keywords.some(k => hay.includes(String(k).toLowerCase()))) return false;
            }
            return true;
        }

        // 2b. 普通子串检索 (支持过滤 Path, Method, Query参数, RequestBody, Headers)
        if (searchQuery && !window.aiSearchMode) {
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
                    <div class="log-item ${isActive}" data-log-id="${log.id}" onclick="selectLog(this, ${log.id})" oncontextmenu="onLogItemContext(event, ${log.id})">
                        <div class="log-meta">
                            <span class="method ${log.method}">${log.method}</span>
                            <div style="display:flex;align-items:center;gap:4px;">
                                ${matchedBadge}
                                ${statusBadge}
                            </div>
                        </div>
                        <div class="url-path" onmousedown="event.stopPropagation()">${displayPath}</div>
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

// ─── 长按 / 右键日志项：弹出浮层，可配置或删除该 path 的路径映射 ───
// 右键（桌面）直接触发；触摸端按住 500ms 触发（见 initLogLongPress）。
function onLogItemContext(e, logId) {
    e.preventDefault();
    showLogPathMenu(logId, e.clientX, e.clientY);
}

function initLogLongPress() {
    const list = document.getElementById('log-list');
    if (!list || list.dataset.lpBound) return;
    list.dataset.lpBound = '1';

    // 触摸长按：按住 500ms 弹出浮层（鼠标端使用 contextmenu 事件）
    let lpTimer = null;
    list.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse') return;
        const item = e.target.closest('.log-item');
        if (!item) return;
        const logId = Number(item.getAttribute('data-log-id'));
        lpTimer = setTimeout(() => {
            const rect = item.getBoundingClientRect();
            showLogPathMenu(logId, rect.left + rect.width / 2, rect.top + 44);
        }, 500);
    });
    const cancelLp = () => { if (lpTimer) { clearTimeout(lpTimer); lpTimer = null; } };
    list.addEventListener('pointermove', cancelLp);
    list.addEventListener('pointerup', cancelLp);
    list.addEventListener('pointercancel', cancelLp);
}

function showLogPathMenu(logId, x, y) {
    const log = window.capturedLogsMap && window.capturedLogsMap[logId];
    if (!log) return;
    const path = log.path || '';
    hideLogPathMenu();

    const norm = (typeof normalizeMappingPath === 'function')
        ? normalizeMappingPath
        : (p) => { p = (p || '').trim(); if (!p.startsWith('/')) p = '/' + p; return p; };
    const existingIdx = (typeof pathMappingsCache !== 'undefined')
        ? pathMappingsCache.findIndex(m => norm(m.path) === norm(path)) : -1;

    const menu = document.createElement('div');
    menu.id = 'log-path-menu';
    menu.className = 'float-menu';
    menu.innerHTML = `
        <div class="float-menu-title">${escapeHtml(path || '/')}</div>
        <button class="float-menu-item" onclick="configurePathFromLog('${escapeHtml(path)}')">⚙ 配置路径映射</button>
        <button class="float-menu-item ${existingIdx >= 0 ? '' : 'disabled'}" ${existingIdx >= 0 ? '' : 'disabled'} onclick="deletePathFromLog('${escapeHtml(path)}')">🗑 删除路径映射</button>
        <button class="float-menu-item cancel" onclick="hideLogPathMenu()">取消</button>
    `;
    document.body.appendChild(menu);

    // 视口内定位，避免溢出
    const mw = 230;
    const mh = menu.offsetHeight || 130;
    let left = Math.min(x, window.innerWidth - mw - 8);
    let top = Math.min(y, window.innerHeight - mh - 8);
    menu.style.left = Math.max(8, left) + 'px';
    menu.style.top = Math.max(8, top) + 'px';

    setTimeout(() => document.addEventListener('click', _onDocClickLogMenu), 0);
}

function _onDocClickLogMenu(e) {
    const m = document.getElementById('log-path-menu');
    if (m && !m.contains(e.target)) hideLogPathMenu();
}

function hideLogPathMenu() {
    const m = document.getElementById('log-path-menu');
    if (m) m.remove();
    document.removeEventListener('click', _onDocClickLogMenu);
}

// 从日志项配置路径映射：已存在同 path 映射则编辑，否则预填 path 新增
function configurePathFromLog(path) {
    hideLogPathMenu();
    const norm = (typeof normalizeMappingPath === 'function')
        ? normalizeMappingPath
        : (p) => { p = (p || '').trim(); if (!p.startsWith('/')) p = '/' + p; return p; };
    const idx = (typeof pathMappingsCache !== 'undefined')
        ? pathMappingsCache.findIndex(m => norm(m.path) === norm(path)) : -1;
    if (idx >= 0) {
        openPathMappingEditor(idx);
    } else {
        openPathMappingEditor({ path: path || '', target_url: '', method: 'ANY', enabled: true, force_response: '' });
    }
    // 跳转到「连接设置」tab 的「路径映射」区块，便于查看/管理
    if (typeof openPathMappingManager === 'function') openPathMappingManager();
}

// 从日志项删除该 path 已存在的路径映射
function deletePathFromLog(path) {
    const norm = (typeof normalizeMappingPath === 'function')
        ? normalizeMappingPath
        : (p) => { p = (p || '').trim(); if (!p.startsWith('/')) p = '/' + p; return p; };
    const idx = (typeof pathMappingsCache !== 'undefined')
        ? pathMappingsCache.findIndex(m => norm(m.path) === norm(path)) : -1;
    hideLogPathMenu();
    if (idx < 0) {
        showToast('该路径暂无映射可删除', '#f59e0b');
        return;
    }
    if (!confirm(`确认删除映射：\n${pathMappingsCache[idx].path} ➜ ${pathMappingsCache[idx].target_url}`)) return;
    pathMappingsCache.splice(idx, 1);
    savePathMappings().then(() => { if (typeof renderPathMappings === 'function') renderPathMappings(); });
    showToast('✅ 已删除路径映射');
}

// ─────────────────────────────────────────────────────────────
// 「过滤日志」按钮：路径过滤管理
//   · 单击        → 切换过滤根路径「/」请求（原有行为）
//   · 双击 / 长按 → 弹出管理浮层，可增删并选择要单独查看的 path
//     预置：/sa（神策，神策就是 /sa）、/ioslog；也可新增其他 path
// ─────────────────────────────────────────────────────────────
const LOG_PATH_FILTERS_KEY = 'mock_log_path_filters';

function loadLogPathFilters() {
    try {
        const raw = localStorage.getItem(LOG_PATH_FILTERS_KEY);
        if (raw) {
            const arr = JSON.parse(raw);
            if (Array.isArray(arr)) return arr;
        }
    } catch (e) { }
    // 默认预置：神策(/sa) 与 /ioslog
    return [
        { path: '/sa', label: '神策' },
        { path: '/ioslog', label: '' }
    ];
}

function saveLogPathFilters(list) {
    window.logPathFilters = list;
    try { localStorage.setItem(LOG_PATH_FILTERS_KEY, JSON.stringify(list)); } catch (e) { }
}

if (!window.logPathFilters) window.logPathFilters = loadLogPathFilters();

// 单击/双击区分：单击延迟触发根路径过滤，若紧接双击则取消；双击打开管理浮层
let _filterToggleClickTimer = null;
function onFilterToggleClick() {
    if (_filterToggleClickTimer) { clearTimeout(_filterToggleClickTimer); _filterToggleClickTimer = null; }
    _filterToggleClickTimer = setTimeout(() => {
        _filterToggleClickTimer = null;
        toggleLogFilter();
    }, 230);
}

// 打开路径过滤管理浮层
function openLogFilterManager() {
    if (_filterToggleClickTimer) { clearTimeout(_filterToggleClickTimer); _filterToggleClickTimer = null; }
    if (document.getElementById('log-filter-manager-mask')) return;

    const mask = document.createElement('div');
    mask.className = 'tmodal-mask';
    mask.id = 'log-filter-manager-mask';
    mask.onclick = (e) => { if (e.target === mask) mask.remove(); };

    const modal = document.createElement('div');
    modal.className = 'tmodal';
    modal.innerHTML = `
        <h3>日志路径过滤</h3>
        <div class="pm-editor-hint" style="font-size: 11px; color: var(--text-muted); margin-bottom: 12px; line-height: 1.5;">
            点击某个路径，仅查看该接口的请求（按 path 前缀匹配）。<br>
            可新增自定义 path（如 <code>/sa</code>、<code>/ioslog</code>），神策埋点即为 <code>/sa</code>。<br>
            过滤日志开启后，列表中的路径不再显示在主包列表里。
        </div>
        <div class="lpf-list" id="lpf-list"></div>
        <div class="lpf-add-row">
            <input id="lpf-new-path" placeholder="/ioslog" onkeydown="if(event.key==='Enter'){addLogPathFilterFromInput();}">
            <button class="lpf-add-btn" onclick="addLogPathFilterFromInput()">＋ 新增</button>
        </div>
        <div class="tmodal-actions">
            <button onclick="clearLogPathFilter()">显示全部</button>
            <button class="tmodal-save" onclick="this.closest('.tmodal-mask').remove()">完成</button>
        </div>`;
    mask.appendChild(modal);
    document.body.appendChild(mask);
    renderLogPathFilterList();
}

function renderLogPathFilterList() {
    const list = document.getElementById('lpf-list');
    if (!list) return;
    const active = (typeof window.currentLogFilter === 'string' && window.currentLogFilter.startsWith('path:'))
        ? window.currentLogFilter.slice(5) : '';
    if (!window.logPathFilters.length) {
        list.innerHTML = '<div class="pm-empty" style="font-size: 12px; color: var(--text-muted); padding: 12px; text-align: center; border: 1px dashed var(--border); border-radius: 8px;">暂无路径过滤，下方输入 path 新增</div>';
        return;
    }
    list.innerHTML = window.logPathFilters.map((f, idx) => {
        const isActive = f.path === active;
        return `
        <div class="lpf-item ${isActive ? 'active' : ''}">
            <button class="lpf-apply" onclick="applyLogPathFilter('${escapeHtml(f.path)}')">
                <span class="lpf-path">${escapeHtml(f.path)}</span>
                ${f.label ? `<span class="lpf-label">${escapeHtml(f.label)}</span>` : ''}
                ${isActive ? '<span class="lpf-check">✓</span>' : ''}
            </button>
            <button class="lpf-del" title="删除该路径" onclick="deleteLogPathFilter(${idx})">🗑</button>
        </div>`;
    }).join('');
}

function addLogPathFilterFromInput() {
    const input = document.getElementById('lpf-new-path');
    if (!input) return;
    let p = (input.value || '').trim();
    if (!p) return;
    if (!p.startsWith('/')) p = '/' + p;
    if (window.logPathFilters.some(f => f.path === p)) {
        showToast('该路径已存在', '#f59e0b');
        return;
    }
    window.logPathFilters.push({ path: p, label: '' });
    saveLogPathFilters(window.logPathFilters);
    input.value = '';
    renderLogPathFilterList();
}

function deleteLogPathFilter(idx) {
    const f = window.logPathFilters[idx];
    if (!f) return;
    const wasActive = (typeof window.currentLogFilter === 'string') && window.currentLogFilter === 'path:' + f.path;
    window.logPathFilters.splice(idx, 1);
    saveLogPathFilters(window.logPathFilters);
    if (wasActive) {
        window.currentLogFilter = 'all';
        updatePathFilterIndicator();
        renderFilteredLogs();
    }
    renderLogPathFilterList();
}

function applyLogPathFilter(path) {
    window.currentLogFilter = 'path:' + path;
    // 清除普通过滤按钮的高亮（路径过滤与普通过滤互斥）
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    updatePathFilterIndicator();
    renderFilteredLogs();
    const mask = document.getElementById('log-filter-manager-mask');
    if (mask) mask.remove();
}

function clearLogPathFilter() {
    window.currentLogFilter = 'all';
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    const allBtn = document.querySelector('.filter-btn[onclick*="\'all\'"]');
    if (allBtn) allBtn.classList.add('active');
    updatePathFilterIndicator();
    renderFilteredLogs();
    const mask = document.getElementById('log-filter-manager-mask');
    if (mask) mask.remove();
}

// 在「过滤日志」按钮上显示当前生效的路径过滤标记
function updatePathFilterIndicator() {
    const tag = document.getElementById('path-filter-tag');
    const btn = document.getElementById('filter-logs-toggle');
    const f = window.currentLogFilter || '';
    const isPath = typeof f === 'string' && f.startsWith('path:');
    if (tag) {
        if (isPath) { tag.textContent = f.slice(5); tag.style.display = ''; }
        else { tag.textContent = ''; tag.style.display = 'none'; }
    }
    if (btn) btn.classList.toggle('pf-active', isPath);
}

