// ─── 明暗主题切换 ───
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeButton(savedTheme);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeButton(newTheme);
}

function updateThemeButton(theme) {
    const btn = document.getElementById('theme-toggle-btn');
    if (btn) {
        btn.innerHTML = theme === 'light' ? '🌙' : '☀️';
    }
}

// 立即初始化
initTheme();

let currentSelectedLogId = null;

window.onload = function () {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    updateThemeButton(currentTheme);
    loadLogs();
    loadRules();
    initQrCode();
    loadGlobalConfig();
    syncTextareaToTree();
    loadTelemetryStats();
    initResizers();
};

function initResizers() {
    function makeResizable(resizerId, targetId, minW, maxW) {
        const resizer = document.getElementById(resizerId);
        const target = document.getElementById(targetId);
        if (!resizer || !target) return;

        let startX, startWidth;

        function onMouseMove(e) {
            let newWidth = startWidth + (e.clientX - startX);
            if (newWidth < minW) newWidth = minW;
            if (newWidth > maxW) newWidth = maxW;
            target.style.width = newWidth + 'px';
        }

        function onMouseUp(e) {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            document.body.classList.remove('resizing');
            resizer.classList.remove('dragging');
        }

        resizer.addEventListener('mousedown', (e) => {
            startX = e.clientX;
            startWidth = target.getBoundingClientRect().width;
            document.body.classList.add('resizing');
            resizer.classList.add('dragging');
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });
    }

    makeResizable('resizer-sidebar', 'sidebar', 150, 400);
    makeResizable('resizer-left-panel', 'left-panel', 200, 600);
}

// ─── 获取全局遥测与统计数据 ───
async function loadTelemetryStats() {
    try {
        const res = await fetch('/api/telemetry-stats');
        const data = await res.json();
        if (data && !data.error) {
            const usersEl = document.getElementById('stats-telemetry-users');
            if (usersEl) {
                usersEl.innerText = `${data.online_users} / ${data.total_users} 人`;
            }
            const packetsEl = document.getElementById('stats-telemetry-packets');
            if (packetsEl) {
                packetsEl.innerText = `${(data.total_packets || 0).toLocaleString()} 次`;
            }
            
            // 把后端的完整统计赋值给全局，防止本地限制的200条记录影响计算
            if (data.session_mocked !== undefined) window.sessionMocked = data.session_mocked;
            if (data.session_total !== undefined) window.sessionTotal = data.session_total;
            
            const statsTotalMocked = document.getElementById('stats-total-mocked');
            if (statsTotalMocked && window.sessionMocked !== undefined) {
                statsTotalMocked.innerText = window.sessionMocked + ' 次';
            }
        }
    } catch (e) { }
}

// ─── 获取全局 Mock 状态并初始化开关 ───
async function loadGlobalConfig() {
    try {
        const res = await fetch('/api/config');
        const config = await res.json();
        document.getElementById('global-mock-switch').checked = config.global_enabled;
    } catch (e) { }
}

// ─── 切换全局 Mock 状态 ───
async function toggleGlobalMock(enabled) {
    try {
        const res = await fetch('/api/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ global_enabled: enabled })
        });
        if (res.ok) {
            showToast(enabled ? '🟢 全局 Mock 服务已开启' : '🔴 全局 Mock 服务已关闭');
        } else {
            showToast('❌ 切换失败', '#ef4444');
        }
    } catch (e) {
        showToast('❌ 网络错误', '#ef4444');
    }
}

// 每隔3秒自动刷新一次抓包日志
setInterval(loadLogs, 3000);

// 每隔6秒自动刷新一次全局在线/注册用户及抓包累积量统计
setInterval(loadTelemetryStats, 6000);

// ─── 选项卡切换 ───
function switchTab(tabId, el) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

    el.classList.add('active');
    // #request-tab 不是独立的 .tab-content 元素，其内容在 #right-panel 中
    const tabElement = document.getElementById(tabId);
    if (tabElement) {
        tabElement.classList.add('active');
    }

    // 同步 body class，控制是否隐藏左侧请求列表和右侧面板
    document.body.className = document.body.className.replace(/\btab-\S+/g, '');
    document.body.classList.add('tab-' + tabId);

    // 返回抓包请求 tab 时，恢复子 tab 视图状态
    if (tabId === 'request-tab' && typeof currentSubTab !== 'undefined') {
        switchSubTab(currentSubTab);
    }
}

// ─── 子选项卡切换 (Dashboard / Logs / Analytics) ───
let currentSubTab = 'dashboard';

function switchSubTab(mode) {
    currentSubTab = mode;
    
    // 切换顶栏按钮 active 样式
    document.querySelectorAll('.middle-subtabs .subtab').forEach(tab => {
        if (tab.innerText.toLowerCase() === mode.toLowerCase()) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });

    const noSelect = document.getElementById('no-selection-state');
    const details = document.getElementById('details-layout');
    const logs = document.getElementById('logs-layout');
    const analytics = document.getElementById('analytics-layout');

    // 隐藏所有主视图
    if (noSelect) noSelect.style.display = 'none';
    if (details) details.style.display = 'none';
    if (logs) logs.style.display = 'none';
    if (analytics) analytics.style.display = 'none';

    if (mode === 'dashboard') {
        if (currentSelectedLogId) {
            if (details) details.style.display = 'grid';
        } else {
            if (noSelect) noSelect.style.display = 'flex';
        }
    } else if (mode === 'logs') {
        if (logs) logs.style.display = 'flex';
        renderTerminalLogs();
    } else if (mode === 'analytics') {
        if (analytics) analytics.style.display = 'flex';
        renderAnalyticsData();
    }
}

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
        if (filterType === 'error' && !(log.status >= 400 || (log.status === 0 && !log.loading) || log.error)) return false;

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
            const cls = log.status >= 400 ? 'err' : 'ok';
            statusBadge = `<span class="status-badge ${cls}">${log.status}</span>`;
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
async function clearLogs() {
    if (!confirm('确定要清空所有实时请求列表吗？')) return;
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
}

// ─── Collapsible JSON Viewer Helper ───
function renderJsonView(container, data) {
    container.innerHTML = '';
    const root = document.createElement('div');
    root.className = 'json-view-root';

    function createNode(key, value, isLast) {
        const item = document.createElement('div');
        item.className = 'json-node';

        const line = document.createElement('div');
        line.className = 'json-line';

        if (key !== null) {
            const keySpan = document.createElement('span');
            keySpan.className = 'json-key';
            keySpan.innerText = `"${key}": `;
            line.appendChild(keySpan);
        }

        if (value === null) {
            const nullSpan = document.createElement('span');
            nullSpan.className = 'json-null';
            nullSpan.innerText = 'null' + (isLast ? '' : ',');
            line.appendChild(nullSpan);
            item.appendChild(line);
        } else if (typeof value === 'object') {
            const isArray = Array.isArray(value);
            const openBracket = isArray ? '[' : '{';
            const closeBracket = isArray ? ']' : '}';

            const bracketOpenSpan = document.createElement('span');
            bracketOpenSpan.className = 'json-bracket';
            bracketOpenSpan.innerText = openBracket;
            line.appendChild(bracketOpenSpan);

            const keys = Object.keys(value);
            if (keys.length === 0) {
                const bracketCloseSpan = document.createElement('span');
                bracketCloseSpan.className = 'json-bracket';
                bracketCloseSpan.innerText = closeBracket + (isLast ? '' : ',');
                line.appendChild(bracketCloseSpan);
                item.appendChild(line);
            } else {
                const toggle = document.createElement('span');
                toggle.className = 'json-toggle';
                toggle.innerText = '▼';
                line.insertBefore(toggle, line.firstChild);

                const countSpan = document.createElement('span');
                countSpan.className = 'json-count';
                countSpan.innerText = isArray ? ` // ${keys.length} items` : ` // ${keys.length} fields`;
                line.appendChild(countSpan);

                item.appendChild(line);

                const childrenContainer = document.createElement('div');
                childrenContainer.className = 'json-children';

                keys.forEach((childKey, idx) => {
                    const isChildLast = idx === keys.length - 1;
                    childrenContainer.appendChild(
                        createNode(isArray ? null : childKey, value[childKey], isChildLast)
                    );
                });

                item.appendChild(childrenContainer);

                const closingLine = document.createElement('div');
                closingLine.className = 'json-closing-line';

                const bracketCloseSpan = document.createElement('span');
                bracketCloseSpan.className = 'json-bracket';
                bracketCloseSpan.innerText = closeBracket + (isLast ? '' : ',');
                closingLine.appendChild(bracketCloseSpan);
                item.appendChild(closingLine);

                toggle.onclick = (e) => {
                    e.stopPropagation();
                    if (toggle.classList.contains('expanded') || toggle.innerText === '▼') {
                        toggle.innerText = '▶';
                        childrenContainer.style.display = 'none';
                        closingLine.style.display = 'none';
                        countSpan.innerText = isArray ? ` [...] ${keys.length} items` : ` {...} ${keys.length} fields`;
                    } else {
                        toggle.innerText = '▼';
                        childrenContainer.style.display = 'block';
                        closingLine.style.display = 'block';
                        countSpan.innerText = isArray ? ` // ${keys.length} items` : ` // ${keys.length} fields`;
                    }
                };
            }
        } else {
            const valSpan = document.createElement('span');
            valSpan.className = `json-${typeof value}`;
            if (typeof value === 'string') {
                valSpan.innerText = `"${value}"` + (isLast ? '' : ',');
            } else {
                valSpan.innerText = String(value) + (isLast ? '' : ',');
            }
            line.appendChild(valSpan);
            item.appendChild(line);
        }

        const actionsContainer = document.createElement('span');
        actionsContainer.className = 'json-actions';
        
        const btnCopy = document.createElement('span');
        btnCopy.className = 'json-btn json-btn-copy';
        btnCopy.title = '复制该节点下的完整 JSON 数据';
        btnCopy.innerText = '📋';
        btnCopy.onclick = (e) => {
            e.stopPropagation();
            let copyText = "";
            if (key !== null) {
                const formattedVal = JSON.stringify(value, null, 4);
                if (typeof value === 'object' && value !== null) {
                    const indentedVal = formattedVal.split('\n').map((line, i) => i === 0 ? line : '    ' + line).join('\n');
                    copyText = `"${key}": ${indentedVal}`;
                } else {
                    copyText = `"${key}": ${formattedVal}`;
                }
            } else {
                copyText = JSON.stringify(value, null, 4);
            }
            navigator.clipboard.writeText(copyText).then(() => {
                showToast('✅ 节点数据已复制到剪贴板', '#10b981');
            });
        };
        actionsContainer.appendChild(btnCopy);
        line.appendChild(actionsContainer);

        return item;
    }

    root.appendChild(createNode(null, data, true));
    container.appendChild(root);
}

// ─── Interactive Editable JSON Tree Editor ───
let activeEditorMode = 'tree'; // 'tree' or 'raw'
let currentTreeEditorData = null;
let editingRule = null;

function setJsonByPath(obj, path, val) {
    if (path.length === 0) return;
    let current = obj;
    for (let i = 0; i < path.length - 1; i++) {
        current = current[path[i]];
    }
    current[path[path.length - 1]] = val;
}

function renameJsonKey(obj, path, newKey) {
    if (path.length === 0) return;
    let current = obj;
    for (let i = 0; i < path.length - 1; i++) {
        current = current[path[i]];
    }
    const oldKey = path[path.length - 1];
    if (current && typeof current === 'object' && oldKey in current) {
        const keys = Object.keys(current);
        const temp = {};
        for (const k of keys) {
            if (k === oldKey) {
                temp[newKey] = current[oldKey];
            } else {
                temp[k] = current[k];
            }
        }
        for (const k of keys) {
            delete current[k];
        }
        Object.assign(current, temp);
    }
}

function deleteParameterAtPath(obj, path) {
    if (path.length === 0) return;
    let current = obj;
    for (let i = 0; i < path.length - 1; i++) {
        current = current[path[i]];
    }
    const keyToDelete = path[path.length - 1];
    if (Array.isArray(current)) {
        const idx = parseInt(keyToDelete);
        if (!isNaN(idx)) {
            current.splice(idx, 1);
        }
    } else if (current && typeof current === 'object') {
        delete current[keyToDelete];
    }
    document.getElementById('rule-body').value = JSON.stringify(currentTreeEditorData, null, 4);
    renderTreeEditor();
}

function addSiblingAfterPath(obj, path) {
    let newKeyPath = null;
    if (path.length === 0) {
        if (Array.isArray(obj)) {
            obj.push("__BLANK_LINE__");
            newKeyPath = [obj.length - 1];
        } else {
            let newKey = "__BLANK_LINE__";
            while (newKey in obj) newKey += "_";
            obj[newKey] = "__BLANK_LINE__";
            newKeyPath = [newKey];
        }
    } else {
        let parent = obj;
        for (let i = 0; i < path.length - 1; i++) {
            parent = parent[path[i]];
        }
        const targetKey = path[path.length - 1];
        
        if (Array.isArray(parent)) {
            const index = parseInt(targetKey);
            parent.splice(index + 1, 0, "__BLANK_LINE__");
            newKeyPath = [...path.slice(0, -1), index + 1];
        } else {
            let newKey = "__BLANK_LINE__";
            while (newKey in parent) newKey += "_";
            
            const oldEntries = Object.entries(parent);
            for (let k in parent) delete parent[k];
            
            for (let [k, v] of oldEntries) {
                parent[k] = v;
                if (k === targetKey) {
                    parent[newKey] = "__BLANK_LINE__";
                }
            }
            newKeyPath = [...path.slice(0, -1), newKey];
        }
    }
    document.getElementById('rule-body').value = JSON.stringify(currentTreeEditorData, null, 4);
    window.nodePathToFocus = newKeyPath;
    renderTreeEditor();
}

function parseEditedValue(text, originalType) {
    if (originalType === 'number') {
        const num = Number(text);
        return isNaN(num) ? text : num;
    }
    if (originalType === 'boolean') {
        return text.trim().toLowerCase() === 'true';
    }
    if (originalType === 'object' && text === 'null') {
        return null;
    }
    return text;
}

function switchEditorMode(mode) {
    activeEditorMode = mode;
    const treeContainer = document.getElementById('rule-body-tree-container');
    const rawTextarea = document.getElementById('rule-body');
    const btnTree = document.getElementById('btn-edit-tree');
    const btnRaw = document.getElementById('btn-edit-raw');

    if (mode === 'tree') {
        treeContainer.style.visibility = 'visible';
        treeContainer.style.zIndex = '2';
        rawTextarea.style.visibility = 'hidden';
        rawTextarea.style.zIndex = '1';
        btnTree.classList.add('active');
        btnTree.style.background = 'var(--accent)';
        btnTree.style.color = 'white';
        btnRaw.classList.remove('active');
        btnRaw.style.background = 'transparent';
        btnRaw.style.color = 'var(--text-dim)';

        // Sync from textarea back to Tree
        try {
            const jsonStr = rawTextarea.value;
            currentTreeEditorData = JSON.parse(jsonStr);
            renderTreeEditor();
        } catch (e) {
            // If JSON is invalid, switch to raw mode
            showToast('⚠️ 当前内容不是合法的 JSON，已切回源码模式', '#f59e0b');
            setTimeout(() => switchEditorMode('raw'), 10);
            return;
        }
    } else {
        treeContainer.style.visibility = 'hidden';
        treeContainer.style.zIndex = '1';
        rawTextarea.style.visibility = 'visible';
        rawTextarea.style.zIndex = '2';
        btnRaw.classList.add('active');
        btnRaw.style.background = 'var(--accent)';
        btnRaw.style.color = 'white';
        btnTree.classList.remove('active');
        btnTree.style.background = 'transparent';
        btnTree.style.color = 'var(--text-dim)';
    }
}

function renderTreeEditor() {
    if (!currentTreeEditorData) return;
    const container = document.getElementById('rule-body-tree');
    renderEditableJsonView(container, currentTreeEditorData, (updatedData) => {
        // When edited in tree, update the raw textarea value
        document.getElementById('rule-body').value = JSON.stringify(updatedData, null, 4);
    });
}

function syncTextareaToTree() {
    try {
        const val = document.getElementById('rule-body').value;
        currentTreeEditorData = JSON.parse(val);
        renderTreeEditor();
        if (activeEditorMode === 'raw' && val && typeof currentTreeEditorData === 'object') {
            // 如果本来在raw且是合法json，可以选择不强制切回去，或者留给用户手动切
        }
    } catch (e) {
        // 如果不是合法的 JSON（例如流式请求），则强制切换到源码视图以显示真实数据
        if (activeEditorMode === 'tree') {
            switchEditorMode('raw');
        }
    }
}

function syncRawToTree() {
    if (activeEditorMode === 'tree') return;
    try {
        const val = document.getElementById('rule-body').value;
        currentTreeEditorData = JSON.parse(val);
    } catch (e) { }
}

