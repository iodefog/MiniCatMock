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

// ─── Admin 大盘面板（双击侧边栏 Admin User 打开） ───
function openAdminDashboard() {
    if (document.getElementById('admin-dashboard-mask')) return;
    const mask = document.createElement('div');
    mask.className = 'tmodal-mask';
    mask.id = 'admin-dashboard-mask';
    mask.onclick = (e) => {
        if (e.target === mask) { stopAdminDashRefresh(); mask.remove(); }
    };
    const modal = document.createElement('div');
    modal.className = 'tmodal admin-dash';
    modal.innerHTML = `
        <h3>📊 大盘数据</h3>
        <div class="tmodal-hint">小猫 Mock 全局服务的实时运行概况</div>
        <div class="admin-grid">
            <div class="admin-card online">
                <div class="admin-val" id="adm-online">—</div>
                <div class="admin-lbl">当前在线人数</div>
            </div>
            <div class="admin-card total">
                <div class="admin-val" id="adm-total">—</div>
                <div class="admin-lbl">总注册人数</div>
            </div>
            <div class="admin-card packets">
                <div class="admin-val" id="adm-packets">—</div>
                <div class="admin-lbl">累计抓包请求量</div>
            </div>
            <div class="admin-card mocked">
                <div class="admin-val" id="adm-mocked">—</div>
                <div class="admin-lbl">本次会话 Mock 命中</div>
            </div>
            <div class="admin-card session">
                <div class="admin-val" id="adm-session">—</div>
                <div class="admin-lbl">本次会话代理请求</div>
            </div>
        </div>
        <div class="tmodal-actions">
            <button onclick="refreshAdminDashboard()">🔄 刷新</button>
            <button class="tmodal-save" onclick="this.closest('.tmodal-mask').remove(); stopAdminDashRefresh();">关闭</button>
        </div>`;
    mask.appendChild(modal);
    document.body.appendChild(mask);
    refreshAdminDashboard();
    window._adminDashTimer = setInterval(refreshAdminDashboard, 5000);
}

function stopAdminDashRefresh() {
    if (window._adminDashTimer) { clearInterval(window._adminDashTimer); window._adminDashTimer = null; }
}

async function refreshAdminDashboard() {
    try {
        const res = await fetch('/api/telemetry-stats');
        const data = await res.json();
        if (!data || data.error) return;
        const set = (id, v) => { const el = document.getElementById(id); if (el) el.innerText = v; };
        set('adm-online', (data.online_users ?? 0).toLocaleString() + ' 人');
        set('adm-total', (data.total_users ?? 0).toLocaleString() + ' 人');
        set('adm-packets', (data.total_packets ?? 0).toLocaleString() + ' 次');
        set('adm-mocked', (data.session_mocked ?? 0).toLocaleString() + ' 次');
        set('adm-session', (data.session_total ?? 0).toLocaleString() + ' 次');
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

    // 兼容未传入 el 的调用（如 openPathMappingManager），按 tabId 反查对应按钮
    if (!el) {
        el = document.querySelector('.tab-btn[onclick*="' + tabId + '"]');
    }
    if (el) el.classList.add('active');
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

    // 切到服务设置 tab 时，初始化路径映射面板
    if (tabId === 'connect-tab' && typeof initPathMappingPanel === 'function') {
        initPathMappingPanel();
    }
}

// ─── 子选项卡切换 (Dashboard / Logs / Analytics) ───
let currentSubTab = 'dashboard';

function switchSubTab(mode) {
    currentSubTab = mode;
    
    // 切换顶栏按钮 active 样式（mode -> 中文标签映射）
    const SUBTAB_LABELS = { dashboard: '数据概览', logs: '实时日志', analytics: '流量分析', tracking: '埋点校验' };
    document.querySelectorAll('.middle-subtabs .subtab').forEach(tab => {
        if (tab.innerText.trim() === (SUBTAB_LABELS[mode] || mode)) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });

    const noSelect = document.getElementById('no-selection-state');
    const selState = document.getElementById('selection-state');
    const details = document.getElementById('details-layout');
    const logs = document.getElementById('logs-layout');
    const analytics = document.getElementById('analytics-layout');
    const tracking = document.getElementById('tracking-layout');

    // 隐藏所有主视图
    if (noSelect) noSelect.style.display = 'none';
    if (selState) selState.style.display = 'none';
    if (details) details.style.display = 'none';
    if (logs) logs.style.display = 'none';
    if (analytics) analytics.style.display = 'none';
    if (tracking) tracking.style.display = 'none';

    if (mode === 'dashboard') {
        if (currentSelectedLogId) {
            if (selState) selState.style.display = 'flex';
            if (details) details.style.display = 'grid';
        } else {
            if (noSelect) noSelect.style.display = 'flex';
        }
    } else if (mode === 'logs') {
        if (selState) selState.style.display = 'flex';
        if (logs) logs.style.display = 'flex';
        renderTerminalLogs();
    } else if (mode === 'analytics') {
        if (selState) selState.style.display = 'flex';
        if (analytics) analytics.style.display = 'flex';
        renderAnalyticsData();
    } else if (mode === 'tracking') {
        if (selState) selState.style.display = 'flex';
        if (tracking) tracking.style.display = 'flex';
        initTrackingPanel();
    }
}

