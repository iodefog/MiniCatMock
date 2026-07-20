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