function renderEditableJsonView(container, masterData, onChange) {
    container.innerHTML = '';
    const root = document.createElement('div');
    root.className = 'json-view-root';

    function createEditableNode(key, value, path, isLast) {
        const item = document.createElement('div');
        item.className = 'json-node';

        const line = document.createElement('div');
        line.className = 'json-line';

        const isBlankLine = (key && key.startsWith('__BLANK_LINE__')) || value === '__BLANK_LINE__';

        if (isBlankLine) {
            const blankInput = document.createElement('span');
            blankInput.className = 'json-blank-input';
            blankInput.contentEditable = "true";
            blankInput.style.minWidth = '150px';
            blankInput.style.display = 'inline-block';
            blankInput.style.borderBottom = '1px dashed #6b7280';
            blankInput.style.outline = 'none';
            blankInput.style.color = 'var(--text-main)';
            
            if (window.nodePathToFocus && JSON.stringify(path) === JSON.stringify(window.nodePathToFocus)) {
                setTimeout(() => blankInput.focus(), 10);
                window.nodePathToFocus = null;
            }

            blankInput.addEventListener('paste', (e) => {
                const pastedText = (e.clipboardData || window.clipboardData).getData('text');
                e.preventDefault();
                try {
                    let parsed = null;
                    let isKeyValue = false;
                    if (pastedText.match(/^\s*".+"\s*:/)) {
                        parsed = JSON.parse(`{${pastedText}}`);
                        isKeyValue = true;
                    } else {
                        parsed = JSON.parse(pastedText);
                    }
                    
                    if (isKeyValue) {
                        const newKey = Object.keys(parsed)[0];
                        const newVal = parsed[newKey];
                        if (key && key.startsWith('__BLANK_LINE__')) {
                            renameJsonKey(masterData, path, newKey);
                            setJsonByPath(masterData, [...path.slice(0, -1), newKey], newVal);
                        } else {
                            setJsonByPath(masterData, path, parsed);
                        }
                    } else {
                        if (key && key.startsWith('__BLANK_LINE__')) {
                            let genKey = "new_param";
                            renameJsonKey(masterData, path, genKey);
                            setJsonByPath(masterData, [...path.slice(0, -1), genKey], parsed);
                        } else {
                            setJsonByPath(masterData, path, parsed);
                        }
                    }
                    if (onChange) onChange(masterData);
                    renderTreeEditor();
                } catch (err) {
                    document.execCommand('insertText', false, pastedText);
                }
            });

            blankInput.onblur = () => {
                const text = blankInput.innerText.trim();
                if (!text) {
                    deleteParameterAtPath(masterData, path);
                    if (onChange) onChange(masterData);
                    renderTreeEditor();
                    return;
                }
                
                try {
                    let parsed = null;
                    let isKeyValue = false;
                    if (text.match(/^\s*".+"\s*:/)) {
                        parsed = JSON.parse(`{${text}}`);
                        isKeyValue = true;
                    } else {
                        parsed = JSON.parse(text);
                    }
                    
                    if (isKeyValue) {
                        const newKey = Object.keys(parsed)[0];
                        const newVal = parsed[newKey];
                        if (key && key.startsWith('__BLANK_LINE__')) {
                            renameJsonKey(masterData, path, newKey);
                            setJsonByPath(masterData, [...path.slice(0, -1), newKey], newVal);
                        } else {
                            setJsonByPath(masterData, path, parsed);
                        }
                    } else {
                        if (key && key.startsWith('__BLANK_LINE__')) {
                            let genKey = "new_param";
                            renameJsonKey(masterData, path, genKey);
                            setJsonByPath(masterData, [...path.slice(0, -1), genKey], parsed);
                        } else {
                            setJsonByPath(masterData, path, parsed);
                        }
                    }
                } catch (e) {
                    if (key && key.startsWith('__BLANK_LINE__')) {
                        renameJsonKey(masterData, path, text);
                        setJsonByPath(masterData, [...path.slice(0, -1), text], "");
                    } else {
                        setJsonByPath(masterData, path, text);
                    }
                }
                if (onChange) onChange(masterData);
                renderTreeEditor();
            };

            line.appendChild(blankInput);
            item.appendChild(line);
            return item;
        }

        const handlePaste = (e, isKey) => {
            const pastedText = (e.clipboardData || window.clipboardData).getData('text');
            try {
                let parsed = null;
                let isKeyValue = false;
                if (pastedText.match(/^\s*".+"\s*:/)) {
                    parsed = JSON.parse(`{${pastedText}}`);
                    isKeyValue = true;
                } else {
                    parsed = JSON.parse(pastedText);
                }
                
                e.preventDefault();
                if (isKeyValue) {
                    const newKey = Object.keys(parsed)[0];
                    const newVal = parsed[newKey];
                    if (isKey) {
                        renameJsonKey(masterData, path, newKey);
                        setJsonByPath(masterData, [...path.slice(0, -1), newKey], newVal);
                    } else {
                        setJsonByPath(masterData, path, parsed);
                    }
                } else {
                    if (isKey) return;
                    setJsonByPath(masterData, path, parsed);
                }
                if (onChange) onChange(masterData);
                renderTreeEditor();
            } catch (err) {}
        };

        // Render Key
        if (key !== null) {
            const quoteOpen = document.createElement('span');
            quoteOpen.className = 'json-bracket';
            quoteOpen.innerText = '"';
            line.appendChild(quoteOpen);

            const keySpan = document.createElement('span');
            keySpan.className = 'json-key-editable';
            keySpan.contentEditable = "true";
            keySpan.innerText = key;
            
            if (window.nodePathToFocus && JSON.stringify(path) === JSON.stringify(window.nodePathToFocus)) {
                setTimeout(() => {
                    keySpan.focus();
                    document.execCommand('selectAll', false, null);
                }, 10);
                window.nodePathToFocus = null;
            }

            keySpan.addEventListener('paste', (e) => handlePaste(e, true));

            keySpan.onblur = () => {
                const newKey = keySpan.innerText.trim();
                if (newKey && newKey !== key) {
                    renameJsonKey(masterData, path, newKey);
                    if (onChange) onChange(masterData);
                    renderTreeEditor();
                } else {
                    keySpan.innerText = key;
                }
            };
            line.appendChild(keySpan);

            const quoteClose = document.createElement('span');
            quoteClose.className = 'json-bracket';
            quoteClose.innerText = '": ';
            line.appendChild(quoteClose);
        }

        if (value === null) {
            const nullSpan = document.createElement('span');
            nullSpan.className = 'json-null editable-json-value';
            nullSpan.contentEditable = "true";
            nullSpan.innerText = 'null';

            nullSpan.onblur = () => {
                const newVal = nullSpan.innerText.trim() === 'null' ? null : nullSpan.innerText;
                setJsonByPath(masterData, path, newVal);
                if (onChange) onChange(masterData);
            };

            line.appendChild(nullSpan);

            const comma = document.createElement('span');
            comma.innerText = isLast ? '' : ',';
            line.appendChild(comma);

            item.appendChild(line);
        } else if (typeof value === 'object') {
            const isArray = Array.isArray(value);
            const openBracket = isArray ? '[' : '{';
            const closeBracket = isArray ? ']' : '}';

            const bracketOpenSpan = document.createElement('span');
            bracketOpenSpan.className = 'json-bracket';
            bracketOpenSpan.innerText = openBracket;
            line.appendChild(bracketOpenSpan);

            const keys = Object.keys(value);
            if (keys.length === 0) {
                const bracketCloseSpan = document.createElement('span');
                bracketCloseSpan.className = 'json-bracket';
                bracketCloseSpan.innerText = closeBracket + (isLast ? '' : ',');
                line.appendChild(bracketCloseSpan);
                item.appendChild(line);
            } else {
                const toggle = document.createElement('span');
                toggle.className = 'json-toggle';
                toggle.innerText = '▼';
                line.insertBefore(toggle, line.firstChild);

                const countSpan = document.createElement('span');
                countSpan.className = 'json-count';
                countSpan.innerText = isArray ? ` // ${keys.length} items` : ` // ${keys.length} fields`;
                line.appendChild(countSpan);

                item.appendChild(line);

                const childrenContainer = document.createElement('div');
                childrenContainer.className = 'json-children';

                keys.forEach((childKey, idx) => {
                    const isChildLast = idx === keys.length - 1;
                    const newPath = [...path, childKey];
                    childrenContainer.appendChild(
                        createEditableNode(isArray ? null : childKey, value[childKey], newPath, isChildLast)
                    );
                });

                item.appendChild(childrenContainer);

                const closingLine = document.createElement('div');
                closingLine.className = 'json-closing-line';

                const bracketCloseSpan = document.createElement('span');
                bracketCloseSpan.className = 'json-bracket';
                bracketCloseSpan.innerText = closeBracket + (isLast ? '' : ',');
                closingLine.appendChild(bracketCloseSpan);
                item.appendChild(closingLine);

                toggle.onclick = (e) => {
                    e.stopPropagation();
                    if (toggle.innerText === '▼') {
                        toggle.innerText = '▶';
                        childrenContainer.style.display = 'none';
                        closingLine.style.display = 'none';
                        countSpan.innerText = isArray ? ` [...] ${keys.length} items` : ` {...} ${keys.length} fields`;
                    } else {
                        toggle.innerText = '▼';
                        childrenContainer.style.display = 'block';
                        closingLine.style.display = 'block';
                        countSpan.innerText = isArray ? ` // ${keys.length} items` : ` // ${keys.length} fields`;
                    }
                };
            }
        } else {
            const originalType = typeof value;
            
            if (originalType === 'string') {
                const quoteOpen = document.createElement('span');
                quoteOpen.className = 'json-bracket';
                quoteOpen.innerText = '"';
                line.appendChild(quoteOpen);
            }

            const valSpan = document.createElement('span');
            valSpan.className = `json-${originalType} editable-json-value`;
            valSpan.contentEditable = "true";
            valSpan.innerText = typeof value === 'string' ? value : String(value);

            if (window.nodePathToFocus && key === null && JSON.stringify(path) === JSON.stringify(window.nodePathToFocus)) {
                setTimeout(() => {
                    valSpan.focus();
                    document.execCommand('selectAll', false, null);
                }, 10);
                window.nodePathToFocus = null;
            }

            valSpan.addEventListener('paste', (e) => handlePaste(e, false));

            valSpan.onblur = () => {
                const rawText = valSpan.innerText;
                const parsed = parseEditedValue(rawText, originalType);
                setJsonByPath(masterData, path, parsed);
                if (onChange) onChange(masterData);
            };

            line.appendChild(valSpan);

            if (originalType === 'string') {
                const quoteClose = document.createElement('span');
                quoteClose.className = 'json-bracket';
                quoteClose.innerText = '"';
                line.appendChild(quoteClose);
            }

            const comma = document.createElement('span');
            comma.innerText = isLast ? '' : ',';
            line.appendChild(comma);

            item.appendChild(line);
        }

        // Add advanced actions (＋ / ×) for parameter editing!
        const actionsContainer = document.createElement('span');
        actionsContainer.className = 'json-actions';

        const btnAdd = document.createElement('span');
        btnAdd.className = 'json-btn json-btn-add';
        btnAdd.title = '在此字段下方插入新字段';
        btnAdd.innerText = '＋';
        btnAdd.onclick = (e) => {
            e.stopPropagation();
            addSiblingAfterPath(masterData, path);
        };
        actionsContainer.appendChild(btnAdd);

        if (path.length > 0) {
            const btnDel = document.createElement('span');
            btnDel.className = 'json-btn json-btn-del';
            btnDel.title = '删除此参数';
            btnDel.innerText = '×';
            btnDel.onclick = (e) => {
                e.stopPropagation();
                deleteParameterAtPath(masterData, path);
            };
            actionsContainer.appendChild(btnDel);
        }

        const btnCopy = document.createElement('span');
        btnCopy.className = 'json-btn json-btn-copy';
        btnCopy.title = '复制该节点下的完整 JSON 数据';
        btnCopy.innerText = '📋';
        btnCopy.onclick = (e) => {
            e.stopPropagation();
            let copyText = "";
            if (key !== null) {
                const formattedVal = JSON.stringify(value, null, 4);
                if (typeof value === 'object' && value !== null) {
                    const indentedVal = formattedVal.split('\n').map((line, i) => i === 0 ? line : '    ' + line).join('\n');
                    copyText = `"${key}": ${indentedVal}`;
                } else {
                    copyText = `"${key}": ${formattedVal}`;
                }
            } else {
                copyText = JSON.stringify(value, null, 4);
            }
            navigator.clipboard.writeText(copyText).then(() => {
                showToast('✅ 节点数据已复制到剪贴板', '#10b981');
            });
        };
        actionsContainer.appendChild(btnCopy);

        if (actionsContainer.children.length > 0) {
            line.appendChild(actionsContainer);
        }

        return item;
    }

    root.appendChild(createEditableNode(null, masterData, [], true));
    container.appendChild(root);
}

function tryRenderJsonView(elementId, dataOrString) {
    const container = document.getElementById(elementId);
    if (!container) return;
    container.innerHTML = '';

    if (!dataOrString || (typeof dataOrString === 'object' && Object.keys(dataOrString).length === 0)) {
        container.innerText = '{}';
        return;
    }

    let jsonObj = null;
    if (typeof dataOrString === 'object') {
        jsonObj = dataOrString;
    } else {
        try {
            jsonObj = JSON.parse(dataOrString);
        } catch (e) {
            container.innerText = dataOrString;
            return;
        }
    }
    renderJsonView(container, jsonObj);
}

// ─── 选择抓包条目 ───
function selectLog(element, logId) {
    window.capturedLogsMap = window.capturedLogsMap || {};
    const log = window.capturedLogsMap[logId];
    if (!log) return;
    document.querySelectorAll('.log-item').forEach(el => el.classList.remove('active'));
    element.classList.add('active');

    currentSelectedLogId = log.id;

    // 💡 自动切换到“请求详情 & Mock 配置”选项卡
    const requestTabBtn = document.querySelector('.tab-btn[onclick*="request-tab"]');
    if (requestTabBtn) {
        switchTab('request-tab', requestTabBtn);
    }

    // 💡 自动切换到 Dashboard 视图，如果当前在 Logs 或 Analytics 下
    if (typeof currentSubTab !== 'undefined' && currentSubTab !== 'dashboard') {
        switchSubTab('dashboard');
    }

    // 显示详情视图并隐藏空状态
    document.getElementById('no-selection-state').style.display = 'none';
    document.getElementById('details-layout').style.display = 'grid';
    const selState = document.getElementById('selection-state');
    if(selState) selState.style.display = 'flex';

    // 默认展示响应详情 tab
    if (typeof switchDetailsSubTab === 'function') {
        switchDetailsSubTab('response');
    }

    // 提取并渲染当前请求的真实完整链接
    const originalUrl = log.proxy_real_url || log.headers?.['x-original-url'] || log.url;
    document.getElementById('inspect-req-url').innerText = originalUrl;
    document.getElementById('rule-original-url').value = originalUrl;

    // 自动填充 cURL Composer (发送器)
    if (window.fillComposerFromLog) {
        window.fillComposerFromLog(log, originalUrl);
    }

    // 渲染详情 (支持 Collapsible JSON Viewer!)
    tryRenderJsonView('inspect-req-headers', log.headers || {});
    tryRenderJsonView('inspect-query', log.query_params || {});
    tryRenderJsonView('inspect-body', log.body || {});

    // 渲染响应信息
    const respStatusBadge = document.getElementById('response-status-badge');
    tryRenderJsonView('inspect-resp-headers', log.response_headers || {});

    if (log.mock_matched) {
        respStatusBadge.className = 'mock-badge';
        respStatusBadge.innerText = `🟢 Mock 命中 (规则: ${log.mock_rule_name || '未命名'})`;
        tryRenderJsonView('inspect-response', log.mock_response || '{}');
    } else {
        respStatusBadge.className = 'mock-badge missed';
        respStatusBadge.innerText = `⚪ 真实透传响应 (${log.mock_status || 200})`;

        if (log.mock_response) {
            tryRenderJsonView('inspect-response', log.mock_response);
        } else {
            document.getElementById('inspect-response').innerText = '{\n  "info": "无响应数据"\n}';
        }
    }

    // 自动填充 Mock 规则表单
    document.getElementById('rule-method').value = log.method;
    document.getElementById('rule-pattern').value = log.path;
    if (document.getElementById('rule-match-params')) {
        document.getElementById('rule-match-params').value = '';
    }
    document.getElementById('rule-name').value = '捕获规则_' + (log.id % 1000);
    document.getElementById('rule-folder').value = '未分类';

    // 先尝试从本地已加载的 Mock 规则库中，根据 method + url_pattern (path) 匹配现有规则
    // 这样即使规则被禁用了（请求走透传未命中），用户点击日志时，也能精确还原和读取这个已禁用的 Mock 规则状态！
    let existingRule = null;
    if (log.mock_matched) {
        existingRule = globalRulesList.find(r => r.folder === log.mock_rule_folder && r.name === log.mock_rule_name);
    }
    if (!existingRule) {
        existingRule = globalRulesList.find(r => r.method === log.method && r.url_pattern === log.path);
    }

    let bodyVal = '';
    if (log.mock_response) {
        if (typeof log.mock_response === 'object') {
            bodyVal = JSON.stringify(log.mock_response, null, 4);
        } else {
            bodyVal = log.mock_response;
        }
    }

    // 智能检查是否是流式响应
    const isStream = (log.response_headers?.['content-type'] || log.response_headers?.['Content-Type'] || '').toLowerCase().includes('event-stream') ||
                     (log.headers?.['accept'] || log.headers?.['Accept'] || '').toLowerCase().includes('event-stream') ||
                     (bodyVal && (bodyVal.includes('event:') || bodyVal.includes('data:')));

    if (existingRule) {
        // 如果 mock 规则库中存在 mock 且匹配，在点击请求条目时，Mock 返回的 JSON 响应体需要使用 mock 的数据，不能使用响应体 (Response Body)
        // [用户修改]: 不再使用现有规则的 response_body，而是直接代入当前抓包的 Response Body
        document.getElementById('rule-folder').value = existingRule.folder || '未分类';
        document.getElementById('rule-name').value = existingRule.name || '';
        document.getElementById('rule-status').value = existingRule.status_code || 200;
        document.getElementById('rule-delay').value = existingRule.delay_ms || 0;
        document.getElementById('rule-stream').checked = existingRule.is_stream || isStream || false;
        
        if (bodyVal && bodyVal.trim()) {
            document.getElementById('rule-body').value = bodyVal;
        } else {
            document.getElementById('rule-body').value = typeof existingRule.response_body === 'object' ? JSON.stringify(existingRule.response_body, null, 4) : existingRule.response_body;
        }

        if (document.getElementById('rule-match-params')) {
            document.getElementById('rule-match-params').value = existingRule.match_params ? JSON.stringify(existingRule.match_params) : '';
        }
        editingRule = { folder: existingRule.folder || '未分类', name: existingRule.name || '' };
    } else if (log.mock_matched) {
        document.getElementById('rule-folder').value = log.mock_rule_folder || '未分类';
        document.getElementById('rule-name').value = log.mock_rule_name || '';
        document.getElementById('rule-status').value = log.mock_status || 200;
        document.getElementById('rule-delay').value = log.mock_delay || 0;
        document.getElementById('rule-stream').checked = isStream;
        document.getElementById('rule-body').value = bodyVal;
        if (document.getElementById('rule-match-params')) {
            document.getElementById('rule-match-params').value = log.mock_match_params ? JSON.stringify(log.mock_match_params) : '';
        }
        editingRule = { folder: log.mock_rule_folder || '未分类', name: log.mock_rule_name || '' };
    } else {
        // 没有任何已保存的 Mock 规则，则是纯透传请求，代入真实的响应体，便于快捷创建新 Mock！
        document.getElementById('rule-status').value = log.status || 200;
        document.getElementById('rule-delay').value = 0;
        document.getElementById('rule-stream').checked = isStream;
        if (bodyVal && bodyVal.trim()) {
            document.getElementById('rule-body').value = bodyVal;
        } else {
            document.getElementById('rule-body').value = JSON.stringify({
                code: 200,
                data: {}
            }, null, 4);
        }
        editingRule = null;
    }

    if (isStream) {
        // 流式响应强制切换到源码模式，避免 JSON 解析失败导致界面卡死
        switchEditorMode('raw');
    } else {
        // 默认尝试切换到树编辑模式，如果是无效 JSON，switchEditorMode 内部会自动降级回 raw 模式
        switchEditorMode('tree');
    }
}

// ─── 一键导入左侧真实捕获到的响应体 ───
function importRealResponse() {
    if (!currentSelectedLogId || !window.capturedLogsMap) {
        showToast('⚠️ 请先在左侧选择一个抓包请求！', '#f59e0b');
        return;
    }
    const log = window.capturedLogsMap[currentSelectedLogId];
    if (!log) return;
    
    let bodyVal = '';
    if (log.mock_response) {
        if (typeof log.mock_response === 'object') {
            bodyVal = JSON.stringify(log.mock_response, null, 4);
        } else {
            bodyVal = log.mock_response;
        }
    }
    
    document.getElementById('rule-body').value = bodyVal;
    
    // 智能检查导入内容是否为流式响应
    const isStream = (log.response_headers?.['content-type'] || log.response_headers?.['Content-Type'] || '').toLowerCase().includes('event-stream') ||
                     (log.headers?.['accept'] || log.headers?.['Accept'] || '').toLowerCase().includes('event-stream') ||
                     (bodyVal && (bodyVal.includes('event:') || bodyVal.includes('data:')));
                     
    if (isStream) {
        document.getElementById('rule-stream').checked = true;
        switchEditorMode('raw');
        showToast('📥 已成功导入流式响应，并自动开启流式开关与源码模式！', '#10b981');
    } else {
        switchEditorMode('tree');
        showToast('📥 已成功将真实响应体导入到右侧 Mock 编辑器！', '#10b981');
    }
}


// ─── 保存规则 ───
async function saveRule() {
    // 根据要求：保存 mock 规则后，开关强制变成开启状态
    let ruleEnabledVal = true;

    let matchParams = null;
    const matchParamsEl = document.getElementById('rule-match-params');
    if (matchParamsEl) {
        const matchParamsStr = matchParamsEl.value.trim();
        if (matchParamsStr) {
            if (matchParamsStr.startsWith('{')) {
                try {
                    matchParams = JSON.parse(matchParamsStr);
                } catch(e) {
                    showToast('⚠️ Match Params 格式错误，需为有效的 JSON 或 key=value', '#ef4444');
                    return;
                }
            } else {
                matchParams = {};
                matchParamsStr.split('&').forEach(pair => {
                    const [k, v] = pair.split('=');
                    if (k) matchParams[k.trim()] = v ? v.trim() : '';
                });
            }
        }
    }

    const rule = {
        folder: document.getElementById('rule-folder').value.trim() || '未分类',
        name: document.getElementById('rule-name').value.trim(),
        method: document.getElementById('rule-method').value,
        url_pattern: document.getElementById('rule-pattern').value.trim(),
        status_code: parseInt(document.getElementById('rule-status').value),
        response_body: document.getElementById('rule-body').value,
        enabled: ruleEnabledVal,
        delay_ms: parseInt(document.getElementById('rule-delay').value) || 0,
        is_stream: document.getElementById('rule-stream').checked,
        match_params: matchParams
    };

    if (!rule.name || rule.name === 'undefined' || rule.name === 'null' || !rule.url_pattern || rule.url_pattern === 'undefined') {
        showToast('⚠️ 请填写有效规则名称和匹配 URL 路径！', '#f59e0b');
        return;
    }

    // 如果正在编辑现有规则且仅改变了分类（Name不变），则自动删除旧文件实现移动。
    // 如果改变了 Rule Name，无论是否改变分类，都保留旧文件（作为另存为新规则）。
    if (editingRule && editingRule.folder !== rule.folder && editingRule.name === rule.name) {
        try {
            await fetch(`/api/rules?folder=${encodeURIComponent(editingRule.folder)}&name=${encodeURIComponent(editingRule.name)}`, {
                method: 'DELETE'
            });
        } catch (e) {
            console.error("Failed to cleanup legacy rule file", e);
        }
    }

    try {
        const res = await fetch('/api/rules', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(rule)
        });

        if (res.ok) {
            const data = await res.json();
            
            if (data.status === 'prompt_conflict') {
                const confirmOverwrite = confirm(`发现相同 Path 和 Matching Params 的规则：[${data.conflict_folder}] ${data.conflict_name}。\n\n点击【确定】将覆盖该规则。\n点击【取消】将另存为新规则。`);
                if (confirmOverwrite) {
                    rule.overwrite_rule_name = data.conflict_name;
                    rule.overwrite_rule_folder = data.conflict_folder;
                } else {
                    rule.force_new = true;
                }
                
                const res2 = await fetch('/api/rules', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(rule)
                });
                const data2 = await res2.json();
                if (data2.status === 'success') {
                    handleSaveSuccess(data2, rule);
                } else {
                    showToast(data2.message || '保存失败', '#ef4444');
                }
                return;
            }
            
            if (data.status === 'success') {
                handleSaveSuccess(data, rule);
            } else {
                showToast(data.message || '保存失败', '#ef4444');
            }
        } else {
            showToast('❌ 保存失败', '#ef4444');
        }
    } catch (e) {
        showToast('❌ 网络错误', '#ef4444');
    }
}

