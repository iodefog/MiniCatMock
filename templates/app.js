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
    document.getElementById(tabId).classList.add('active');

    // 同步 body class，控制是否隐藏左侧请求列表
    document.body.className = document.body.className.replace(/\btab-\S+/g, '');
    document.body.classList.add('tab-' + tabId);
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
    } catch (err) {
        document.getElementById('qrcode-loading').innerText = '⚠️ 获取 IP 失败，请确认服务已启动';
    }

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
        // 1. HTTP 方法 / Mock 状态分类过滤
        if (filterType === 'GET' && log.method !== 'GET') return false;
        if (filterType === 'POST' && log.method !== 'POST') return false;
        if (filterType === 'mocked' && !log.mock_matched) return false;
        if (filterType === 'missed' && log.mock_matched) return false;

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
    const modelSel = document.getElementById('ai-model-select');
    const keyInput = document.getElementById('ai-api-key-input');
    const epInput = document.getElementById('ai-custom-endpoint');

    providerSel.value = cfg.provider || 'deepseek';
    keyInput.value = cfg.apiKey || '';
    epInput.value = cfg.endpoint || '';

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

    if (!model) {
        const models = AI_MODELS[provider] || [];
        model = models.length > 0 ? models[0] : 'gpt-3.5-turbo';
    }

    if (!apiKey) {
        showToast('⚠️ 请输入 API Key', '#f59e0b');
        return;
    }
    
    const cfg = { provider, model, apiKey, endpoint };
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
document.addEventListener('DOMContentLoaded', checkForUpdates);
