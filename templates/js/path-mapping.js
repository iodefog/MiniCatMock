// ─── 路径映射转发 (Path Mapping) 前端逻辑 ───
// 依赖 server.py 提供的接口：
//   GET  /api/path-mappings   → 规则数组 [{path, target_url, method, enabled}]
//   POST /api/path-mappings   → {mappings:[...]} 整体保存
//
// 典型场景：App 因 SDK 限制无法修改 Header，把真实请求改写到
//   /mock/sa?project=HWD
// 服务器按映射表（/sa → https://sc-sa.dramaboxdb.com/sa）完成真实转发，
// 原 query 参数（?project=HWD）自动拼接到真实 URL 上。

let pathMappingsCache = [];

// ─── 初始化（切到服务设置 tab 时调用）───
async function initPathMappingPanel() {
    try {
        const res = await fetch('/api/path-mappings');
        pathMappingsCache = await res.json();
        if (!Array.isArray(pathMappingsCache)) pathMappingsCache = [];
    } catch (e) {
        pathMappingsCache = [];
    }
    renderPathMappings();
}

// ─── 从「配置 Mock」旁快速跳转进入路径映射管理 ───
function openPathMappingManager() {
    // 直接执行 tab 切换所需的最小 DOM 操作，并用 try/catch 包裹，
    // 即使 switchTab 因任意旧版本/签名差异抛错，也不会中断、必定切换成功。
    try {
        if (typeof switchTab === 'function') {
            switchTab('connect-tab');
        } else {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            document.body.className = document.body.className.replace(/\btab-\S+/g, '');
            document.body.classList.add('tab-connect-tab');
            const tabEl = document.getElementById('connect-tab');
            if (tabEl) tabEl.classList.add('active');
            const btn = document.querySelector('.tab-btn[onclick*="connect-tab"]');
            if (btn) btn.classList.add('active');
        }
    } catch (e) {
        console.warn('[路径映射] 切换 tab 异常，已降级处理:', e);
    }
    // 等待 tab 切换与面板初始化后，滚动到路径映射区块
    setTimeout(() => {
        const el = document.querySelector('#pm-collapsible');
        if (el) {
            el.open = true;
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        if (typeof initPathMappingPanel === 'function') initPathMappingPanel();
    }, 180);
}

// ─── 渲染列表 ───
function renderPathMappings() {
    const list = document.getElementById('path-mapping-list');
    if (!list) return;
    list.innerHTML = '';
    if (!pathMappingsCache.length) {
        list.innerHTML = '<div class="pm-empty" style="font-size: 12px; color: var(--text-muted); padding: 12px; text-align: center; border: 1px dashed var(--border); border-radius: 8px;">暂无路径映射规则，点击右上角「＋ 新增映射」开始配置</div>';
        return;
    }
    pathMappingsCache.forEach((m, idx) => {
        const card = document.createElement('div');
        card.className = 'pm-card' + (m.enabled === false ? ' pm-disabled' : '');
        card.innerHTML = `
            <div class="pm-info">
                <div class="pm-rule">
                    <span class="pm-from">${escapeHtml(m.path)}</span>
                    <span class="pm-arrow">➜</span>
                    <span class="pm-to">${escapeHtml(m.target_url)}</span>
                </div>
                <div class="pm-meta">方法: <b>${escapeHtml(m.method || 'ANY')}</b>${m.force_response ? ' · <span class="pm-badge-force">强制返回</span>' : ''}</div>
            </div>
            <div class="pm-actions">
                <label class="switch pm-switch">
                    <input type="checkbox" ${m.enabled !== false ? 'checked' : ''} onchange="togglePathMapping(${idx}, this.checked)">
                    <span class="slider"></span>
                </label>
                <button class="pm-edit" onclick="openPathMappingEditor(${idx})">编辑</button>
                <button class="pm-del" onclick="deletePathMapping(${idx})">删除</button>
            </div>`;
        list.appendChild(card);
    });
}

// ─── 启停单条 ───
async function togglePathMapping(idx, enabled) {
    if (!pathMappingsCache[idx]) return;
    pathMappingsCache[idx].enabled = !!enabled;
    await savePathMappings();
    renderPathMappings();
}

// ─── 删除 ───
async function deletePathMapping(idx) {
    if (!pathMappingsCache[idx]) return;
    if (!confirm(`确认删除映射：\n${pathMappingsCache[idx].path} ➜ ${pathMappingsCache[idx].target_url}`)) return;
    pathMappingsCache.splice(idx, 1);
    await savePathMappings();
    renderPathMappings();
}

// 规范化匹配路径（与后端 _normalize_match_path 保持一致）：确保以 / 开头，去尾斜杠
function normalizeMappingPath(p) {
    p = (p || '').trim();
    if (!p) return '';
    if (!p.startsWith('/')) p = '/' + p;
    if (p.length > 1 && p.endsWith('/')) p = p.replace(/\/$/, '');
    return p;
}

// 当前编辑器对应的缓存索引（-1 表示新增）
let currentPmEditorIdx = -1;

// ─── 编辑器（-1 = 新增；也可直接传入预填对象 {path,target_url,...}）───
function openPathMappingEditor(idx) {
    let cur;
    let isEdit = false;
    if (typeof idx === 'object' && idx !== null) {
        // 来自日志长按的预填（新增）
        cur = idx;
        currentPmEditorIdx = -1;
    } else {
        isEdit = idx >= 0 && !!pathMappingsCache[idx];
        cur = isEdit ? pathMappingsCache[idx] : { path: '', target_url: '', method: 'ANY', enabled: true, force_response: '' };
        currentPmEditorIdx = idx >= 0 ? idx : -1;
    }

    const mask = document.createElement('div');
    mask.className = 'tmodal-mask';
    mask.onclick = (e) => { if (e.target === mask) mask.remove(); };

    const modal = document.createElement('div');
    modal.className = 'tmodal';
    modal.innerHTML = `
        <h3>${isEdit ? '编辑路径映射' : '新增路径映射'}</h3>
        <div class="pm-editor-hint" style="font-size: 11px; color: var(--text-muted); margin-bottom: 12px; line-height: 1.5;">
            例如：「匹配路径」填 <code>/sa</code>，「真实目标 URL」填 <code>https://sc-sa.dramaboxdb.com/sa</code>。<br>
            当收到 <code>/mock/sa?project=HWD</code> 时，会转发到 <code>https://sc-sa.dramaboxdb.com/sa?project=HWD</code>。
        </div>
        <div class="tform-group" style="margin-bottom: 12px;">
            <label>匹配路径 (Path)</label>
            <input id="pm-path" value="${escapeHtml(cur.path)}" placeholder="/sa">
        </div>
        <div class="tform-group" style="margin-bottom: 12px;">
            <label>真实目标 URL (Target URL)</label>
            <input id="pm-target" value="${escapeHtml(cur.target_url)}" placeholder="https://sc-sa.dramaboxdb.com/sa">
        </div>
        <div class="tform-group" style="margin-bottom: 12px;">
            <label>强制返回结果 (Force Response) <span style="color: var(--text-muted); font-weight: 400;">— 可选，不限制格式</span></label>
            <textarea id="pm-force" rows="4" style="width: 100%; font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 12px; resize: vertical;" placeholder="留空则正常转发到真实目标 URL；填写后命中该映射将直接返回此内容（JSON / XML / 纯文本 / HTML 均可），不再转发。">${escapeHtml(cur.force_response || '')}</textarea>
            <div class="pm-editor-hint" style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">
                例：<code>{"code":0,"data":{}}</code> 或 <code>&lt;html&gt;OK&lt;/html&gt;</code>；命中后请求体/响应由本服务器直接返回。
            </div>
        </div>
        <div class="tform-row" style="display: flex; gap: 12px; margin-bottom: 12px;">
            <div class="tform-group" style="flex: 1;">
                <label>请求方法</label>
                <select id="pm-method">
                    ${['ANY', 'GET', 'POST', 'PUT', 'DELETE', 'PATCH'].map(m =>
                        `<option value="${m}" ${m === (cur.method || 'ANY') ? 'selected' : ''}>${m}</option>`).join('')}
                </select>
            </div>
            <div class="tform-group" style="display: flex; align-items: flex-end;">
                <label class="stream-checkbox-label" style="display: flex; align-items: center; gap: 6px; font-size: 12px;">
                    <input type="checkbox" id="pm-enabled" ${cur.enabled !== false ? 'checked' : ''}>
                    <span>启用</span>
                </label>
            </div>
        </div>
        <div class="tmodal-actions">
            <button onclick="this.closest('.tmodal-mask').remove()">取消</button>
            <button class="tmodal-save" onclick="savePathMappingEditor()">保存</button>
        </div>`;
    mask.appendChild(modal);
    document.body.appendChild(mask);
}

async function savePathMappingEditor() {
    const path = document.getElementById('pm-path').value.trim();
    const target = document.getElementById('pm-target').value.trim();
    const method = document.getElementById('pm-method').value;
    const enabled = document.getElementById('pm-enabled').checked;
    const force = document.getElementById('pm-force').value;

    if (!path || !target) {
        alert('匹配路径与真实目标 URL 均不能为空');
        return;
    }
    const entry = { path, target_url: target, method: method || 'ANY', enabled, force_response: force || '' };

    const idx = currentPmEditorIdx;
    if (idx >= 0 && pathMappingsCache[idx]) {
        pathMappingsCache[idx] = entry;
    } else {
        pathMappingsCache.push(entry);
    }
    await savePathMappings();
    closeTopModal();
    renderPathMappings();
}

// ─── 持久化整体保存 ───
async function savePathMappings() {
    try {
        await fetch('/api/path-mappings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mappings: pathMappingsCache })
        });
    } catch (e) {
        alert('保存失败: ' + e);
    }
}