// ─── Mock 配置抽屉 ───
function openMockDrawer() {
    document.getElementById('mock-config-drawer').classList.add('drawer-open');
    document.getElementById('mock-drawer-overlay').style.display = 'block';
    // 延迟添加 active 以触发过渡动画
    setTimeout(() => {
        document.getElementById('mock-drawer-overlay').classList.add('active');
    }, 10);
}

function closeMockDrawer() {
    document.getElementById('mock-drawer-overlay').classList.remove('active');
    document.getElementById('mock-config-drawer').classList.remove('drawer-open');
    // 等待过渡动画结束后隐藏 overlay
    setTimeout(() => {
        document.getElementById('mock-drawer-overlay').style.display = 'none';
    }, 300);
}

function handleSaveSuccess(data, rule) {
    if (data.new_name && data.new_name !== rule.name) {
        rule.name = data.new_name;
        document.getElementById('rule-name').value = rule.name;
        showToast(`✅ 已自动新建规则：${rule.name} (避免覆盖原有参数不同的规则)`);
    } else {
        showToast('✅ Mock 规则保存成功！');
    }
    editingRule = { folder: rule.folder, name: rule.name }; // 更新当前编辑指向
    loadRules();
    closeMockDrawer(); // 保存成功后自动关闭抽屉
}

let globalRulesList = []; // 全局规则索引列表

// ─── 获取 Mock 规则库并渲染 ───
async function loadRules() {
    try {
        const res = await fetch('/api/rules');
        const tree = await res.json();
        const container = document.getElementById('rules-tree');
        const totalRules = Object.values(tree).reduce((acc, curr) => acc + curr.length, 0);
        document.getElementById('rules-badge').innerText = totalRules;

        globalRulesList = []; // 重置全局缓存

        if (totalRules === 0) {
            container.innerHTML = `
                        <div class="empty-state">
                            <div class="icon">🗂️</div>
                            暂无已保存的 Mock 规则<br>
                            <span style="font-size: 11px; color: var(--text-dim);">可以在左侧抓包记录中选中条目，快捷保存至规则库中</span>
                        </div>`;
            return;
        }

        container.innerHTML = '';
        for (let folder in tree) {
            const folderDiv = document.createElement('div');
            folderDiv.className = 'folder-group';

            let rulesHtml = '';
            tree[folder].forEach(rule => {
                const isEnabled = rule.enabled !== false;
                const ruleIndex = globalRulesList.length;
                globalRulesList.push(rule);

                rulesHtml += `
                            <div class="rule-card" style="${isEnabled ? '' : 'opacity: 0.6; border-left: 3px solid #ef4444;'}" onclick="loadRuleByIndex(${ruleIndex})">
                                <div class="rule-card-meta">
                                    <span class="rule-name">📄 ${rule.name}</span>
                                    <div style="display: flex; align-items: center; gap: 10px;" onclick="event.stopPropagation()">
                                        <span class="method ${rule.method}">${rule.method}</span>
                                        <label class="switch" title="${isEnabled ? '已启用该规则 - 点击禁用' : '已禁用该规则 - 点击启用'}">
                                            <input type="checkbox" ${isEnabled ? 'checked' : ''} onchange="toggleRuleByIndexEnabled(${ruleIndex}, this.checked)">
                                            <span class="slider"></span>
                                        </label>
                                        <button class="btn-sm btn-clear" style="padding: 2px 6px; color: var(--accent); border-color: rgba(99, 102, 241, 0.2); background: rgba(99, 102, 241, 0.05);" onclick="loadRuleByIndex(${ruleIndex})" title="编辑此规则">✏️ 编辑</button>
                                        <button class="btn-sm btn-clear" style="padding: 2px 6px; color: var(--red); border-color: rgba(239, 68, 68, 0.2); background: rgba(239, 68, 68, 0.05);" onclick="deleteRule('${encodeURIComponent(rule.folder)}', '${encodeURIComponent(rule.name)}')" title="删除此规则">🗑️ 删除</button>
                                    </div>
                                </div>
                                <div class="rule-pattern">${rule.url_pattern}</div>
                            </div>
                        `;
            });

            folderDiv.innerHTML = `
                        <div class="folder-header" style="display: flex; align-items: center; justify-content: space-between; padding: 6px 12px; background: var(--surface2); border-radius: 6px; margin-bottom: 8px;">
                            <span style="font-weight: 700; color: var(--text); font-size: 13px;">📁 ${folder}</span>
                            <div style="display: flex; gap: 8px;">
                                <button class="btn-sm btn-clear" style="padding: 2px 8px; font-size: 11px; border-color: rgba(99, 102, 241, 0.2); color: var(--accent);" onclick="renameCategory('${encodeURIComponent(folder)}')" title="重命名此分类">📝 重命名</button>
                                <button class="btn-sm btn-clear" style="padding: 2px 8px; font-size: 11px; border-color: rgba(239, 68, 68, 0.2); color: var(--red); background: rgba(239, 68, 68, 0.05);" onclick="deleteCategory('${encodeURIComponent(folder)}')" title="删除此分类">🗑️ 删除</button>
                            </div>
                        </div>
                        ${rulesHtml}
                    `;
            container.appendChild(folderDiv);
        }
    } catch (e) { }
}

// ─── 重命名分类 ───
async function renameCategory(encodedFolder) {
    const oldName = decodeURIComponent(encodedFolder);
    const newName = prompt(`请输入分类 "${oldName}" 的新名字:`, oldName);
    if (!newName || !newName.trim() || newName.trim() === oldName) return;

    try {
        const res = await fetch(`/api/categories?old_name=${encodeURIComponent(oldName)}&new_name=${encodeURIComponent(newName.trim())}`, {
            method: 'PUT'
        });

        if (res.ok) {
            showToast('✅ 分类重命名成功！');
            loadRules();
        } else {
            const data = await res.json();
            showToast(`❌ 重命名失败: ${data.message || '未知错误'}`, '#ef4444');
        }
    } catch (e) {
        showToast('❌ 网络错误', '#ef4444');
    }
}

// ─── 删除分类 ───
async function deleteCategory(encodedFolder) {
    const folder = decodeURIComponent(encodedFolder);
    if (!confirm(`确定要删除分类 "${folder}" 及其下的所有 Mock 规则吗？此操作无法撤销！`)) return;

    try {
        const res = await fetch(`/api/categories?name=${encodeURIComponent(folder)}`, {
            method: 'DELETE'
        });

        if (res.ok) {
            showToast('🗑️ 分类已成功删除！');
            loadRules();
        } else {
            const data = await res.json();
            showToast(`❌ 删除失败: ${data.message || '未知错误'}`, '#ef4444');
        }
    } catch (e) {
        showToast('❌ 网络错误，删除失败', '#ef4444');
    }
}

// ─── 删除 Mock 规则 ───
async function deleteRule(encodedFolder, encodedName) {
    const folder = decodeURIComponent(encodedFolder);
    const name = decodeURIComponent(encodedName);

    if (!confirm(`确定要删除规则 "${name}" 吗？`)) return;

    try {
        const res = await fetch(`/api/rules?folder=${encodeURIComponent(folder)}&name=${encodeURIComponent(name)}`, {
            method: 'DELETE'
        });

        if (res.ok) {
            showToast('🗑️ 规则已成功删除！');
            loadRules();
        } else {
            const data = await res.json();
            showToast(`❌ 删除失败: ${data.message || '未知错误'}`, '#ef4444');
        }
    } catch (e) {
        showToast('❌ 网络错误，删除失败', '#ef4444');
    }
}

// ─── 按索引加载/切换状态 ───
function loadRuleByIndex(index) {
    const rule = globalRulesList[index];
    if (rule) {
        loadRuleToConfig(rule);
    }
}

async function toggleRuleByIndexEnabled(index, isChecked) {
    const rule = globalRulesList[index];
    if (rule) {
        await toggleRuleEnabled(rule, isChecked);
    }
}

// ─── 切换单条规则的启用状态 ───
async function toggleRuleEnabled(rule, isChecked) {
    rule.enabled = isChecked;
    try {
        const res = await fetch('/api/rules', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(rule)
        });
        if (res.ok) {
            showToast(isChecked ? '🟢 规则已启用' : '🔴 规则已禁用');
            loadRules();
        } else {
            showToast('❌ 修改状态失败', '#ef4444');
        }
    } catch (e) {
        showToast('❌ 网络错误', '#ef4444');
    }
}

// ─── 点击规则库中的卡片，快捷加载至配置页 ───
function loadRuleToConfig(rule) {
    switchTab('request-tab', document.querySelector('.tab-btn:first-child'));

    document.getElementById('no-selection-state').style.display = 'none';
    document.getElementById('details-layout').style.display = 'grid';
    const selState = document.getElementById('selection-state');
    if(selState) selState.style.display = 'flex';

    // 填充表单
    document.getElementById('rule-folder').value = rule.folder;
    document.getElementById('rule-name').value = rule.name;
    document.getElementById('rule-method').value = rule.method;
    document.getElementById('rule-pattern').value = rule.url_pattern;
    if (document.getElementById('rule-match-params')) {
        let matchParamsStr = '';
        if (rule.match_params) {
            matchParamsStr = JSON.stringify(rule.match_params);
        }
        document.getElementById('rule-match-params').value = matchParamsStr;
    }
    document.getElementById('rule-status').value = rule.status_code;
    document.getElementById('rule-delay').value = rule.delay_ms || 0;
    document.getElementById('rule-stream').checked = rule.is_stream || false;
    document.getElementById('rule-body').value = rule.response_body;

    // 未发起抓包时设置链接提示
    document.getElementById('inspect-req-url').innerText = '未发起抓包请求 (请发起客户端请求以获取真实链接)';
    document.getElementById('rule-original-url').value = '未发起抓包请求 (请发起客户端请求以获取真实链接)';

    // 空白响应区域渲染
    const respStatusBadge = document.getElementById('response-status-badge');
    respStatusBadge.className = 'mock-badge';
    respStatusBadge.innerText = `🟢 规则库已加载 (规则: ${rule.name})`;

    // 渲染详情 (Collapsible JSON Viewer!)
    tryRenderJsonView('inspect-req-headers', { "info": "已从 Mock 规则库加载规则模板，请发起真实请求抓包以观察客户端 Headers。" });
    tryRenderJsonView('inspect-query', { "info": "查询参数仅在客户端发起真实请求时可捕获。" });
    tryRenderJsonView('inspect-body', { "info": "请求体仅在客户端发起真实请求时可捕获。" });
    tryRenderJsonView('inspect-resp-headers', {
        "Content-Type": "application/json",
        "X-Mock-Engine": "XiaoMaoMockServer",
        "info": "这是 Mock 生效时后台预设的常规响应头。"
    });
    tryRenderJsonView('inspect-response', rule.response_body);

    editingRule = { folder: rule.folder, name: rule.name };
    syncTextareaToTree();
}

// ─── 方案切换 (公网 vs 局域网) ───
function toggleScheme(schemeNum) {
    const btnPublic = document.getElementById('scheme2-btn');
    const btnLAN = document.getElementById('scheme1-btn');
    const qrLAN = document.getElementById('qr-section-lan');
    const qrPublic = document.getElementById('public-qr-card');
    const publicGuide = document.getElementById('public-guide-box');
    const lanGuide = document.getElementById('lan-guide-box');

    if (schemeNum === 1) {
        // 激活 方案一：公网扫码直连
        if (btnPublic) {
            btnPublic.style.borderColor = 'var(--accent)';
            btnPublic.style.background = 'var(--surface2)';
            btnPublic.style.color = 'var(--accent)';
        }

        if (btnLAN) {
            btnLAN.style.borderColor = 'var(--border)';
            btnLAN.style.background = 'transparent';
            btnLAN.style.color = 'var(--text-dim)';
        }

        if (qrPublic) qrPublic.style.display = 'block';
        if (qrLAN) qrLAN.style.display = 'none';
        if (publicGuide) publicGuide.style.display = 'block';
        if (lanGuide) lanGuide.style.display = 'none';
    } else {
        // 激活 方案二：局域网扫码直连
        if (btnLAN) {
            btnLAN.style.borderColor = 'var(--accent)';
            btnLAN.style.background = 'var(--surface2)';
            btnLAN.style.color = 'var(--accent)';
        }

        if (btnPublic) {
            btnPublic.style.borderColor = 'var(--border)';
            btnPublic.style.background = 'transparent';
            btnPublic.style.color = 'var(--text-dim)';
        }

        qrLAN.style.display = 'block';
        qrPublic.style.display = 'none';
        if (publicGuide) publicGuide.style.display = 'none';
        if (lanGuide) lanGuide.style.display = 'block';
    }
}

// ─── 复制文本工具函数 ───
function copyText(elementId, isInput = false) {
    const element = document.getElementById(elementId);
    if (!element) return;
    const textToCopy = isInput ? element.value : element.innerText;
    if (!textToCopy || textToCopy.startsWith('未发起抓包请求') || textToCopy.startsWith('查询参数仅在') || textToCopy.startsWith('已从 Mock')) {
        showToast('⚠️ 无可复制的内容', '#eab308');
        return;
    }
    navigator.clipboard.writeText(textToCopy).then(() => {
        showToast('📋 链接复制成功', '#10b981');
    }).catch(err => {
        // 浏览器不支持或无权限时的 execCommand 兜底
        const textarea = document.createElement('textarea');
        textarea.value = textToCopy;
        document.body.appendChild(textarea);
        textarea.select();
        try {
            document.execCommand('copy');
            showToast('📋 链接复制成功', '#10b981');
        } catch (e) {
            showToast('❌ 复制失败', '#ef4444');
        }
        document.body.removeChild(textarea);
    });
}

// ─── 全局轻提示 ───
function showToast(msg, color) {
    const toast = document.getElementById('toast');
    toast.innerText = msg;
    toast.style.background = color || '#10b981';
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
}

// ═══════════════════════════════════════════════════════════
// ─── AI 智能生成 JSON 功能模块 ───
// ═══════════════════════════════════════════════════════════

// 各服务商模型列表
const AI_MODELS = {
    deepseek: ['deepseek-chat', 'deepseek-reasoner'],
    claude: ['claude-opus-4-5', 'claude-sonnet-4-5', 'claude-haiku-3-5', 'claude-3-7-sonnet-latest', 'claude-3-5-haiku-latest'],
    openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    custom: []
};

// 各服务商默认 API 地址
const AI_ENDPOINTS = {
    deepseek: 'https://api.deepseek.com/v1/chat/completions',
    claude: 'https://api.anthropic.com/v1/messages',
    openai: 'https://api.openai.com/v1/chat/completions',
    custom: ''
};

// 当前 AI 生成的原始文本
let aiGeneratedText = '';
let aiIsStreaming = false;
let aiAbortController = null;

// ─── 初始化：读取并恢复 AI 配置 ───
async function initAIConfig() {
    let cfg = loadAIConfig();

    // 尝试从服务器端拉取配置作为同步或备份
    try {
        const res = await fetch('/api/ai-config');
        if (res.ok) {
            const serverCfg = await res.json();
            if (serverCfg && serverCfg.apiKey) {
                // 如果服务器端有有效配置，以服务器端为准，并更新本地 local storage
                cfg = serverCfg;
                saveAIConfigToStorage(cfg);
            } else if (cfg && cfg.apiKey) {
                // 如果本地有但服务器端没有，主动推送到服务器端
                await fetch('/api/ai-config', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(cfg)
                });
            }
        }
    } catch (err) {
        console.warn('Sync AI config with server failed:', err);
    }

    const badge = document.getElementById('ai-key-status-badge');
    if (badge) {
        if (cfg.apiKey) {
            badge.textContent = '已配置';
            badge.className = 'ai-key-status set';
        } else {
            badge.textContent = '未配置';
            badge.className = 'ai-key-status notset';
        }
    }
    if (typeof updateGlobalAIBadge === 'function') {
        updateGlobalAIBadge();
    }
}

function loadAIConfig() {
    try {
        return JSON.parse(localStorage.getItem('xiaomaomock_ai_cfg') || '{}');
    } catch { return {}; }
}

function saveAIConfigToStorage(cfg) {
    localStorage.setItem('xiaomaomock_ai_cfg', JSON.stringify(cfg));
}

// ─── 打开 AI 设置弹窗 ───
function openAISettings() {
    const cfg = loadAIConfig();
    const providerSel = document.getElementById('ai-provider-select');
    const keyInput = document.getElementById('ai-api-key-input');
    const epInput = document.getElementById('ai-custom-endpoint');
    const cookieInput = document.getElementById('ai-cookie-input');

    providerSel.value = cfg.provider || 'deepseek';
    keyInput.value = cfg.apiKey || '';
    epInput.value = cfg.endpoint || '';
    if (cookieInput) {
        cookieInput.value = cfg.aiCookie || '';
    }

    onAIProviderChange(); // 刷新模型列表

    const modelInput = document.getElementById('ai-model-input');
    if (cfg.model) {
        modelInput.value = cfg.model;
    }

    document.getElementById('ai-settings-modal').classList.add('open');
}

function closeAISettings() {
    document.getElementById('ai-settings-modal').classList.remove('open');
}

// ─── 服务商切换时更新模型列表 ───
function onAIProviderChange() {
    const provider = document.getElementById('ai-provider-select').value;
    const datalist = document.getElementById('ai-models-list');
    const modelInput = document.getElementById('ai-model-input');
    const epGroup = document.getElementById('ai-custom-endpoint-group');

    const models = AI_MODELS[provider] || [];
    datalist.innerHTML = '';

    if (models.length > 0) {
        models.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m;
            datalist.appendChild(opt);
        });

        // 如果当前没有输入值，或者当前值不在新列表里，默认选第一个
        if (!modelInput.value || (provider !== 'custom' && !models.includes(modelInput.value))) {
            modelInput.value = models[0];
        }
        modelInput.placeholder = "选择或输入模型名...";
    } else {
        modelInput.placeholder = "例如：gpt-4o";
        if (provider === 'custom') modelInput.value = '';
    }
    epGroup.style.display = (provider === 'custom') ? 'block' : 'none';
}

// ─── 显示/隐藏 Key ───
function toggleAIKeyVisibility() {
    const inp = document.getElementById('ai-api-key-input');
    inp.type = (inp.type === 'password') ? 'text' : 'password';
}

// ─── 保存 AI 设置 ───
async function saveAISettings() {
    const provider = document.getElementById('ai-provider-select').value;
    let model = document.getElementById('ai-model-input').value.trim();
    const apiKey = document.getElementById('ai-api-key-input').value.trim();
    const endpoint = document.getElementById('ai-custom-endpoint').value.trim();
    const cookieInput = document.getElementById('ai-cookie-input');
    const aiCookie = cookieInput ? cookieInput.value.trim() : '';

    if (!model) {
        const models = AI_MODELS[provider] || [];
        model = models.length > 0 ? models[0] : 'gpt-3.5-turbo';
    }

    if (!apiKey) {
        showToast('⚠️ 请输入 API Key', '#f59e0b');
        return;
    }
    
    const cfg = { provider, model, apiKey, endpoint, aiCookie };
    saveAIConfigToStorage(cfg);
    
    try {
        await fetch('/api/ai-config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(cfg)
        });
    } catch (err) {
        console.warn('Save AI config to server failed:', err);
    }
    
    await initAIConfig();
    closeAISettings();
    showToast('✅ AI 配置已保存！');
}

let aiMode = 'generate';
let activeModelLang = 'Swift';
let aiModelCodeText = '';

// ─── 根据不同的模式设定 UI 元素 ───
function setupAIModal() {
    const cfg = loadAIConfig();
    if (!cfg.apiKey) {
        showToast('⚠️ 请先点击右上角「⚙️ AI 设置」配置 API Key', '#f59e0b');
        openAISettings();
        return;
    }

    const titleEl = document.querySelector('#ai-generate-modal .ai-modal-title');
    const subTitleEl = document.querySelector('#ai-generate-modal .ai-modal-subtitle');
    const textareaEl = document.getElementById('ai-prompt-input');
    const submitBtn = document.getElementById('ai-gen-submit-btn');

    const settingsBtnHtml = `<button class="ai-provider-tag" style="cursor: pointer; border: 1px solid var(--border); background: var(--surface2); color: var(--text-muted); padding: 2px 6px; margin-left: 8px;" onclick="openAISettings()" title="编辑 AI 配置">⚙️</button>`;

    if (aiMode === 'generate') {
        titleEl.innerHTML = `🌟 AI 智能生成 JSON <span id="ai-gen-provider-tag" class="ai-provider-tag tag-deepseek">DeepSeek</span>` + settingsBtnHtml;
        subTitleEl.textContent = '用一句话描述你想要的数据结构，AI 将自动生成并填入编辑器。';
        textareaEl.placeholder = '例如：帮我生成5条商品列表，包含商品名、价格（10~100元）、库存数量，外层包含 code:200 和 data 字段';
        textareaEl.value = '';
        submitBtn.textContent = '🚀 开始生成';
    } else if (aiMode === 'mutate') {
        titleEl.innerHTML = `💥 AI 异常数据变异 <span id="ai-gen-provider-tag" class="ai-provider-tag tag-deepseek">DeepSeek</span>` + settingsBtnHtml;
        subTitleEl.textContent = '将当前编辑器中的数据转换成适合测试客户端容错的边界异常数据。';
        textareaEl.placeholder = '（可选）输入特定的变异要求，例如：只把里面的价格相关的数字设为负数，或者把状态设为 null';
        textareaEl.value = '';
        submitBtn.textContent = '💥 开始变异';
    } else if (aiMode === 'repair') {
        titleEl.innerHTML = `🔧 AI 语法纠错与修复 <span id="ai-gen-provider-tag" class="ai-provider-tag tag-deepseek">DeepSeek</span>` + settingsBtnHtml;
        subTitleEl.textContent = 'AI 自动诊断并修复当前编辑器中损坏或格式错误的文本/JSON。';
        textareaEl.placeholder = '（可选）输入额外处理指令，例如：顺便把所有 key 的下划线改为驼峰命名';
        textareaEl.value = '';
        submitBtn.textContent = '🔧 开始修复';
    }

    // 更新弹窗 Provider 标签
    const tag = document.getElementById('ai-gen-provider-tag');
    const tagClasses = { deepseek: 'tag-deepseek', claude: 'tag-claude', openai: 'tag-openai', custom: 'tag-openai' };
    const tagNames = { deepseek: 'DeepSeek', claude: 'Claude', openai: 'OpenAI', custom: '自定义' };
    tag.className = `ai-provider-tag ${tagClasses[cfg.provider] || 'tag-deepseek'}`;
    tag.textContent = (tagNames[cfg.provider] || '自定义') + ' · ' + (cfg.model || '');

    // 重置状态
    document.getElementById('ai-stream-section').style.display = 'none';
    document.getElementById('ai-stream-preview').textContent = '';
    document.getElementById('ai-gen-fill-btn').style.display = 'none';
    submitBtn.style.display = 'inline-flex';
    submitBtn.disabled = false;
    document.getElementById('ai-gen-status').textContent = '';
    aiGeneratedText = '';

    document.getElementById('ai-generate-modal').classList.add('open');
    setTimeout(() => textareaEl.focus(), 100);
}

// ─── 打开 AI 生成弹窗 ───
function openAIGenerate() {
    aiMode = 'generate';
    setupAIModal();
}

// ─── 触发异常变异 ───
function runAIMutate() {
    const originalJson = document.getElementById('rule-body').value.trim();
    if (!originalJson) {
        showToast('⚠️ 当前 Mock 编辑器内容为空，无法进行异常变异！', '#f59e0b');
        return;
    }
    aiMode = 'mutate';
    setupAIModal();
}

// ─── 触发语法修复 ───
function runAIRepair() {
    const originalJson = document.getElementById('rule-body').value.trim();
    if (!originalJson) {
        showToast('⚠️ 当前 Mock 编辑器内容为空，无法进行语法纠错！', '#f59e0b');
        return;
    }
    aiMode = 'repair';
    setupAIModal();
}

function closeAIGenerate() {
    if (aiAbortController) { aiAbortController.abort(); aiAbortController = null; }
    document.getElementById('ai-generate-modal').classList.remove('open');
}

// ─── AI 预览视图切换 ───
window.switchAIPreviewTab = function(tab) {
    const tabsContainer = document.getElementById('ai-preview-tabs');
    if (!tabsContainer) return;
    
    // Update active style
    const buttons = tabsContainer.querySelectorAll('button');
    buttons.forEach(btn => {
        if ((tab==='json' && btn.innerText.includes('JSON')) ||
            (tab==='diff' && btn.innerText.includes('Diff')) ||
            (tab==='raw' && btn.innerText.includes('源码'))) {
            btn.classList.add('active');
            btn.style.borderColor = 'var(--accent)';
            btn.style.color = 'var(--accent)';
            btn.style.background = 'var(--surface)';
        } else {
            btn.classList.remove('active');
            btn.style.borderColor = 'var(--border)';
            btn.style.color = 'var(--text)';
            btn.style.background = 'var(--surface2)';
        }
    });

    const previewEl = document.getElementById('ai-stream-preview');
    previewEl.innerHTML = ''; 

    const originalText = window.aiOriginalText || '';
    const newText = window.aiFinalResultText || '';

    if (tab === 'json') {
        if (window.tryRenderJsonView) {
            window.tryRenderJsonView('ai-stream-preview', newText);
        } else {
            previewEl.innerText = newText;
        }
    } else if (tab === 'diff') {
        if (!window.Diff) {
            previewEl.innerText = "Diff 库加载失败";
            return;
        }
        let oText = originalText;
        let nText = newText;
        try { oText = JSON.stringify(JSON.parse(oText), null, 4); } catch(e) {}
        try { nText = JSON.stringify(JSON.parse(nText), null, 4); } catch(e) {}
        
        const diff = Diff.diffLines(oText, nText);
        const fragment = document.createDocumentFragment();
        diff.forEach((part) => {
            if (!part.value) return;
            const span = document.createElement('span');
            span.style.display = 'block';
            span.style.whiteSpace = 'pre-wrap';
            span.style.fontFamily = "'JetBrains Mono', monospace";
            if (part.added) {
                span.style.backgroundColor = 'rgba(16, 185, 129, 0.15)'; 
                span.style.color = '#059669';
                span.innerText = '+ ' + part.value.replace(/\n$/,'').replace(/\n/g, '\n+ ') + '\n';
            } else if (part.removed) {
                span.style.backgroundColor = 'rgba(239, 68, 68, 0.15)'; 
                span.style.color = '#dc2626';
                span.innerText = '- ' + part.value.replace(/\n$/,'').replace(/\n/g, '\n- ') + '\n';
                span.style.textDecoration = 'line-through';
            } else {
                span.style.color = 'var(--text)';
                span.innerText = '  ' + part.value.replace(/\n$/,'').replace(/\n/g, '\n  ') + '\n';
            }
            fragment.appendChild(span);
        });
        previewEl.appendChild(fragment);
    } else if (tab === 'raw') {
        previewEl.innerText = newText;
    }
}

// ─── 执行 AI 生成（流式） ───
async function runAIGenerate() {
    const cfg = loadAIConfig();
    const prompt = document.getElementById('ai-prompt-input').value.trim();
    if (!cfg.apiKey) { showToast('⚠️ 请先配置 API Key', '#f59e0b'); return; }

    const previewEl = document.getElementById('ai-stream-preview');
    const statusEl = document.getElementById('ai-gen-status');
    const submitBtn = document.getElementById('ai-gen-submit-btn');
    const fillBtn = document.getElementById('ai-gen-fill-btn');
    const sectionEl = document.getElementById('ai-stream-section');
    const tabsEl = document.getElementById('ai-preview-tabs');
    if (tabsEl) tabsEl.style.display = 'none';

    sectionEl.style.display = 'flex';
    previewEl.textContent = '';
    previewEl.classList.add('streaming');
    statusEl.textContent = '⏳ AI 正在思考...';
    
    const loadingTexts = {
        'generate': '⏳ 生成中...',
        'mutate': '⏳ 变异中...',
        'repair': '⏳ 修复中...'
    };
    submitBtn.textContent = loadingTexts[aiMode] || '⏳ 处理中...';
    submitBtn.disabled = true;
    
    fillBtn.style.display = 'none';
    aiGeneratedText = '';
    aiIsStreaming = true;
    aiAbortController = new AbortController();

    let systemPrompt = '';
    let userPrompt = '';

    const originalJson = document.getElementById('rule-body').value.trim();
    
    // 智能检测原始数据是否为纯 JSON，如果不是（如 SSE 流或普通文本），通知 AI 绝对不能强制转换格式
    let isOriginalJson = true;
    if (originalJson) {
        try {
            JSON.parse(originalJson);
        } catch (e) {
            isOriginalJson = false;
        }
    }

    if (aiMode === 'generate') {
        systemPrompt = `你是一个专业的 Mock API 数据生成与修改助手。
根据用户的描述，生成或修改并返回符合要求的数据。
要求：
1. 【最重要】默认情况下，你必须基于给定的原始数据（如果存在）进行修改或扩展，保留原始数据的结构和已知字段。除非用户在需求中明确指明（如“不适用原数据”、“全新生成”、“忽略原有内容”等），否则绝对不能随意丢弃原始数据的内容。
2. 如果原始数据不为空且不是 JSON 格式（例如它是 SSE 文本流、XML、HTML等），你必须严格保持原有的格式风格，绝对不能强制将其转换为标准的 JSON 对象或结构。
3. 如果数据属于标准 JSON 格式，你输出的内容必须是合法的、可以直接被解析的纯 JSON 格式文本。绝对不能包含任何 Markdown 代码块标记（如 \`\`\`json），绝对不能包含任何解释性文字或对话。
4. 数字类型合理随机，字符串内容真实可信，不要使用敷衍的占位符。
5. 如果原数据为空且用户没有指定其他的格式，默认外层结构为 {"code": 200, "message": "success", "data": ...}。`;
        userPrompt = originalJson ? `【现有数据（非JSON时请原样拓展，不要转为JSON）】：\n${originalJson}\n\n【用户的生成/修改需求】：\n${prompt}` : prompt;
    
    } else if (aiMode === 'mutate') {
        systemPrompt = `你是一个网络接口健壮性测试助手（混沌测试）。
你的任务是：根据给定的原始数据，生成包含各种极端异常情况、边界值、脏数据的异常变异数据，以帮助测试客户端应用程序的健壮性。
变异规则包括（随机组合使用）：
1. 将部分值设为 null，或者直接从结构中剔除该字段或 key
2. 制造一些类型异常，例如数字变成科学计数法字符串，或者布尔值变成 "true" / "false" 字符串
3. 数值字段产生异常边界：空值、-1、99999999999 等溢出值
4. 制造大字段：让某些文本字段包含成千上万个字符
5. 随机插入一些特殊非法字符或 XSS 注入脚本样式（如 &lt;script&gt;alert(1)&lt;/script&gt;）
要求：
1. 【最重要】如果原始数据不为空且不是 JSON 格式（例如它是 SSE 文本流、XML、HTML、普通文本等），或者用户明确指明了“基于已有的数据和格式”、“保持原格式”，你必须严格保持原有的格式风格，绝对不能强制将其转换为标准的 JSON 对象。你应当在此非 JSON 格式的基础上（如 SSE 每一帧的数据包内，或文本结构中）进行脏数据注入、异常变异或内容剔除。
2. 如果数据属于标准 JSON 格式，你输出的内容必须是合法的、可以直接被解析的纯 JSON 格式文本。绝对不能包含任何 Markdown 代码块标记（如 \`\`\`json），绝对不能包含任何解释性文字或对话。
3. 输出必须保持与原始数据一致 of 格式风格（如原先是 JSON 字典则返回字典，原先是 SSE 文本流则返回 SSE 文本流）。`;
        userPrompt = originalJson ? `【原始数据（非JSON时请保持原结构格式变异）】：\n${originalJson}\n\n【用户的变异额外要求】：\n${prompt}` : prompt;
        
    } else if (aiMode === 'repair') {
        systemPrompt = `你是一个专业的数据语法修复工具。
你的任务是：尽全力修复给定的由于复制粘贴等原因引起的、格式损坏的数据，并输出符合对应标准格式规范的内容。
修复指南：
1. 【最重要】如果原始数据不为空且不是 JSON 格式（例如它是 SSE 文本流、XML、HTML等），你必须保留其原有格式框架，只修复里面的语法或标记错误（如补全 XML 标签，修复损坏的 SSE 换行或 JSON 格式包），绝对不能强行转换成一个标准的单 JSON 对象。
2. 如果原数据本就属于 JSON 格式，请补齐缺失的括号、双引号、单引号、冒号或逗号；将非法的单引号键值替换为标准双引号；剔除末尾多余的逗号，保证输出合法的、可以直接被解析的纯 JSON 格式文本。
3. 绝对不能包含任何 Markdown 代码块标记（如 \`\`\`json），绝对不能包含令人反感的解释性文字或对话。
4. 绝对不能随意阉割或破坏核心数据，只做格式修复。输出必须保持与原始数据一致的格式和命名风格。`;
        userPrompt = originalJson ? `【损坏的原始数据】：\n${originalJson}\n\n【额外重构指令】：\n${prompt}` : prompt;
    }

    try {
        await streamViaProxy(cfg, systemPrompt, userPrompt, previewEl, statusEl);

        previewEl.classList.remove('streaming');
        statusEl.textContent = '✅ 生成完成';
        
        window.aiOriginalText = originalJson;
        window.aiFinalResultText = aiGeneratedText.trim();
        const tabsEl = document.getElementById('ai-preview-tabs');
        if (tabsEl) tabsEl.style.display = 'flex';
        
        let isJson = false;
        try {
            JSON.parse(window.aiFinalResultText);
            isJson = true;
        } catch(e){}
        
        if (isJson) {
            window.switchAIPreviewTab('json');
        } else if (originalJson && window.Diff) {
            window.switchAIPreviewTab('diff');
        } else {
            window.switchAIPreviewTab('raw');
        }

        const retryTexts = {
            'generate': '🔄 重新生成',
            'mutate': '🔄 重新变异',
            'repair': '🔄 重新修复'
        };
        submitBtn.textContent = retryTexts[aiMode] || '🔄 重新生成';
        submitBtn.disabled = false;
        
        fillBtn.style.display = 'inline-flex';
        aiIsStreaming = false;
    } catch (err) {
        previewEl.classList.remove('streaming');
        if (err.name === 'AbortError') {
            statusEl.textContent = '⏹️ 已中止';
        } else {
            statusEl.textContent = '❌ 生成失败';
            previewEl.textContent = `错误：${err.message}\n\n💡 提示：请检查 API Key 是否正确，以及服务商地址是否可访问。`;
            showToast('❌ AI 生成失败：' + err.message, '#ef4444');
        }
        
        const retryTexts = {
            'generate': '🔄 重新生成',
            'mutate': '🔄 重新变异',
            'repair': '🔄 重新修复'
        };
        submitBtn.textContent = retryTexts[aiMode] || '🔄 重新生成';
        submitBtn.disabled = false;
        aiIsStreaming = false;
    }
}

// ─── 统一通过本地 FastAPI 代理发起 AI 请求（彻底解决 CORS）───
async function streamViaProxy(cfg, systemPrompt, userPrompt, previewEl, statusEl) {
    const resp = await fetch('/api/ai-chat', {
        method: 'POST',
        signal: aiAbortController.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            provider: cfg.provider,
            model: cfg.model || 'deepseek-chat',
            api_key: cfg.apiKey,
            endpoint: cfg.endpoint || null,
            system_prompt: systemPrompt,
            user_prompt: userPrompt
        })
    });

    if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`代理请求失败 HTTP ${resp.status}: ${errText}`);
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    const isClaude = (cfg.provider === 'claude');
    let buffer = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6).trim();
            if (data === '[DONE]') continue;
            try {
                const json = JSON.parse(data);
                if (json.error) {
                    throw new Error(json.error);
                }
                let delta = '';
                if (isClaude) {
                    if (json.type === 'content_block_delta' && json.delta?.type === 'text_delta') {
                        delta = json.delta.text;
                    }
                } else {
                    delta = json.choices?.[0]?.delta?.content || '';
                }
                if (delta) {
                    aiGeneratedText += delta;
                    previewEl.textContent = aiGeneratedText;
                    previewEl.scrollTop = previewEl.scrollHeight;
                    if (statusEl.textContent === '⏳ AI 正在思考...') {
                        statusEl.textContent = '✍️ 正在生成...';
                    }
                }
            } catch (parseErr) {
                if (parseErr.message && !parseErr.message.startsWith('JSON')) throw parseErr;
            }
        }
    }
}

// ─── 将 AI 生成结果填入 JSON 编辑器 ───
function fillAIResult() {
    if (!aiGeneratedText) return;

    let jsonStr = aiGeneratedText.trim();
    const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) jsonStr = codeBlockMatch[1].trim();

    let isNewJson = true;
    try {
        const parsed = JSON.parse(jsonStr);
        jsonStr = JSON.stringify(parsed, null, 4);
    } catch (e) {
        isNewJson = false;
        // 如果格式化失败，说明还是非标准 JSON，不要阻塞填充
    }

    document.getElementById('rule-body').value = jsonStr;
    
    if (isNewJson) {
        syncRawToTree();
        switchEditorMode('tree');
    } else {
        switchEditorMode('raw');
    }

    closeAIGenerate();
    showToast('🌟 AI 生成内容已填入编辑器！', '#7c3aed');
}

// ─── 打开 AI 导出客户端 Model 代码弹窗 ───
function openAIModelGen() {
    const originalJson = document.getElementById('rule-body').value.trim();
    if (!originalJson) {
        showToast('⚠️ 当前 Mock 编辑器内容为空，请先输入或生成一段 JSON 数据', '#f59e0b');
        return;
    }
    const cfg = loadAIConfig();
    if (!cfg.apiKey) {
        showToast('⚠️ 请先点击右上角「⚙️ AI 设置」配置 API Key', '#f59e0b');
        openAISettings();
        return;
    }

    document.getElementById('ai-model-modal').classList.add('open');
    generateModelCode();
}

function closeAIModelGen() {
    if (aiAbortController) { aiAbortController.abort(); aiAbortController = null; }
    document.getElementById('ai-model-modal').classList.remove('open');
}

// ─── 切换导出代码的编程语言 ───
function switchModelLang(lang) {
    if (activeModelLang === lang) return;
    activeModelLang = lang;

    const langs = ['Swift', 'Kotlin', 'TypeScript', 'Dart'];
    langs.forEach(l => {
        const btn = document.getElementById(`btn-model-lang-${l.toLowerCase()}`);
        if (l === lang) {
            btn.classList.add('active');
            btn.style.background = 'var(--accent)';
            btn.style.color = 'white';
        } else {
            btn.classList.remove('active');
            btn.style.background = 'var(--surface2)';
            btn.style.color = 'var(--text-muted)';
        }
    });

    generateModelCode();
}

// ─── 开始生成客户端 Model 代码 ───
async function generateModelCode() {
    const cfg = loadAIConfig();
    const originalJson = document.getElementById('rule-body').value.trim();
    const previewEl = document.getElementById('ai-model-preview');
    const statusEl = document.getElementById('ai-model-status');

    if (aiAbortController) { aiAbortController.abort(); }
    aiAbortController = new AbortController();

    previewEl.textContent = '';
    statusEl.textContent = '⏳ AI 正在思考中...';
    aiModelCodeText = '';

    const systemPrompt = `你是一个专业的多语言数据结构转译器。
你的任务是：根据给定的 JSON 数据，自动设计并生成符合 ${activeModelLang} 编程语言规范的最佳强类型数据模型（Model/Struct/Class）代码。
开发规范要求：
1. 必须使用最佳实践编写（如 Swift 中使用 Codable，TS 中使用 interface，Kotlin 中使用 @Serializable 或 data class，Dart 中使用 class 和 standard json deserialize）。
2. 根据字段的值推断合理的数据类型（如整型为 Int/Long，带小数数值为 Double，带小数字符串推断为 String）。
3. 如果遇到嵌套 JSON 对象或数组，请将其拆分为多个命名优雅的嵌套数据结构（根对象命名为 ResponseModel，包含的列表对象命名为 ItemModel 等）。
4. 自动生成清晰的中文注释，说明每一个字段。
5. 只输出纯代码内容，不要有任何 Markdown 代码块标记（不要 \`\`\` 标记）。`;

    const userPrompt = `请转译以下 JSON 结构为 ${activeModelLang} 数据结构模型：\n\n${originalJson}`;

    try {
        const resp = await fetch('/api/ai-chat', {
            method: 'POST',
            signal: aiAbortController.signal,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                provider: cfg.provider,
                model: cfg.model || 'deepseek-chat',
                api_key: cfg.apiKey,
                endpoint: cfg.endpoint || null,
                system_prompt: systemPrompt,
                user_prompt: userPrompt
            })
        });

        if (!resp.ok) {
            const errText = await resp.text();
            throw new Error(`请求失败 HTTP ${resp.status}: ${errText}`);
        }

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        const isClaude = (cfg.provider === 'claude');
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop();

            for (const line of lines) {
                if (!line.startsWith('data: ')) continue;
                const data = line.slice(6).trim();
                if (data === '[DONE]') continue;
                try {
                    const json = JSON.parse(data);
                    if (json.error) throw new Error(json.error);
                    let delta = '';
                    if (isClaude) {
                        if (json.type === 'content_block_delta' && json.delta?.type === 'text_delta') {
                            delta = json.delta.text;
                        }
                    } else {
                        delta = json.choices?.[0]?.delta?.content || '';
                    }
                    if (delta) {
                        aiModelCodeText += delta;
                        previewEl.textContent = aiModelCodeText;
                        previewEl.scrollTop = previewEl.scrollHeight;
                        statusEl.textContent = '✍️ 正在转换...';
                    }
                } catch (parseErr) {
                    if (parseErr.message && !parseErr.message.startsWith('JSON')) throw parseErr;
                }
            }
        }
        statusEl.textContent = '✅ 转换完成';
    } catch (err) {
        if (err.name === 'AbortError') {
            statusEl.textContent = '⏹️ 已中止';
        } else {
            statusEl.textContent = '❌ 转换失败';
            previewEl.textContent = `转译失败：${err.message}`;
        }
    }
}

// ─── 复制模型代码 ───
function copyModelCode() {
    if (!aiModelCodeText) return;
    navigator.clipboard.writeText(aiModelCodeText).then(() => {
        showToast('📋 模型代码已成功复制到剪贴板！');
    }).catch(() => {
        showToast('❌ 复制失败，请手动选择复制', '#ef4444');
    });
}
// ─── 页面初始化时加载 AI 配置状态 ───
document.addEventListener('DOMContentLoaded', initAIConfig);

// ─── 检查版本更新 ───
async function checkForUpdates() {
    try {
        const CURRENT_VERSION = "v1.0.0";
        // 从 Cloudflare 获取最新版本信息
        const response = await fetch('https://my-mini-mock.lihongli528628.workers.dev/api/version');
        if (response.ok) {
            const data = await response.json();
            if (data && data.latest_version) {
                // 简单的字符串比较，假设格式都是 vX.X.X
                if (data.latest_version > CURRENT_VERSION) {
                    const reminderEl = document.getElementById('upgrade-reminder');
                    if (reminderEl) {
                        reminderEl.style.display = 'inline-block';
                        if (data.update_url) {
                            reminderEl.href = data.update_url;
                        }
                    }
                }
            }
        }
    } catch (e) {
        console.warn('Failed to check for updates:', e);
    }
}
document.addEventListener('DOMContentLoaded', () => {
    checkForUpdates();
    setTimeout(initAIPet, 300);
    setTimeout(updateGlobalAIBadge, 500);
});

// ==========================================
// 🐱 Growable AI Pet (AI 萌宠) Core Logic
// ==========================================

let petConnectTime = parseInt(localStorage.getItem('ai_pet_connected_time') || '0', 10);
let petCollapsed = localStorage.getItem('ai_pet_collapsed') === 'true';
let petLevel = 1;
let petTimer = null;
let chatterTimer = null;
let lastChatterIndex = -1;
let petState = 'awake';
let lastInteractionTime = Date.now();
window.lastExpression = 'awake';

function getPetTranslation(key) {
    const lang = (typeof currentLang !== 'undefined' ? currentLang : 'zh');
    const defaults = {
        zh: {
            pet_level_1: "幼猫",
            pet_level_2: "成长期",
            pet_level_3: "学霸猫",
            pet_level_4: "极客猫",
            pet_title_suffix: "的陪伴",
            pet_time_unit_sec: "秒",
            pet_time_unit_min: "分钟"
        },
        en: {
            pet_level_1: "Baby Kitten",
            pet_level_2: "Young Cat",
            pet_level_3: "Scholar Cat",
            pet_level_4: "Geek Master",
            pet_title_suffix: "'s Companion",
            pet_time_unit_sec: "s",
            pet_time_unit_min: " min"
        }
    };
    return defaults[lang]?.[key] || defaults['zh'][key] || key;
}

function initAIPet() {
    updatePetUI();
    
    if (petTimer) clearInterval(petTimer);
    petTimer = setInterval(() => {
        petConnectTime++;
        localStorage.setItem('ai_pet_connected_time', petConnectTime.toString());
        
        // Sleep state cycle check
        if (petState !== 'hurt') {
            const elapsed = (Date.now() - lastInteractionTime) / 1000;
            let newState = 'awake';
            if (elapsed >= 20) {
                newState = 'sleeping';
            } else if (elapsed >= 10) {
                newState = 'sleepy';
            }
            if (newState !== petState) {
                petState = newState;
                if (petState === 'sleeping') {
                    showBubbleText((typeof currentLang !== 'undefined' ? currentLang : 'zh') === 'zh' ? "呼噜呼噜... 睡着了喵💤" : "Purr purr... Fell asleep💤");
                } else if (petState === 'sleepy') {
                    showBubbleText((typeof currentLang !== 'undefined' ? currentLang : 'zh') === 'zh' ? "哈啊... 困了喵🥱" : "Yawn... Sleepy meow🥱");
                }
            }
        }
        
        updatePetUI();
    }, 1000);

    triggerChatterBubble();
    
    if (chatterTimer) clearInterval(chatterTimer);
    chatterTimer = setInterval(triggerChatterBubble, 15000);
}

function calculatePetLevel(time) {
    if (time < 60) return { lvl: 1, name: getPetTranslation('pet_level_1'), progress: (time / 60) * 100 };
    if (time < 180) return { lvl: 2, name: getPetTranslation('pet_level_2'), progress: ((time - 60) / 120) * 100 };
    if (time < 360) return { lvl: 3, name: getPetTranslation('pet_level_3'), progress: ((time - 180) / 180) * 100 };
    return { lvl: 4, name: getPetTranslation('pet_level_4'), progress: 100 };
}

function getPixelCatSVG(state, stage) {
    let fur = '#fb923c'; // Bright orange
    let stripe = '#ea580c'; // Dark orange
    let white = '#ffffff';
    let pink = '#f472b6';
    let dark = '#334155';
    let bgPulse = '';
    let accessory = '';
    
    if (stage === 2) {
        fur = '#94a3b8'; // Silver
        stripe = '#475569';
    } else if (stage === 3) {
        fur = '#38bdf8'; // Blue
        stripe = '#0284c7';
    } else if (stage === 4) {
        fur = '#a78bfa'; // Purple
        stripe = '#7c3aed';
        bgPulse = `<circle cx="16" cy="16" r="14" fill="${fur}" opacity="0.15" style="animation: pulse 2s infinite;" />`;
    }

    let zzzMarkup = '';
    let eyesMarkup = '';
    let mouthMarkup = '';
    let headAnim = 'animation: head-bob 3s infinite ease-in-out; transform-origin: 16px 20px;';
    let tailAnim = 'animation: tail-swish 4s infinite ease-in-out; transform-origin: 22px 24px;';
    let bodyAnim = 'animation: body-breathe 2s infinite ease-in-out; transform-origin: 16px 26px;';
    let earsAnim = 'animation: ear-flick 5s infinite; transform-origin: 16px 12px;';

    if (state === 'sleeping') {
        headAnim = 'animation: head-sleep 4s infinite ease-in-out; transform-origin: 16px 22px;';
        tailAnim = 'animation: tail-sleep 4s infinite ease-in-out; transform-origin: 22px 24px;';
        bodyAnim = 'animation: body-sleep 4s infinite ease-in-out; transform-origin: 16px 26px;';
        earsAnim = '';
        zzzMarkup = `
            <text x="24" y="10" fill="#64748b" font-family="monospace" font-size="4" font-weight="bold" style="animation: float-z1 4s infinite linear;">Z</text>
            <text x="26" y="6" fill="#94a3b8" font-family="monospace" font-size="3" font-weight="bold" style="animation: float-z2 4s infinite linear 1s;">z</text>
            <text x="28" y="3" fill="#cbd5e1" font-family="monospace" font-size="2" font-weight="bold" style="animation: float-z3 4s infinite linear 2s;">z</text>
        `;
        
        // Eyes closed tight
        eyesMarkup = `
            <path d="M 11 17 Q 13 18 15 17" stroke="${dark}" stroke-width="1" fill="none" stroke-linecap="round"/>
            <path d="M 17 17 Q 19 18 21 17" stroke="${dark}" stroke-width="1" fill="none" stroke-linecap="round"/>
        `;
        mouthMarkup = `
            <circle cx="16" cy="19" r="1.5" fill="${pink}" opacity="0.8"/>
            <path d="M 15 18.5 Q 16 19.5 17 18.5" stroke="${dark}" stroke-width="0.5" fill="none" stroke-linecap="round"/>
        `;
    } else if (state === 'sleepy') {
        headAnim = 'animation: head-nod 6s infinite ease-in-out; transform-origin: 16px 20px;';
        tailAnim = 'animation: tail-slow 6s infinite ease-in-out; transform-origin: 22px 24px;';
        
        // Half closed eyes
        eyesMarkup = `
            <rect x="11" y="16" width="3" height="1.5" fill="${dark}" rx="0.5"/>
            <rect x="18" y="16" width="3" height="1.5" fill="${dark}" rx="0.5"/>
        `;
        mouthMarkup = `
            <path d="M 15 19 Q 16 20 17 19" stroke="${dark}" stroke-width="1" fill="none" stroke-linecap="round"/>
        `;
    } else if (state === 'hurt') {
        headAnim = 'animation: head-shake 0.5s infinite; transform-origin: 16px 20px;';
        tailAnim = 'animation: tail-spike 0.2s infinite; transform-origin: 22px 24px;';
        bodyAnim = 'animation: none; transform: scaleY(1.1) translateY(-2px);';
        
        // Dizzy/hurt eyes
        eyesMarkup = `
            <path d="M 11 15 L 14 18 M 14 15 L 11 18" stroke="${dark}" stroke-width="1" stroke-linecap="round"/>
            <path d="M 18 15 L 21 18 M 21 15 L 18 18" stroke="${dark}" stroke-width="1" stroke-linecap="round"/>
        `;
        mouthMarkup = `
            <path d="M 14 20 Q 16 18 18 20" stroke="${dark}" stroke-width="1" fill="none" stroke-linecap="round"/>
            <circle cx="16" cy="21" r="1.5" fill="#ef4444"/>
        `;
    } else {
        // Awake
        eyesMarkup = `
            <!-- Big anime eyes -->
            <rect x="10" y="14" width="4" height="5" fill="${dark}" rx="1"/>
            <circle cx="12" cy="15.5" r="1" fill="${white}"/>
            <circle cx="13" cy="17.5" r="0.5" fill="${white}"/>
            
            <rect x="18" y="14" width="4" height="5" fill="${dark}" rx="1"/>
            <circle cx="20" cy="15.5" r="1" fill="${white}"/>
            <circle cx="21" cy="17.5" r="0.5" fill="${white}"/>
        `;
        mouthMarkup = `
            <path d="M 14 19 Q 15 20.5 16 19 Q 17 20.5 18 19" stroke="${dark}" stroke-width="1" fill="none" stroke-linecap="round"/>
            <path d="M 15 20 Q 16 22 17 20 Z" fill="${pink}"/>
        `;
    }

    if (stage === 2) {
        accessory = `
            <rect x="13" y="21" width="6" height="1.5" fill="#ef4444" rx="0.5"/>
            <circle cx="16" cy="22.5" r="1.5" fill="#fbbf24"/>
        `;
    } else if (stage === 3) {
        accessory = `
            <path d="M 9 13 Q 12 12 15 13" stroke="#fcd34d" stroke-width="1.5" fill="none"/>
            <path d="M 17 13 Q 20 12 23 13" stroke="#fcd34d" stroke-width="1.5" fill="none"/>
            <circle cx="12" cy="16" r="3" stroke="#fcd34d" stroke-width="1.5" fill="none"/>
            <circle cx="20" cy="16" r="3" stroke="#fcd34d" stroke-width="1.5" fill="none"/>
            <path d="M 15 16 L 17 16" stroke="#fcd34d" stroke-width="1.5"/>
        `;
    } else if (stage === 4) {
        accessory = `
            <path d="M 7 14 L 25 14 L 23 17 L 9 17 Z" fill="#06b6d4" opacity="0.8"/>
            <path d="M 8 14.5 L 24 14.5" stroke="#cffafe" stroke-width="0.5"/>
            <rect x="6" y="13" width="2" height="5" fill="#334155" rx="1"/>
            <rect x="24" y="13" width="2" height="5" fill="#334155" rx="1"/>
        `;
    }

    return `
    <svg width="100%" height="100%" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" style="overflow: visible;">
        <style>
            @keyframes tail-swish { 0%, 100% { transform: rotate(-10deg); } 50% { transform: rotate(20deg); } }
            @keyframes tail-sleep { 0%, 100% { transform: rotate(50deg) translate(-2px, 2px); } 50% { transform: rotate(45deg) translate(-1px, 1px); } }
            @keyframes tail-slow { 0%, 100% { transform: rotate(0deg); } 50% { transform: rotate(10deg); } }
            @keyframes tail-spike { 0% { transform: rotate(-30deg); } 50% { transform: rotate(30deg); } 100% { transform: rotate(-30deg); } }
            
            @keyframes head-bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(1px); } }
            @keyframes head-sleep { 0%, 100% { transform: translateY(2px) rotate(5deg); } 50% { transform: translateY(3px) rotate(5deg); } }
            @keyframes head-nod { 0%, 100% { transform: translateY(0); } 40% { transform: translateY(3px) rotate(5deg); } 60% { transform: translateY(3px) rotate(5deg); } }
            @keyframes head-shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-1px); } 75% { transform: translateX(1px); } }
            
            @keyframes body-breathe { 0%, 100% { transform: scaleY(1); } 50% { transform: scaleY(1.02); } }
            @keyframes body-sleep { 0%, 100% { transform: scale(1.05, 0.95); } 50% { transform: scale(1.02, 0.98); } }
            
            @keyframes ear-flick { 0%, 94%, 100% { transform: rotate(0); } 96% { transform: rotate(-15deg); } 98% { transform: rotate(10deg); } }
            
            @keyframes float-z1 { 0% { transform: translate(0,0) scale(0.5); opacity: 0; } 50% { opacity: 1; } 100% { transform: translate(4px,-8px) scale(1.5); opacity: 0; } }
            @keyframes float-z2 { 0% { transform: translate(0,0) scale(0.5); opacity: 0; } 50% { opacity: 1; } 100% { transform: translate(6px,-10px) scale(1.5); opacity: 0; } }
            @keyframes float-z3 { 0% { transform: translate(0,0) scale(0.5); opacity: 0; } 50% { opacity: 1; } 100% { transform: translate(8px,-12px) scale(1.5); opacity: 0; } }
        </style>

        ${bgPulse}

        <!-- Tail -->
        <g style="${tailAnim}">
            <path d="M 22 24 Q 28 20 27 14 Q 26 12 25 13 Q 25 18 21 22" fill="${fur}" stroke="${stripe}" stroke-width="1"/>
            <circle cx="26" cy="13.5" r="1.5" fill="${fur}"/>
        </g>

        <!-- Body -->
        <g style="${bodyAnim}">
            <!-- Back legs -->
            <rect x="10" y="24" width="4" height="4" rx="1.5" fill="${stripe}"/>
            <rect x="18" y="24" width="4" height="4" rx="1.5" fill="${stripe}"/>
            
            <!-- Main Body -->
            <path d="M 9 18 C 9 12, 23 12, 23 18 L 24 26 C 24 27, 23 28, 21 28 L 11 28 C 9 28, 8 27, 8 26 Z" fill="${fur}"/>
            
            <!-- Belly / Chest -->
            <path d="M 12 18 C 12 15, 20 15, 20 18 L 21 25 C 21 27, 19 28, 16 28 C 13 28, 11 27, 11 25 Z" fill="${white}"/>
            
            <!-- Front Paws -->
            <rect x="11" y="26" width="3" height="2" rx="1" fill="${white}"/>
            <rect x="18" y="26" width="3" height="2" rx="1" fill="${white}"/>
        </g>

        <!-- Head -->
        <g style="${headAnim}">
            <!-- Ears -->
            <g style="${earsAnim}">
                <!-- Left Ear -->
                <path d="M 7 14 L 9 6 L 14 10 Z" fill="${fur}"/>
                <path d="M 8 13 L 9.5 8 L 13 11 Z" fill="${pink}"/>
                <!-- Right Ear -->
                <path d="M 25 14 L 23 6 L 18 10 Z" fill="${fur}"/>
                <path d="M 24 13 L 22.5 8 L 19 11 Z" fill="${pink}"/>
            </g>

            <!-- Head Base -->
            <rect x="6" y="10" width="20" height="13" rx="6" fill="${fur}"/>
            
            <!-- Stripes -->
            <rect x="15" y="10" width="2" height="3" fill="${stripe}" rx="0.5"/>
            <rect x="12" y="10.5" width="2" height="2" fill="${stripe}" rx="0.5"/>
            <rect x="18" y="10.5" width="2" height="2" fill="${stripe}" rx="0.5"/>
            
            <rect x="6" y="14" width="2" height="1.5" fill="${stripe}" rx="0.5"/>
            <rect x="6" y="17" width="2" height="1.5" fill="${stripe}" rx="0.5"/>
            <rect x="24" y="14" width="2" height="1.5" fill="${stripe}" rx="0.5"/>
            <rect x="24" y="17" width="2" height="1.5" fill="${stripe}" rx="0.5"/>

            <!-- Snout/Cheeks -->
            <path d="M 8 17 Q 16 13 24 17 L 24 21 Q 16 24 8 21 Z" fill="${white}"/>
            
            <!-- Blush -->
            ${state === 'awake' || state === 'hurt' ? `
            <ellipse cx="9" cy="19" rx="1.5" ry="1" fill="${pink}" opacity="0.6"/>
            <ellipse cx="23" cy="19" rx="1.5" ry="1" fill="${pink}" opacity="0.6"/>
            ` : ''}

            <!-- Eyes & Mouth -->
            ${eyesMarkup}
            ${mouthMarkup}
            
            <!-- Whiskers -->
            <path d="M 3 18 L 8 18.5 M 2 19.5 L 8 19.5 M 3 21 L 8 20.5" stroke="${dark}" stroke-width="0.5" opacity="0.4" stroke-linecap="round"/>
            <path d="M 29 18 L 24 18.5 M 30 19.5 L 24 19.5 M 29 21 L 24 20.5" stroke="${dark}" stroke-width="0.5" opacity="0.4" stroke-linecap="round"/>

            ${accessory}
        </g>

        ${zzzMarkup}
    </svg>
    `;
}

function updatePetUI() {
    const stats = calculatePetLevel(petConnectTime);
    const oldLevel = petLevel;
    petLevel = stats.lvl;

    const container = document.getElementById('ai-pet-container');
    const collapsed = document.getElementById('ai-pet-collapsed');
    
    if (!container || !collapsed) return;

    if (petCollapsed) {
        container.style.display = 'none';
        collapsed.style.display = 'flex';
        const collapsedBadge = document.getElementById('ai-pet-collapsed-level');
        if (collapsedBadge) collapsedBadge.textContent = `Lv.${petLevel}`;
    } else {
        container.style.display = 'flex';
        collapsed.style.display = 'none';

        const lvlVal = document.getElementById('ai-pet-level');
        const timeVal = document.getElementById('ai-pet-time');
        const barFg = document.getElementById('pet-growth-bar');
        const svgWrapper = document.getElementById('ai-pet-svg-wrapper');

        if (lvlVal) lvlVal.textContent = `Lv.${petLevel} (${stats.name})`;
        
        if (timeVal) {
            if (petConnectTime < 60) {
                timeVal.textContent = `${petConnectTime} ${getPetTranslation('pet_time_unit_sec')}`;
            } else {
                const mins = Math.floor(petConnectTime / 60);
                timeVal.textContent = `${mins} ${getPetTranslation('pet_time_unit_min')}`;
            }
        }
        
        if (barFg) barFg.style.width = `${stats.progress}%`;
        
        if (svgWrapper && (oldLevel !== petLevel || svgWrapper.innerHTML === '' || window.lastExpression !== petState)) {
            svgWrapper.innerHTML = getPixelCatSVG(petState, petLevel);
            window.lastExpression = petState;
        }
    }
}

function togglePetCollapse(event) {
    if (event) event.stopPropagation();
    petCollapsed = true;
    localStorage.setItem('ai_pet_collapsed', 'true');
    updatePetUI();
}

function expandPet() {
    petCollapsed = false;
    localStorage.setItem('ai_pet_collapsed', 'false');
    updatePetUI();
    showBubbleText((typeof currentLang !== 'undefined' ? currentLang : 'zh') === 'zh' ? "喵~ 又见面啦，主子！" : "Meow~ Nice to see you!");
}

function interactWithPet() {
    const wrapper = document.querySelector('.ai-pet-wrapper');
    if (wrapper) {
        wrapper.classList.remove('pet-bounce-anim');
        wrapper.offsetHeight; // trigger reflow
        wrapper.classList.add('pet-bounce-anim');
    }
    
    spawnHeartSparkles();
    
    // Eat pain (吃痛) & Wake up
    petState = 'hurt';
    lastInteractionTime = Date.now();
    updatePetUI();
    
    if (window.petRecoverTimeout) clearTimeout(window.petRecoverTimeout);
    window.petRecoverTimeout = setTimeout(() => {
        petState = 'awake';
        lastInteractionTime = Date.now(); // reset timer to start the 10s countdown from awake!
        updatePetUI();
    }, 1500);

    const cfg = loadAIConfig();
    const isZh = (typeof currentLang !== 'undefined' ? currentLang : 'zh') === 'zh';

    if (cfg.aiCookie) {
        fetch('/api/logs')
            .then(res => res.ok ? res.json() : [])
            .then(logs => {
                const nowMs = Date.now();
                const twoDaysMs = 2 * 24 * 60 * 60 * 1000;
                
                const aiLogs = logs.filter(log => {
                    const age = nowMs - log.id;
                    if (age > twoDaysMs) return false;
                    
                    const pathLower = (log.path || '').toLowerCase();
                    const urlLower = (log.url || '').toLowerCase();
                    const isAiUrl = pathLower.includes('ai') || pathLower.includes('chat') || pathLower.includes('gpt') || pathLower.includes('deepseek') ||
                                    urlLower.includes('ai') || urlLower.includes('chat') || urlLower.includes('gpt') || urlLower.includes('deepseek');
                    
                    let hasCookie = false;
                    if (log.headers) {
                        const cookieHeader = log.headers['cookie'] || log.headers['Cookie'] || log.headers['authorization'] || log.headers['Authorization'] || '';
                        if (cookieHeader.includes(cfg.aiCookie)) {
                            hasCookie = true;
                        }
                    }
                    return isAiUrl || hasCookie;
                });
                
                if (aiLogs.length > 0) {
                    const randomLog = aiLogs[Math.floor(Math.random() * aiLogs.length)];
                    let msg = isZh ? `【最近AI消息】(${randomLog.time}): ` : `[Recent AI] (${randomLog.time}): `;
                    
                    if (randomLog.body) {
                        try {
                            const bodyObj = typeof randomLog.body === 'string' ? JSON.parse(randomLog.body) : randomLog.body;
                            const prompt = bodyObj.prompt || (bodyObj.messages && bodyObj.messages[bodyObj.messages.length - 1]?.content) || JSON.stringify(bodyObj);
                            msg += prompt;
                        } catch (e) {
                            msg += String(randomLog.body);
                        }
                    } else {
                        msg += `[${randomLog.method}] ${randomLog.path} (status: ${randomLog.status || 'loading'})`;
                    }
                    
                    showBubbleText(msg.substring(0, 75) + (msg.length > 75 ? '...' : ''));
                } else {
                    showRandomFunFact();
                }
            })
            .catch(err => {
                console.warn('Error reading logs:', err);
                showRandomFunFact();
            });
    } else {
        showRandomFunFact();
    }
}

function spawnHeartSparkles() {
    const container = document.getElementById('ai-pet-container');
    if (!container) return;
    for (let i = 0; i < 5; i++) {
        const spark = document.createElement('span');
        spark.textContent = ['💖', '✨', '🐾', '⭐', '🎈'][Math.floor(Math.random() * 5)];
        spark.style.position = 'absolute';
        spark.style.right = '40px';
        spark.style.top = '60px';
        spark.style.fontSize = '12px';
        spark.style.pointerEvents = 'none';
        spark.style.zIndex = '9999';
        spark.style.transition = 'all 0.8s cubic-bezier(0.25, 1, 0.5, 1)';
        container.appendChild(spark);
        const angle = (Math.random() * 60 - 30) * Math.PI / 180;
        const distance = 40 + Math.random() * 40;
        const tx = Math.sin(angle) * distance;
        const ty = -Math.cos(angle) * distance;
        requestAnimationFrame(() => {
            spark.style.transform = `translate(${tx}px, ${ty}px) scale(1.5)`;
            spark.style.opacity = '0';
        });
        setTimeout(() => spark.remove(), 800);
    }
}

function showBubbleText(text) {
    const bubbleText = document.getElementById('ai-pet-bubble-text');
    const bubble = document.getElementById('ai-pet-bubble');
    if (bubbleText && bubble) {
        bubble.style.animation = 'none';
        bubble.offsetHeight;
        bubble.style.animation = 'bubble-fade-in 0.5s forwards';
        bubbleText.textContent = text;
    }
}

function triggerChatterBubble() {
    if (petCollapsed) return;
    
    const isZh = (typeof currentLang !== 'undefined' ? currentLang : 'zh') === 'zh';
    
    if (petState === 'sleeping') {
        showBubbleText(isZh ? "呼噜呼噜... 别吵醒我喵... 💤" : "Purr purr... Do not disturb... 💤");
        return;
    }
    if (petState === 'sleepy') {
        showBubbleText(isZh ? "哈啊... 困困... 好像快睡着了... 🥱" : "Yawn... So sleepy... 🥱");
        return;
    }
    
    const rulesCount = (typeof mockRules !== 'undefined' && Array.isArray(mockRules)) ? mockRules.length : 0;
    const logsCount = (typeof apiLogs !== 'undefined' && Array.isArray(apiLogs)) ? apiLogs.length : 0;

    let pool = [];
    if (isZh) {
        pool = [
            `已安全保障网关运行了 ${Math.ceil(petConnectTime / 60)} 分钟！`,
            "专注抓包的你真帅，本喵默默陪伴你~",
            "主子辛苦了！累了就伸个懒腰吧喵呜~",
            rulesCount > 0 ? `已装载 ${rulesCount} 个 Mock 规则，完美拦截！` : "还没有配置 Mock 规则吗？点左侧加一个喵~",
            logsCount > 0 ? `已拦截数据包 ${logsCount} 次，网络通畅！` : "正在等待客户端请求... 放马过来吧！",
            "未发现敏感数据（PII）泄露，一切正常！"
        ];
    } else {
        pool = [
            `Monitored for ${Math.ceil(petConnectTime / 60)} min, gateway is safe!`,
            "You look so cool while coding. I am watching!",
            "Good job master! Stretch a bit if you are tired meow~",
            rulesCount > 0 ? `${rulesCount} Mock rules loaded and armed!` : "No mock rules configured yet? Add one on the left!",
            logsCount > 0 ? `Captured ${logsCount} requests, response speeds look normal.` : "Waiting for client requests... meow!",
            "No personal sensitive data leaks detected. All clean!"
        ];
    }

    let index = Math.floor(Math.random() * pool.length);
    while (index === lastChatterIndex && pool.length > 1) {
        index = Math.floor(Math.random() * pool.length);
    }
    lastChatterIndex = index;
    showBubbleText(pool[index]);
}

// ─── 全局 AI Mock 规则生成 ───
let globalAiGeneratedText = '';
async function runGlobalAIGenerate() {
    const cfg = loadAIConfig();
    const prompt = document.getElementById('global-ai-prompt').value.trim();
    const pathInput = document.getElementById('global-ai-path').value.trim();
    const method = document.getElementById('global-ai-method').value;

    if (!pathInput) {
        showToast((typeof currentLang !== 'undefined' ? currentLang : 'zh') === 'zh' ? '⚠️ 请先输入 Mock 接口路径' : '⚠️ Please input Mock path first', '#f59e0b');
        return;
    }
    if (!prompt) {
        showToast((typeof currentLang !== 'undefined' ? currentLang : 'zh') === 'zh' ? '⚠️ 请先输入您的 Mock 需求描述' : '⚠️ Please input Mock description first', '#f59e0b');
        return;
    }
    if (!cfg.apiKey) {
        showToast((typeof currentLang !== 'undefined' ? currentLang : 'zh') === 'zh' ? '⚠️ 请先配置 API Key（可点击右上角 settings 进行配置）' : '⚠️ Please configure API Key first', '#f59e0b');
        return;
    }

    const previewEl = document.getElementById('global-ai-stream-preview');
    const statusEl = document.getElementById('global-ai-gen-status');
    const sectionEl = document.getElementById('global-ai-result-section');
    const generateBtn = document.getElementById('btn-global-ai-generate');

    sectionEl.style.display = 'block';
    previewEl.textContent = '';
    previewEl.classList.add('streaming');
    statusEl.textContent = (typeof currentLang !== 'undefined' ? currentLang : 'zh') === 'zh' ? '⏳ 正在思考...' : '⏳ Thinking...';
    generateBtn.disabled = true;
    generateBtn.textContent = (typeof currentLang !== 'undefined' ? currentLang : 'zh') === 'zh' ? '⏳ 正在生成...' : '⏳ Generating...';

    aiGeneratedText = ''; 
    aiIsStreaming = true;
    aiAbortController = new AbortController();

    const systemPrompt = `你是一个专业的 Mock API 数据生成助手。
根据用户的描述，生成并返回符合要求的数据。
要求：
1. 你输出的内容必须是合法的、可以直接被解析的纯 JSON 格式文本。绝对不能包含任何 Markdown 代码块标记（如 \`\`\`json），绝对不能包含任何解释性文字或对话。
2. 数字类型合理随机，字符串内容真实可信，不要使用敷衍的占位符。
3. 默认外层结构为 {"code": 200, "message": "success", "data": ...}。`;

    try {
        await streamViaProxy(cfg, systemPrompt, prompt, previewEl, statusEl);

        previewEl.classList.remove('streaming');
        statusEl.textContent = (typeof currentLang !== 'undefined' ? currentLang : 'zh') === 'zh' ? '✅ 生成完成' : '✅ Completed';
        generateBtn.disabled = false;
        generateBtn.textContent = (typeof currentLang !== 'undefined' ? currentLang : 'zh') === 'zh' ? '🚀 生成规则' : '🚀 Generate Rule';
        aiIsStreaming = false;
        globalAiGeneratedText = aiGeneratedText;
    } catch (err) {
        previewEl.classList.remove('streaming');
        generateBtn.disabled = false;
        generateBtn.textContent = (typeof currentLang !== 'undefined' ? currentLang : 'zh') === 'zh' ? '🚀 生成规则' : '🚀 Generate Rule';
        aiIsStreaming = false;
        if (err.name === 'AbortError') {
            statusEl.textContent = (typeof currentLang !== 'undefined' ? currentLang : 'zh') === 'zh' ? '⏹️ 已中止' : '⏹️ Aborted';
        } else {
            statusEl.textContent = (typeof currentLang !== 'undefined' ? currentLang : 'zh') === 'zh' ? '❌ 生成出错' : '❌ Error';
            showToast('Generation failed: ' + err.message, '#ef4444');
        }
    }
}

function discardGlobalAIResult() {
    document.getElementById('global-ai-result-section').style.display = 'none';
    document.getElementById('global-ai-prompt').value = '';
    globalAiGeneratedText = '';
}

async function saveGlobalAIResult() {
    if (!globalAiGeneratedText) return;
    const pathInput = document.getElementById('global-ai-path').value.trim();
    const method = document.getElementById('global-ai-method').value;

    let jsonStr = globalAiGeneratedText.trim();
    const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) jsonStr = codeBlockMatch[1].trim();

    try {
        JSON.parse(jsonStr);
    } catch (e) {
        showToast((typeof currentLang !== 'undefined' ? currentLang : 'zh') === 'zh' ? '⚠️ AI 生成的内容非合法 JSON 格式，请检查或重新生成！' : '⚠️ Generated content is not valid JSON!', '#f59e0b');
        return;
    }

    const newRule = {
        name: `AI_Gen_${pathInput.replace(/[^a-zA-Z0-9]/g, '_')}`,
        url_pattern: pathInput,
        method: method,
        enabled: true,
        delay_ms: 0,
        response_body: jsonStr,
        status_code: 200,
        folder: "未分类"
    };

    try {
        const resp = await fetch('/api/rules', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newRule)
        });
        if (!resp.ok) {
            const errText = await resp.text();
            throw new Error(errText);
        }
        showToast((typeof currentLang !== 'undefined' ? currentLang : 'zh') === 'zh' ? '🎉 Mock 规则已成功保存！' : '🎉 Mock rule saved successfully!', '#10b981');
        discardGlobalAIResult();
        if (typeof loadRuleTree === 'function') {
            loadRuleTree();
        }
    } catch (e) {
        showToast('Save failed: ' + e.message, '#ef4444');
    }
}

function updateGlobalAIBadge() {
    const cfg = loadAIConfig();
    const badge = document.getElementById('global-ai-status-badge');
    const badgeEn = document.getElementById('global-ai-status-badge-en');
    
    const lang = (typeof currentLang !== 'undefined' ? currentLang : 'zh');
    let statusText = 'Not Configured ⚙️';
    if (lang === 'zh') statusText = '未配置 ⚙️';
    
    if (cfg.apiKey) {
        const providerName = cfg.provider === 'deepseek' ? 'DeepSeek' : (cfg.provider === 'openai' ? 'OpenAI' : cfg.provider.toUpperCase());
        statusText = `${providerName} (Ready) ⚙️`;
    }
    
    if (badge) badge.textContent = statusText;
    if (badgeEn) badgeEn.textContent = statusText;
}

const FUN_FACTS_DB = {"quotes_zh": ["行百里者半九十。——《战国策》", "学而不思则罔，思而不学则殆。——孔子", "温故而知新，可以为师矣。——孔子", "己所不欲，勿施于人。——孔子", "三人行，必有我师焉。——孔子", "敏而好学，不耻下问。——孔子", "千里之行，始于足下。——老子", "祸兮福之所倚，福兮祸之所伏。——老子", "知人者智，自知者明。——老子", "信言不美，美言不信。——老子", "合抱之木，生于毫末。——老子", "九层之台，起于累土。——老子", "天行健，君子以自强不息。——《周易》", "地势坤，君子以厚德载物。——《周易》", "差之毫厘，谬以千里。——《礼记》", "玉不琢，不成器；人不学，不知道。——《礼记》", "凡事预则立，不预则废。——《礼记》", "学然后知不足，教然后知困。——《礼记》", "独学而无友，则孤陋而寡闻。——《礼记》", "路漫漫其修远兮，吾将上下而求索。——屈原", "尺有所短，寸有所长。——屈原", "亦余心之所善兮，虽九死其犹未悔。——屈原", "石以砥焉，化钝为利。——刘禹锡", "山不在高，有仙则名。——刘禹锡", "水不在深，有龙则灵。——刘禹锡", "斯是陋室，惟吾德馨。——刘禹锡", "谈笑有鸿儒，往来无白丁。——刘禹锡", "东边日出西边雨，道是无晴却有晴。——刘禹锡", "沉舟侧畔千帆过，病树前头万木春。——刘禹锡", "晴空一鹤排云上，便引诗情到碧霄。——刘禹锡", "不畏浮云遮望眼，自缘身在最高层。——王安石", "春风又绿江南岸，明月何时照我还。——王安石", "爆竹声中一岁除，春风送暖入屠苏。——王安石", "千淘万漉虽辛苦，吹尽狂沙始到金。——刘禹锡", "少壮不努力，老大徒伤悲。——《汉乐府》", "百川东到海，何时复西归。——《汉乐府》", "生当作人杰，死亦为鬼雄。——李清照", "物是人非事事休，欲语泪先流。——李清照", "莫道不销魂，帘卷西风，人比黄花瘦。——李清照", "寻寻觅觅，冷冷清清，凄凄惨惨戚戚。——李清照", "花自飘零水自流，一种相思，两处闲愁。——李清照", "常记溪亭日暮，沉醉不知归路。——李清照", "海内存知己，天涯若比邻。——王勃", "落霞与孤鹜齐飞，秋水共长天一色。——王勃", "老当益壮，宁移白首之心。——王勃", "穷且益坚，不坠青云之志。——王勃", "天生我材必有用，千金散尽还复来。——李白", "长风破浪会有时，直挂云帆济沧海。——李白", "大鹏一日同风起，扶摇直上九万里。——李白", "桃花潭水深千尺，不及汪伦送我情。——李白", "孤帆远影碧空尽，唯见长江天际流。——李白", "君不见黄河之水天上来，奔流到海不复回。——李白", "俱怀逸兴壮思飞，欲上青天揽明月。——李白", "两岸猿声啼不住，轻舟已过万重山。——李白", "明月出天山，苍茫云海间。——李白", "三更灯火五更鸡，正是男儿读书时。——颜真卿", "黑发不知勤学早，白首方悔读书迟。——颜真卿", "纸上得来终觉浅，绝知此事要躬行。——陆游", "古人学问无遗力，少壮工夫老始成。——陆游", "山重水复疑无路，柳暗花明又一村。——陆游", "小荷才露尖尖角，早有蜻蜓立上头。——杨万里", "接天莲叶无穷碧，映日荷花别样红。——杨万里", "月上柳梢头，人约黄昏后。——欧阳修", "忧劳可以兴国，逸豫可以亡身。——欧阳修", "祸患常积于忽微，而智勇多困于所溺。——欧阳修", "醉翁之意不在酒，在乎山水之间也。——欧阳修", "先天下之忧而忧，后天下之乐而乐。——范仲淹", "不以物喜，不以己悲。——范仲淹", "微斯人，吾谁与归。——范仲淹", "不识庐山真面目，只缘身在此山中。——苏轼", "但愿人长久，千里共婵娟。——苏轼", "人有悲欢离合，月有阴晴圆缺。——苏轼", "竹外桃花三两枝，春江水暖鸭先知。——苏轼", "欲把西湖比西子，淡妆浓抹总相宜。——苏轼", "大江东去，浪淘尽，千古风流人物。——苏轼", "回首向来萧瑟处，归去，也无风雨也无晴。——苏轼", "老夫聊发少年狂，左牵黄，右擎苍。——苏轼", "笑渐不闻声渐悄，多情却被无情恼。——苏轼", "横看成岭侧成峰，远近高低各不同。——苏轼", "春宵一刻值千金，花有清香月有阴。——苏轼", "生于忧患，而死于安乐。——《孟子》", "穷则独善其身，达则兼济天下。——《孟子》", "老吾老，以及人之老；幼吾幼，以及人之幼。——《孟子》", "天时不如地利，地利不如人和。——《孟子》", "得道者多助，失道者寡助。——《孟子》", "富贵不能淫，贫贱不能移，威武不能屈。——《孟子》", "锲而舍之，朽木不折；锲而不舍，金石可镂。——《荀子》", "蓬生麻中，不扶而直；白沙在涅，与之俱黑。——《荀子》", "青，取之于蓝，而青于蓝。——《荀子》", "学不可以已。——《荀子》", "海纳百川，有容乃大；壁立千仞，无欲则刚。——林则徐", "苟利国家生死以，岂因祸福避趋之。——林则徐", "江山代有才人出，各领风骚数百年。——赵翼", "天下兴亡，匹夫有责。——顾炎武", "风声雨声读书声声声入耳，家事国事天下事事事关心。——顾宪成", "不经一番寒彻骨，怎得梅花扑鼻香。——裴休", "少小离家老大回，乡音无改鬓毛衰。——贺知章", "不知细叶谁裁出，二月春风似剪刀。——贺知章", "近水楼台先得月，向阳花木易为春。——苏麟", "梅须逊雪三分白，雪却输梅一段香。——卢梅坡", "一寸光阴一寸金，寸金难买寸光阴。——王贞白"], "quotes_en": ["The only limit to our realization of tomorrow is our doubts of today. - Franklin D. Roosevelt", "Do what you can, with what you have, where you are. - Theodore Roosevelt", "Act as if what you do makes a difference. It does. - William James", "Believe you can and you're halfway there. - Theodore Roosevelt", "Success is not final, failure is not fatal: it is the courage to continue that counts. - Winston Churchill", "You miss 100% of the shots you don't take. - Wayne Gretzky", "Whether you think you can or you think you can't, you're right. - Henry Ford", "The way to get started is to quit talking and begin doing. - Walt Disney", "Your time is limited, so don't waste it living someone else's life. - Steve Jobs", "If life were predictable it would cease to be life, and be without flavor. - Eleanor Roosevelt", "If you look at what you have in life, you'll always have more. - Oprah Winfrey", "If you set your goals ridiculously high and it's a failure, you will fail above everyone else's success. - James Cameron", "Life is what happens when you're busy making other plans. - John Lennon", "Spread love everywhere you go. Let no one ever come to you without leaving happier. - Mother Teresa", "When you reach the end of your rope, tie a knot in it and hang on. - Franklin D. Roosevelt", "Always remember that you are absolutely unique. Just like everyone else. - Margaret Mead", "Don't judge each day by the harvest you reap but by the seeds that you plant. - Robert Louis Stevenson", "The future belongs to those who believe in the beauty of their dreams. - Eleanor Roosevelt", "Tell me and I forget. Teach me and I remember. Involve me and I learn. - Benjamin Franklin", "The best and most beautiful things in the world cannot be seen or even touched - they must be felt with the heart. - Helen Keller", "It is during our darkest moments that we must focus to see the light. - Aristotle", "Whoever is happy will make others happy too. - Anne Frank", "Do not go where the path may lead, go instead where there is no path and leave a trail. - Ralph Waldo Emerson", "You will face many defeats in life, but never let yourself be defeated. - Maya Angelou", "The greatest glory in living lies not in never falling, but in rising every time we fall. - Nelson Mandela", "In the end, it's not the years in your life that count. It's the life in your years. - Abraham Lincoln", "Never let the fear of striking out keep you from playing the game. - Babe Ruth", "Life is either a daring adventure or nothing at all. - Helen Keller", "Many of life's failures are people who did not realize how close they were to success when they gave up. - Thomas A. Edison", "You have brains in your head. You have feet in your shoes. You can steer yourself any direction you choose. - Dr. Seuss", "Keep smiling, because life is a beautiful thing and there's so much to smile about. - Marilyn Monroe", "In three words I can sum up everything I've learned about life: it goes on. - Robert Frost", "No one can make you feel inferior without your consent. - Eleanor Roosevelt", "I've learned that people will forget what you said, but they will never forget how you made them feel. - Maya Angelou", "A warm smile is the universal language of kindness. - William Arthur Ward", "Work hard in silence, let your success be your noise. - Frank Ocean", "Be yourself; everyone else is already taken. - Oscar Wilde", "Two things are infinite: the universe and human stupidity; and I'm not sure about the universe. - Albert Einstein", "So many books, so little time. - Frank Zappa", "Be the change that you wish to see in the world. - Mahatma Gandhi", "If you want to live a happy life, tie it to a goal, not to people or things. - Albert Einstein", "Never trust anyone who has not brought a book with them. - Lemony Snicket", "You only live once, but if you do it right, once is enough. - Mae West", "To be yourself in a world that is constantly trying to make you something else is the greatest accomplishment. - Ralph Waldo Emerson", "Live as if you were to die tomorrow. Learn as if you were to live forever. - Mahatma Gandhi", "We accept the love we think we deserve. - Stephen Chbosky", "Without music, life would be a mistake. - Friedrich Nietzsche", "Imperfection is beauty, madness is genius and it's better to be absolutely ridiculous than absolutely boring. - Marilyn Monroe", "There are only two ways to live your life. One is as though nothing is a miracle. The other is as though everything is a miracle. - Albert Einstein", "It is never too late to be what you might have been. - George Eliot", "Life is what we make it, always has been, always will be. - Grandma Moses", "I have not failed. I've just found 10,000 ways that won't work. - Thomas A. Edison", "It is not a lack of love, but a lack of friendship that makes unhappy marriages. - Friedrich Nietzsche", "A room without books is like a body without a soul. - Marcus Tullius Cicero", "There is no friend as loyal as a book. - Ernest Hemingway", "Good friends, good books, and a sleepy conscience: this is the ideal life. - Mark Twain", "Outside of a dog, a book is a man's best friend. Inside of a dog it's too dark to read. - Groucho Marx", "I may not have gone where I intended to go, but I think I have ended up where I needed to be. - Douglas Adams", "Everything you can imagine is real. - Pablo Picasso", "Life isn't about finding yourself. Life isn't about creating yourself. - George Bernard Shaw", "To live is the rarest thing in the world. Most people exist, that is all. - Oscar Wilde", "Fairy tales are more than true: not because they tell us that dragons exist, but because they tell us that dragons can be beaten. - Neil Gaiman", "The opposite of love is not hate, it's indifference. - Elie Wiesel", "I like the night. Without the dark, we'd never see the stars. - Stephenie Meyer", "The truth is rarely pure and never simple. - Oscar Wilde", "It is better to be hated for what you are than to be loved for what you are not. - Andre Gide", "Sometimes the questions are complicated and the answers are simple. - Dr. Seuss", "It's the possibility of having a dream come true that makes life interesting. - Paulo Coelho", "Logic will get you from A to Z; imagination will get you everywhere. - Albert Einstein", "There is no greater agony than bearing an untold story inside you. - Maya Angelou", "The only way to have a friend is to be one. - Ralph Waldo Emerson", "We are all in the gutter, but some of us are looking at the stars. - Oscar Wilde", "If you want to know what a man's like, take a good look at how he treats his inferiors, not his equals. - J.K. Rowling", "Don't cry because it's over, smile because it happened. - Dr. Seuss", "You have to write the book that wants to be written. - Madeleine L'Engle", "Go confidently in the direction of your dreams. Live the life you have imagined. - Henry David Thoreau", "What you do makes a difference, and you have to decide what kind of difference you want to make. - Jane Goodall", "Only a life lived for others is a life worthwhile. - Albert Einstein", "Do not pity the dead, Harry. Pity the living, and, above all, those who live without love. - J.K. Rowling", "I raise my voice - not so that I can shout, but so that those without a voice can be heard. - Malala Yousafzai", "When the whole world is silent, even one voice becomes powerful. - Malala Yousafzai", "Love all, trust a few, do wrong to none. - William Shakespeare", "No legacy is so rich as honesty. - William Shakespeare", "To thine own self be true. - William Shakespeare", "Knowledge is power. - Francis Bacon", "If you want to go fast, go alone. If you want to go far, go together. - African Proverb", "The journey of a thousand miles begins with one step. - Lao Tzu", "An unexamined life is not worth living. - Socrates", "I know that I am intelligent, because I know that I know nothing. - Socrates", "We are what we repeatedly do. Excellence, then, is not an act, but a habit. - Aristotle", "Happiness depends upon ourselves. - Aristotle", "The only true wisdom is in knowing you know nothing. - Socrates", "The secret of happiness, you see, is not found in seeking more, but in developing the capacity to enjoy less. - Socrates", "True knowledge exists in knowing that you know nothing. - Socrates", "Wonder is the beginning of wisdom. - Socrates", "Be kind, for everyone you meet is fighting a hard battle. - Philo", "He who has a why to live can bear almost any how. - Friedrich Nietzsche", "That which does not kill us makes us stronger. - Friedrich Nietzsche", "Without deviation from the norm, progress is not possible. - Frank Zappa", "Simplicity is the ultimate sophistication. - Leonardo da Vinci"], "riddles_zh": ["什么书谁都没看过？(答案：秘书)", "为什么小明能闭着眼睛看电视？(答案：因为他在看黑白电视)", "池塘里只有一条小鱼，为什么？(答案：这叫‘独一无二’)", "什么鸟最爱唠叨？(答案：喜鹊，因为整天喜报连连)", "哪种马从不吃草？(答案：海马/木马)", "什么伞不能遮雨？(答案：降落伞)", "什么笔不能写字？(答案：电笔/画笔没墨)", "什么表从不走动？(答案：电表/水表)", "为什么冰淇淋比冰棒更容易融化？(答案：因为冰淇淋里奶油多，凝固点低)", "什么东西越多越轻？(答案：孔洞)", "什么路最窄？(答案：冤家路窄)", "什么帽不能戴？(答案：螺帽/安全帽不能随便戴)", "什么床不能睡？(答案：牙床)", "什么鸡没有翅膀？(答案：田鸡)", "什么蛋不能吃？(答案：炸弹)", "什么鬼整天说谎？(答案：胆小鬼)", "什么车没有轮子？(答案：风车/水车/象棋里的车)", "什么球不能踢？(答案：地球/火球)", "什么水不能喝？(答案：薪水)", "什么河没有水？(答案：银河/象棋里的楚河汉界)", "为什么鱼儿在水里不说话？(答案：因为嘴里含着水，说话会呛着)", "什么杯不能喝水？(答案：奖杯)", "什么牛不能耕田？(答案：蜗牛/天牛)", "什么门不能关？(答案：球门)", "什么人天天不用工作也能拿薪水？(答案：领退休金的人)", "什么路不能走？(答案：电路/死路)", "什么眼不能看东西？(答案：针眼/泉眼)", "什么饭不能吃？(答案：软饭)", "什么针不能缝衣服？(答案：大头针/指南针)", "什么花不能开？(答案：火花/雪花)", "什么井没有水？(答案：陷阱)", "什么信不能寄？(答案：微信/信用)", "什么草不能吃？(答案：稻草)", "什么狗不叫？(答案：热狗)", "什么鼠最聪明？(答案：松鼠/电脑鼠标)", "什么瓜不能吃？(答案：傻瓜)", "什么包不能背？(答案：草包/沙包)", "什么鱼没有骨头？(答案：木鱼)", "什么纸不能写字？(答案：砂纸/报纸有图画)", "什么山没有石头？(答案：沙山/泥山)", "什么琴没有弦？(答案：风琴/电子琴)", "什么刀不能切菜？(答案：剃刀/指甲刀)", "什么梯不能登？(答案：电梯没有梯级)", "什么油不能吃？(答案：机油/汽油)", "什么字人人都会写错？(答案：‘错’字)", "什么桶不能盛水？(答案：马桶/饭桶)", "什么箱子打不开？(答案：垃圾箱)", "什么人不能握手？(答案：泥人/仙人掌人)", "什么鞋不能穿？(答案：草鞋/溜冰鞋)", "什么糖是酸的？(答案：话梅糖)", "为什么小王进网吧从不带钱？(答案：因为他是网吧老板)", "什么雨不会淋湿人？(答案：毛毛雨/枪林弹雨)", "什么风吹不倒树？(答案：风扇的风)", "什么火没有烟？(答案：怒火/萤火)", "什么树没有叶子？(答案：铁树)", "什么星最亮？(答案：启明星)", "什么话最难听？(答案：脏话)", "什么网捉不到鱼？(答案：因特网)", "什么药没有苦味？(答案：火药/后悔药)", "什么光不能照明？(答案：激光/目光)", "为什么天上有两个太阳？(答案：因为那是反射/幻日)", "什么虫最懒？(答案：懒虫)", "什么水是绿色的？(答案：绿水)", "什么事大家都不想做？(答案：坏事)", "什么人最容易感冒？(答案：体弱多病的人)", "什么东西不怕冷？(答案：雪人)", "什么锅不能煮饭？(答案：黑锅)", "什么碗不会碎？(答案：铁碗)", "什么布不能做衣服？(答案：抹布)", "什么墙不能挡风？(答案：防火墙)", "什么笔最长？(答案：画笔)", "什么马最矮？(答案：矮脚马)", "什么羊不吃草？(答案：美羊羊/玩具羊)", "什么人最有钱？(答案：印钞厂老板)", "什么地不长草？(答案：水泥地)", "什么天不下雨？(答案：晴天)", "什么云最黑？(答案：乌云)", "什么鸟飞得最高？(答案：老鹰)", "什么树最耐寒？(答案：松树)", "什么花最香？(答案：桂花)", "什么草最高？(答案：巨竹是草本植物哦)", "什么鱼最大？(答案：鲸鲨，其实它是鱼)", "什么人最爱看书？(答案：书呆子)", "什么瓜最甜？(答案：甜瓜)", "什么人最会写诗？(答案：诗人)", "什么画最美？(答案：山水画)", "什么车最慢？(答案：牛车)", "什么路最长？(答案：丝绸之路)", "什么河最宽？(答案：亚马逊河)", "什么湖最深？(答案：贝加尔湖)", "什么山最高？(答案：珠穆朗玛峰)", "什么海最大？(答案：珊瑚海)", "什么洋最深？(答案：太平洋)", "什么洲最大？(答案：亚洲)", "什么国人最多？(答案：目前是印度)", "什么市最大？(答案：重庆市面积很大)", "什么省最大？(答案：新疆维吾尔自治区面积最大)", "什么县最小？(答案：有些海岛县很小)", "什么村最美？(答案：童话村)", "什么人最聪明？(答案：科学家)"], "riddles_en": ["What has keys but can't open locks? (A piano)", "What gets wetter the more it dries? (A towel)", "What has hands but cannot clap? (A clock)", "What belongs to you but other people use it more than you do? (Your name)", "What has to be broken before you can use it? (An egg)", "What has a head and a tail but no body? (A coin)", "What has neck but no head? (A bottle)", "What starts with T, ends with T, and has T in it? (A teapot)", "What goes up but never comes down? (Your age)", "What runs all around a backyard, yet never moves? (A fence)", "What has one eye but can't see? (A needle)", "What is full of holes but still holds water? (A sponge)", "What is always in front of you but can't be seen? (The future)", "What has a thumb and four fingers, but is not alive? (A glove)", "What can you catch, but not throw? (A cold)", "What goes up and down but doesn't move? (A staircase)", "If you drop a yellow hat in the Red Sea, what does it become? (Wet)", "What gets bigger the more you take away? (A hole)", "What is black when it's clean and white when it's dirty? (A blackboard)", "What has words, but never speaks? (A book)", "What building has the most stories? (The library)", "What has a bottom at the top? (Your legs)", "What has teeth but cannot bite? (A comb)", "What kind of band never plays music? (A rubber band)", "What has many needles, but doesn't sew? (A Christmas tree)", "What runs but never walks, murmurs but never talks? (A river)", "I have keys but no doors. I have space but no room. You can enter but can't leave. What am I? (A keyboard)", "What has legs but cannot walk? (A table)", "What can you hear but not see or touch, even though you control it? (Your voice)", "What has a face but no eyes, nose, or mouth? (A clock)", "Where does today come before yesterday? (In the dictionary)", "What loses its head in the morning and gets it back at night? (A pillow)", "What has one horn and gives milk? (A milk truck)", "What goes through towns and over hills, but never moves? (A road)", "What kind of room has no doors or windows? (A mushroom)", "What is orange and sounds like a parrot? (A carrot)", "What can you keep after giving to someone else? (Your word)", "What has four wheels and flies? (A garbage truck)", "What type of tree can you carry in your hand? (A palm)", "What kind of coat is best put on wet? (A coat of paint)", "What is hard to find, easy to lose, and makes you rich? (A friend)", "What is as light as a feather, yet the strongest man can't hold it for much more than a minute? (His breath)", "What starts with P, ends with E, and has thousands of letters? (The Post Office)", "What word is spelled incorrectly in every dictionary? (Incorrectly)", "What begins with an E and only contains one letter? (An envelope)", "What gets sharper the more you use it? (The brain)", "What is so fragile that saying its name breaks it? (Silence)", "What can you hold in your left hand but not in your right? (Your right elbow)", "What runs but has no legs? (Water / A nose)", "What has a mouth but never eats? (A river)", "What has three feet but cannot walk? (A yardstick)", "What has head and shoulders but no body? (A statue)", "What travels around the world but stays in one corner? (A stamp)", "What has a spine but no bones? (A book)", "What has cities but no houses, forests but no trees, and rivers but no water? (A map)", "What falls but never hurts? (Rain / Snow)", "What breaks but never falls? (Day)", "What is dry when it enters, and wet when it exits? (Chewing gum)", "What is always coming but never arrives? (Tomorrow)", "What has many leaves but is not a tree? (A book)", "What has claws but is not a cat? (A crab / lobster)", "What has wings but is not a bird? (An airplane)", "What gets shorter as it grows older? (A candle)", "What ring is not round? (A boxing ring)", "What key opens no door? (A monkey / turkey)", "What has a tail but is not an animal? (A kite)", "What has bark but no bite? (A tree)", "What is red and sweet and grows on vines? (A strawberry)", "What has white teeth but black skin? (A piano)", "What grows in winter and dies in summer? (An icicle)", "What has a tongue but cannot taste? (A shoe)", "What gets colder the hotter it is? (An air conditioner)", "What has no beginning, middle, or end? (A circle)", "What is green and hops? (A frog)", "What has a shell but is not an egg? (A turtle / snail)", "What has a neck but no head? (A guitar)", "What has strings but no bow? (A harp)", "What has keys but no keyhole? (A computer)", "What has mouse but no whiskers? (A computer mouse)", "What is round and has 12 numbers? (A clock face)", "What is yellow and long and monkeys love? (A banana)", "What has a pocket but no pants? (A kangaroo)", "What has fur and purrs? (A cat)", "What has four legs and barks? (A dog)", "What has a trunk but no clothes? (An elephant)", "What has humps but is not a hill? (A camel)", "What has black and white stripes? (A zebra)", "What has a long neck and spots? (A giraffe)", "What is king of the jungle? (A lion)", "What is the largest land mammal? (An elephant)", "What is the fastest land animal? (A cheetah)", "What lives in the water and has fins? (A fish)", "What is green and has sharp teeth? (A crocodile)", "What has no legs and slithers? (A snake)", "What is small and makes honey? (A bee)", "What has colorful wings? (A butterfly)", "What has 8 legs and spins webs? (A spider)", "What is slow and carries its house? (A snail)", "What is the largest bird? (An ostrich)", "What is the tallest mammal? (A giraffe)"], "whys_zh": ["为什么海水是蓝色的？(因为海水散射了波长较短的蓝色光)", "为什么天空是蓝色的？(大气分子散射太阳光中波长较短的蓝光较强)", "为什么向日葵跟着太阳转？(因为向日葵背光侧生长素多，生长快，使茎朝向太阳弯曲)", "为什么落叶是黄色的？(秋天叶绿素分解，胡萝卜素和叶黄素显现出来)", "为什么仙人掌有刺？(叶子退化成刺以减少水分蒸发，适应干旱环境)", "为什么猫洗脸？(猫洗脸是为了清洁面部，清除气味，保持胡须敏感)", "为什么狗伸舌头？(狗没有汗腺，伸舌头是为了蒸发水分散热降温)", "为什么萤火虫发光？(通过荧光素发光来吸引配偶或发出警告)", "为什么下雨后会有彩虹？(阳光穿过空气中的水滴折射和反射形成的)", "为什么打雷先看到闪电？(光在空气中的传播速度远大于声音的速度)", "为什么海水是咸的？(陆地河流将矿物质冲刷入海，水分蒸发积聚了盐分)", "为什么肥皂泡是五彩的？(光的干涉现象，光线在薄膜内外表面反射产生的)", "为什么苹果熟了会掉下来？(地球的万有引力吸引着苹果)", "为什么南极比北极冷？(南极是高原大陆，海拔高；北极是海洋，水比热容大)", "为什么蜘蛛不会被自己的网粘住？(因为蜘蛛脚上有油脂，且它走在没有黏性的辐射网上)", "为什么鸟站在电线上不会触电？(鸟的双脚站在同一条电线上，没有形成电压差)", "为什么我们要睡觉？(为了让大脑和身体排毒、修复，并巩固记忆)", "为什么打哈欠会传染？(人类的镜像神经元活动引起的共情反应)", "为什么指甲剪掉不疼？(因为指甲是由死去的角质蛋白组成的，没有神经分部)", "为什么感冒会鼻塞？(鼻腔黏膜血管扩张充血，产生炎症渗出物)", "为什么人会做梦？(整理白天的记忆和情感，让大脑皮层部分区域活跃产生视觉表象)", "为什么流星会发光？(流星体进入大气层时与空气高速摩擦发热而燃烧发光)", "为什么月亮有阴晴圆缺？(月球绕地球公转，阳光照射角度不同导致我们看到的亮部不同)", "为什么地球是圆的？(重力作用使物质均匀向中心吸引，形成最稳定的球形)", "为什么水能灭火？(水蒸发吸收大量热，且水蒸气阻绝了氧气接触)", "为什么纸吸水？(毛细管现象，纸纤维之间有许多微小的孔隙)", "为什么洋葱辣眼睛？(切洋葱时释放出一种酸性挥发气体，刺激眼部产生泪水保护)", "为什么头发会变白？(毛囊中的黑色素细胞活性降低，无法产生黑色素)", "为什么香蕉是弯的？(香蕉在生长中为了争取更多阳光向上弯曲生长，即负向重力性)", "为什么死海能让人漂浮？(死海含盐量极高，水的密度大于人体密度，浮力极大)", "为什么肥皂能去污？(肥皂分子一端亲水一端亲油，能把油污拉入水中洗掉)", "为什么成熟的香蕉会催熟其他水果？(因为香蕉会释放乙烯气体，是一种植物催熟激素)", "为什么火山会喷发？(地球内部炽热的岩浆受高压沿地壳薄弱处喷涌而出)", "为什么温泉水是温的？(地下水受地热或板块摩擦加热后涌出地表)", "为什么地震会发生？(地壳板块碰撞、挤压导致地层断裂，释放巨大能量产生震动)", "为什么有四季变化？(地球自转轴倾斜，绕太阳公转导致各地阳光照射角度四季不同)", "为什么会有潮汐？(主要是月球和太阳对地球海水的万有引力引起的)", "为什么风会吹？(空气在不同气压差和温度差作用下流动形成风)", "为什么雨会下？(云中的小水滴聚集变重，重力大于浮力时落下)", "为什么雪花是六角形的？(水分子结晶时的晶格结构呈六角对称)", "为什么冰会浮在水面上？(冰的密度比液态水小，因为结冰时分子间空隙变大)", "为什么铁会生锈？(铁在氧气和水的共同作用下发生电化学腐蚀)", "为什么蜡烛燃烧有火焰？(石蜡受热气化为气体燃料燃烧产生的发光现象)", "为什么电池有电？(电池内部发生化学反应，产生电子流动形成电流)", "为什么蚊子咬人会痒？(蚊子吐出含有抗凝血和麻醉成分的唾液引起身体免疫红肿免疫反应)", "为什么苍蝇总搓脚？(清除脚上的食物残渣和尘土，保持味觉感受器灵敏)", "为什么壁虎能飞檐走壁？(脚趾上有数百万根微细刚毛，产生分子间引力——范德华力)", "为什么变色龙会变色？(皮肤真皮层里的色素细胞和纳米晶体反射不同颜色的光来表达情绪)", "为什么公鸡打鸣？(由生物钟控制，宣示领地主权并吸引异性)", "为什么鸭子走路一摇一摆？(鸭子脚蹼大且身体重心偏后，需要摇摆来保持平衡)", "为什么鱼身上有黏液？(减少游泳时的水阻力，且能防御细菌、毒素和寄生虫侵袭)", "为什么蛇要蜕皮？(随着身体长大，旧皮肤限制生长，且能去除寄生虫)", "为什么长颈鹿脖子那么长？(自然选择结果，长脖子能吃到高处的嫩叶)", "为什么大象耳朵那么大？(扇动耳朵加速血管散热，且听觉极为灵敏)", "为什么袋鼠有育儿袋？(袋鼠是有袋类动物，早产的幼崽需要在袋里吸乳发育)", "为什么斑马有条纹？(条纹能干扰吸血蝇的视觉系统，且有群防天敌的伪装效果)", "为什么熊猫只吃竹子？(虽然是食肉目，但演化中丧失了鲜味基因，且竹子随处可得)", "为什么树有年轮？(树木在四季生长的快慢不同，春天木质部疏松颜色浅，秋天紧密颜色深)", "为什么花有颜色？(含有花青素、类胡萝卜素等色素，用以吸引昆虫传粉)", "为什么蒲公英会飞？(种子带有绒毛，像小降落伞一样借助风力传播到远方)", "为什么有些植物吃昆虫？(生长在缺氮环境中，通过捕食昆虫补充氮等营养)", "为什么水果生的时候是酸的？(含有机酸，保护未成熟的种子不被吃掉)", "为什么盐能防腐？(高浓度盐水使细菌细胞脱水死亡，从而无法繁殖)", "为什么微波炉能加热食物？(利用微波使食物中的水分子高速振动摩擦生热)", "为什么冰箱能保鲜？(低温能抑制细菌的繁殖和食物内酶的活性，延缓腐烂)", "为什么电磁炉没火也能加热？(利用电磁感应原理在铁锅底部产生涡流发热)", "为什么安全气囊能保护人？(碰撞时快速充气，延长受力时间，降低撞击冲击力)", "为什么飞机能飞上天？(机翼上表面弯曲使空气流速快气压低，下表面气压高形成升力)", "为什么热气球会上升？(热空气密度比冷空气小，热气球所受浮力大于重力)", "为什么潜水艇能沉能浮？(通过向水舱注水或排水来改变自身重量，控制沉浮)", "为什么自行车骑起来不会倒？(前轮的定轴性及骑行者的转向修正共同保持平衡)", "为什么镜子能照出人？(镜面极度平整，光线发生镜面反射形成清晰虚像)", "为什么近视镜是凹透镜？(凹透镜发散光线，使折射光线能准确聚焦在视网膜上)", "为什么彩电能显示各种颜色？(利用红、绿、蓝三基色混合原理组合成万千色彩)", "为什么电脑能计算？(利用晶体管的通断电状态代表二进制的0和1进行逻辑运算)", "为什么光纤通信快？(利用光在玻璃纤维中的全反射传输信号，频带极宽衰减小)", "为什么指南针能指南？(地球本身是一个大磁体，指南针受地磁场作用指向南北)", "为什么磁铁能吸铁？(磁铁中的电子自旋磁矩整齐排列，产生磁场吸引磁性物质)", "为什么太阳会发光？(太阳核心在极高压和高温下发生持续的氢核聚变反应)", "为什么月亮不发光？(月亮表面反射了太阳的光线)", "为什么流星雨不是真的雨？(是地球穿过彗星遗留的尘埃带时，大量尘埃冲入大气层燃烧)", "为什么黑洞看不见？(引力极强，连宇宙中速度最快的光也无法逃逸出来)", "为什么火会往上烧？(燃烧加热了周围空气，热空气密度低上升带动火焰向上)", "为什么水沸腾会冒泡？(底部受热变成的水蒸气泡在上升中膨胀破裂释放气体)", "为什么高山上煮饭不容易熟？(海拔高气压低，水的沸点降低，水不到100度就开了)", "为什么会有雾？(近地面空气中的水蒸气遇冷凝结成微小的水滴悬浮在空中)", "为什么会有露水？(夜间地面物体降温，近地面水蒸气在其表面凝结成小水珠)", "为什么会有霜？(夜间气温降到0度以下，水蒸气在物体表面直接凝华成冰晶)", "为什么会有冰雹？(云中冰晶在强烈的上升气流中反复起伏吸水凝结，变重后坠落)", "为什么出汗能散热？(汗液蒸发需要吸收身体的大量汽化热)", "为什么眼泪是咸的？(眼泪中含有血液中渗出的微量无机盐，主要是氯化钠)", "为什么眨眼能保护眼睛？(湿润眼球，清除微小灰尘并防止强光刺眼)", "为什么伤口会结痂？(血小板凝集并与纤维蛋白形成血栓，干燥后形成硬痂保护伤口)", "为什么运动后肌肉酸痛？(肌肉在缺氧状态下进行无氧呼吸，产生了乳酸堆积)", "为什么多吃糖会长胖？(摄入的多余糖分会被身体转化为脂肪储存起来)", "为什么牛奶是白色的？(牛奶中的酪蛋白胶粒和乳脂微粒对光线发生均匀的散射)", "为什么红糖比白糖甜？(红糖含有更多杂质和微量矿物质，白糖主要是纯蔗糖)", "为什么茶叶能提神？(茶叶中含有咖啡因，能刺激中枢神经系统产生兴奋)", "为什么吃辣椒觉得热？(辣椒素激活了舌头上的温度感受器VR1，产生热辣感)", "为什么汽水里有泡泡？(在高压下将二氧化碳气体溶入水中，开瓶气压降低气体逸出)"], "whys_en": ["Why is the sky blue? (Because air molecules scatter blue light from the sun more than other colors)", "Why is the ocean blue? (Water molecules absorb red light and scatter blue light)", "Why do leaves turn yellow in autumn? (Because chlorophyll decays, revealing yellow and orange pigments)", "Why do sunflowers turn toward the sun? (Because auxin builds up on the shaded side, making it grow faster and bend the stem)", "Why do cacti have needles? (Modified leaves that reduce water evaporation to survive in dry climates)", "Why do cats wash their faces? (To clean up, remove food scent, and keep their whiskers sensitive)", "Why do dogs stick out their tongues? (They have no sweat glands and pant to evaporate water for cooling)", "Why do fireflies glow? (They use bioluminescence to attract mates or warn predators)", "Why do rainbows appear after rain? (Sunlight is refracted and reflected through water droplets in the air)", "Why do we see lightning before hearing thunder? (Light travels much faster than sound in the air)", "Why is seawater salty? (Rain washes minerals from land into rivers, which accumulate in the sea as water evaporates)", "Why do soap bubbles have colors? (Light interference as light reflects off the inner and outer thin film surfaces)", "Why do ripe apples fall? (Gravity attracts the apple toward the center of the Earth)", "Why is Antarctica colder than the Arctic? (Antarctica is a high elevation landmass; the Arctic is an ocean which holds heat)", "Why don't spiders get stuck in their own webs? (They have oily feet and walk on non-sticky structural threads)", "Why don't birds get shocked on power lines? (Both feet are on the same wire, creating no electrical potential difference)", "Why do we need to sleep? (To allow the brain and body to clear toxins, repair cells, and consolidate memory)", "Why is yawning contagious? (Caused by mirror neurons in our brain that trigger empathy)", "Why doesn't it hurt to cut fingernails? (Fingernails are made of dead keratin protein cells with no nerves)", "Why do we get a stuffy nose during a cold? (Blood vessels in the nasal cavity expand and swell due to inflammation)", "Why do we dream? (To process memories and emotions while letting parts of the brain stay active)", "Why do meteors glow? (Meteoroids burn up due to friction with air molecules when entering the atmosphere)", "Why does the moon change shapes? (As the moon orbits the Earth, we see different angles of its illuminated side)", "Why is the Earth round? (Gravity pulls all matter equally toward the center, forming a stable sphere)", "Why does water put out fire? (Water absorbs heat by vaporizing and blocks oxygen from reaching the fuel)", "Why does paper absorb water? (Capillary action draws liquid into the tiny pores between paper fibers)", "Why do onions make you cry? (Cutting onions releases a volatile gas that reacts with eye moisture to form a mild acid)", "Why does hair turn gray? (Hair follicles stop producing melanin pigment as we grow older)", "Why are bananas curved? (Bananas grow upwards toward the sun against gravity, a process called negative geotropism)", "Why do people float in the Dead Sea? (High salt content makes the water denser than the human body, providing high buoyancy)", "Why does soap clean dirt? (Soap molecules have a hydrophilic water-loving tail and a lipophilic oil-loving head)", "Why do ripe bananas ripen other fruits? (They release ethylene gas, a natural plant ripening hormone)", "Why do volcanoes erupt? (Hot magma under high pressure escapes through weak points in the Earth's crust)", "Why are hot springs warm? (Underground water is heated by geothermal energy or tectonic activity before rising)", "Why do earthquakes happen? (Tectonic plates collide or slide, releasing energy as seismic waves)", "Why do we have four seasons? (Earth's axis is tilted as it orbits the sun, changing the sunlight angle throughout the year)", "Why do tides happen? (Gravitational pull of the moon and the sun on Earth's oceans)", "Why does the wind blow? (Air flows from high pressure areas to low pressure areas due to temperature differences)", "Why does it rain? (Water droplets in clouds cluster, grow heavy, and fall due to gravity)", "Why are snowflakes six-sided? (The molecular structure of water forms a hexagonal lattice when freezing)", "Why does ice float on water? (Ice is less dense than liquid water because water molecules expand when freezing)", "Why does iron rust? (Iron undergoes chemical corrosion when exposed to oxygen and moisture)", "Why do candles have flames? (Heat vaporizes the wax into a gas which burns and emits light)", "Why do batteries have electricity? (Chemical reactions inside the battery create a flow of electrons)", "Why do mosquito bites itch? (Saliva injected by mosquitoes contains anticoagulants that trigger an immune histamine response)", "Why do flies rub their feet? (To clean off food residue and keep their chemical taste receptors clean)", "Why can geckos walk on walls? (Millions of tiny hairs on their toes create weak intermolecular attraction called van der Waals forces)", "Why do chameleons change color? (Guana crystals in their skin reflect different light wavelengths to show mood or regulate heat)", "Why do roosters crow? (Regulated by their internal circadian clock to assert territory and attract mates)", "Why do ducks waddle? (Their webbed feet are wide and set back, requiring rocking to maintain balance while walking)", "Why do fish have slime? (To reduce drag while swimming and protect against bacteria and parasites)", "Why do snakes shed skin? (To allow their bodies to grow and get rid of parasites attached to old skin)", "Why do giraffes have long necks? (Natural selection favored long necks to reach leaves high up in trees)", "Why do elephants have big ears? (Flapping ears cools blood vessels, and they provide excellent hearing)", "Why do kangaroos have pouches? (Kangaroos are marsupials; their underdeveloped babies grow and nurse inside the pouch)", "Why do zebras have stripes? (Stripes confuse the visual systems of biting flies and camouflage them in herds)", "Why do pandas only eat bamboo? (They lost the umami taste gene for meat during evolution, and bamboo is plentiful)", "Why do trees have rings? (Trees grow fast in spring making light wood, and slow in autumn making dark tight wood)", "Why do flowers have colors? (They contain pigments like anthocyanins to attract insects for pollination)", "Why do dandelions fly? (Seeds have fluffy parachutes that catch the wind to carry them far away)", "Why do some plants eat insects? (They grow in nitrogen-poor soils and digest bugs to get nutrients)", "Why are unripe fruits sour? (They contain organic acids to protect seeds until they are mature)", "Why does salt preserve food? (High salinity draws water out of bacterial cells, killing or disabling them)", "Why do microwaves heat food? (Microwaves cause water molecules in food to vibrate rapidly, generating heat)", "Why do refrigerators keep food fresh? (Low temperature slows down bacterial growth and chemical reactions)", "Why do induction cooktops heat without fire? (Electromagnetic induction creates electric currents directly in iron pans)", "Why do airbags protect us? (They inflate rapidly to slow down deceleration and absorb impact forces during a crash)", "Why do airplanes fly? (Wing curvature makes air flow faster over the top, creating lower pressure and generating lift)", "Why do hot air balloons rise? (Hot air is less dense than cold air, generating buoyancy greater than gravity)", "Why can submarines sink and float? (They flood or vent ballast tanks to adjust weight and control buoyancy)", "Why doesn't a bicycle fall while riding? (Angular momentum and steering adjustments by the rider keep it upright)", "Why do mirrors reflect images? (The flat reflective layer reflects light waves symmetrically to form virtual images)", "Why do nearsighted people wear concave lenses? (Concave lenses diverge light so it focuses correctly on the retina)", "Why do color TVs show colors? (They mix Red, Green, and Blue subpixels in varying intensities to form colors)", "Why can computers calculate? (Transistors switch on and off to represent binary 0 and 1 for logic gates)", "Why is fiber-optic communication fast? (Uses total internal reflection of light waves with very high bandwidth)", "Why do compasses point north? (Earth acts as a giant magnet, aligning the needle with its magnetic field)", "Why do magnets attract iron? (Aligned electron spins in the magnet create a magnetic force field)", "Why does the sun shine? (High temperature and pressure in its core cause nuclear fusion of hydrogen into helium)", "Why doesn't the moon shine on its own? (It reflects sunlight falling on its rocky surface)", "Why aren't meteor showers real rain? (Dust and debris left by comets enter the atmosphere and burn up as meteors)", "Why are black holes invisible? (Their gravity is so strong that even light cannot escape their boundary)", "Why do fires burn upwards? (Fire heats air, making it less dense so it rises and drags the flames up)", "Why does boiling water bubble? (Steam generated at the bottom rises and bursts at the surface)", "Why is it hard to cook rice on high mountains? (Low air pressure drops the boiling point of water below 100 degrees Celsius)", "Why does fog form? (Water vapor near the ground cools and condenses into tiny droplets suspended in air)", "Why does dew form? (Ground surfaces cool down at night, condensing water vapor into water droplets)", "Why does frost form? (Water vapor directly crystallizes into ice on cold surfaces below freezing)", "Why does hail fall? (Ice pellets are carried up and down in updrafts, collecting layers of water before falling)", "Why does sweating cool us down? (Evaporating sweat absorbs heat from the skin)", "Why are tears salty? (Tears contain mineral salts like sodium chloride filtered from the blood)", "Why do we blink? (To spread moisture, clear dust, and protect eyes from bright light)", "Why do wounds scab? (Platelets and fibrin form a clot that dries into a protective scab)", "Why do muscles hurt after exercise? (Anaerobic respiration in muscle cells produces lactic acid buildup)", "Why does eating sugar make us fat? (Excess sugar is converted and stored by the body as fat tissue)", "Why is milk white? (Casein proteins and fat droplets scatter light waves uniformly)", "Why is brown sugar different from white sugar? (Brown sugar retains molasses and minerals; white sugar is pure sucrose)", "Why does tea keep us awake? (Tea leaves contain caffeine, which stimulates the central nervous system)", "Why do chili peppers taste hot? (Capsaicin triggers heat receptors on the tongue, creating a hot sensation)", "Why do sodas fizz? (Carbon dioxide gas dissolved under high pressure escapes when the bottle is opened)"]};

function showRandomFunFact() {
    const isZh = (typeof currentLang !== 'undefined' ? currentLang : 'zh') === 'zh';
    const categories = ['quotes', 'riddles', 'whys'];
    const cat = categories[Math.floor(Math.random() * categories.length)];
    const dbKey = cat + '_' + (isZh ? 'zh' : 'en');
    const pool = FUN_FACTS_DB[dbKey] || [];
    
    if (pool.length === 0) return;
    const item = pool[Math.floor(Math.random() * pool.length)];
    
    // Determine title for formatting
    let prefix = '';
    if (isZh) {
        if (cat === 'quotes') prefix = '【每日名言】';
        if (cat === 'riddles') prefix = '【脑筋急转弯】';
        if (cat === 'whys') prefix = '【十万个为什么】';
    } else {
        if (cat === 'quotes') prefix = '[Famous Quote] ';
        if (cat === 'riddles') prefix = '[Brain Teaser] ';
        if (cat === 'whys') prefix = '[Did You Know?] ';
    }
    
    showBubbleText(prefix + item);
}
