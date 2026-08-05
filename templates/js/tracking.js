// ─── 埋点校验面板 (Tracking Validation) 前端逻辑 ───
// 依赖 server.py 提供的接口：
//   GET  /api/tracking/rules        → 规则数组
//   POST /api/tracking/rules        → {rules:[...]}
//   GET  /api/tracking/config       → {sources:[...]}
//   POST /api/tracking/config       → {sources:[...]}
//   POST /api/tracking/start        → 开始录制（清空聚合）
//   POST /api/tracking/stop         → 结束录制
//   GET  /api/tracking/results      → 聚合结果

let trackingRulesCache = [];
let trackingSourcesCache = [];
let trackingPollTimer = null;
let trackingEditingId = null;     // 正在编辑的规则 id（null=新增）
let trackingExpanded = {};        // rule_id -> 是否展开明细
let trackingRecordingStart = null; // 录制开始时间戳
let trackingRecordingTimer = null; // 录制时长显示定时器

const TRACKING_TYPE_OPTIONS = ["", "string", "number", "bool"];

// ─── 更新埋点 Tab 上的规则计数徽章 ───
function updateTrackingTabCount() {
    const badge = document.getElementById('tracking-tab-count');
    if (!badge) return;
    const count = trackingRulesCache.length;
    if (count > 0) {
        badge.style.display = 'inline-flex';
        badge.textContent = count > 99 ? '99+' : count;
    } else {
        badge.style.display = 'none';
        badge.textContent = '0';
    }
}

// ─── 初始化面板（每次切到该 tab 调用）───
async function initTrackingPanel() {
    await Promise.all([loadTrackingRules(), loadTrackingSources()]);
    await refreshTrackingResults();
    startTrackingPolling();
}

function startTrackingPolling() {
    if (trackingPollTimer) clearInterval(trackingPollTimer);
    trackingPollTimer = setInterval(async () => {
        // 仅当面板可见时轮询
        const el = document.getElementById('tracking-layout');
        if (!el || el.style.display === 'none') return;
        await refreshTrackingResults();
    }, 1500); // 录制时用更快的轮询间隔
}

// ─── 加载数据 ───
async function loadTrackingRules() {
    try {
        const res = await fetch('/api/tracking/rules');
        trackingRulesCache = await res.json();
    } catch (e) {
        trackingRulesCache = [];
    }
    updateTrackingTabCount();
}

async function loadTrackingSources() {
    try {
        const res = await fetch('/api/tracking/config');
        const cfg = await res.json();
        trackingSourcesCache = cfg.sources || [];
    } catch (e) {
        trackingSourcesCache = [];
    }
    renderTrackingSources();
}

function renderTrackingSources() {
    const box = document.getElementById('tracking-sources');
    if (!box) return;
    box.innerHTML = '';
    trackingSourcesCache.forEach(s => {
        const tag = document.createElement('span');
        tag.className = 'tracking-src-tag';
        tag.textContent = s;
        box.appendChild(tag);
    });
}

// ─── 录制控制 ───
async function toggleTrackingRecording() {
    const badge = document.getElementById('tracking-rec-badge');
    const btn = document.getElementById('btn-tracking-rec');
    const recording = badge.classList.contains('recording');
    try {
        if (recording) {
            await fetch('/api/tracking/stop', { method: 'POST' });
            // 停止录制时长计时
            stopRecordingTimer();
        } else {
            await fetch('/api/tracking/start', { method: 'POST' });
            // 开始录制时长计时
            startRecordingTimer();
        }
    } catch (e) {}
    await refreshTrackingResults();
}

function startRecordingTimer() {
    trackingRecordingStart = Date.now();
    if (trackingRecordingTimer) clearInterval(trackingRecordingTimer);
    updateRecordingDuration();
    trackingRecordingTimer = setInterval(updateRecordingDuration, 1000);
}

function stopRecordingTimer() {
    trackingRecordingStart = null;
    if (trackingRecordingTimer) {
        clearInterval(trackingRecordingTimer);
        trackingRecordingTimer = null;
    }
    const durEl = document.getElementById('tracking-rec-duration');
    if (durEl) durEl.textContent = '';
}

function updateRecordingDuration() {
    if (!trackingRecordingStart) return;
    const durEl = document.getElementById('tracking-rec-duration');
    if (!durEl) return;
    const elapsed = Math.floor((Date.now() - trackingRecordingStart) / 1000);
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    durEl.textContent = mins > 0 
        ? ` (${mins}分${secs}秒)` 
        : ` (${secs}秒)`;
}

// ─── 拉取并渲染聚合结果 ───
async function refreshTrackingResults() {
    let data;
    try {
        const res = await fetch('/api/tracking/results');
        data = await res.json();
    } catch (e) {
        return;
    }
    // 录制状态徽章
    const badge = document.getElementById('tracking-rec-badge');
    const btn = document.getElementById('btn-tracking-rec');
    const durEl = document.getElementById('tracking-rec-duration');
    if (badge) {
        if (data.recording) {
            badge.className = 'tracking-rec-badge recording';
            badge.textContent = '● 录制中';
            // 如果之前未开始计时，启动计时
            if (!trackingRecordingStart) {
                startRecordingTimer();
            }
        } else {
            badge.className = 'tracking-rec-badge stopped';
            badge.textContent = '● 未录制';
            // 停止录制时清除计时
            if (trackingRecordingStart) {
                stopRecordingTimer();
            }
        }
    }
    if (btn) {
        if (data.recording) {
            btn.className = 'btn-tracking-rec recording';
            btn.textContent = '⏹ 结束录制';
        } else {
            btn.className = 'btn-tracking-rec';
            btn.textContent = '⏺ 开始录制';
        }
    }
    // 概览统计
    setText('tracking-stat-total', data.total || 0);
    setText('tracking-stat-hit', data.hit_count || 0);
    setText('tracking-stat-err', data.error_count || 0);

    // 录制状态提示信息
    const hintEl = document.getElementById('tracking-rec-hint');
    if (hintEl) {
        if (data.recording) {
            if (data.hit_count === 0 && data.error_count === 0) {
                hintEl.textContent = '⏳ 正在监听请求... 请在 App 中触发包含上述埋点事件（event）的接口请求';
                hintEl.style.color = 'var(--orange)';
            } else {
                hintEl.textContent = '✅ 已捕获到埋点数据，可继续操作或点击「结束录制」查看结果';
                hintEl.style.color = 'var(--green)';
            }
        } else {
            if (data.total > 0 && data.hit_count === 0 && data.error_count === 0) {
                hintEl.textContent = '📝 录制已结束，所有规则尚未命中。可将「来源接口关键字」留空（捕获所有 JSON 请求），或确认请求 body 中包含正确的 event 字段';
                hintEl.style.color = 'var(--text-muted)';
            } else if (data.total === 0) {
                hintEl.textContent = '📋 尚未配置埋点规则，请点击「新增埋点规则」或「批量粘贴导入」开始';
                hintEl.style.color = 'var(--text-muted)';
            } else {
                hintEl.textContent = '📊 以上为本次录制会话的校验结果（结果在重启服务后清空）';
                hintEl.style.color = 'var(--text-muted)';
            }
        }
    }

    renderTrackingRules(data.hits || {});
}

function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
}

// ─── 渲染规则列表 ───
function renderTrackingRules(hits) {
    const list = document.getElementById('tracking-rules-list');
    const empty = document.getElementById('tracking-empty');
    if (!list) return;

    if (!trackingRulesCache.length) {
        if (empty) empty.style.display = 'block';
        // 清掉除 empty 外的卡片
        list.querySelectorAll('.trule-card').forEach(c => c.remove());
        return;
    }
    if (empty) empty.style.display = 'none';

    // 重建列表（保留展开状态）
    list.innerHTML = '';
    trackingRulesCache.forEach(rule => {
        const rid = rule.id;
        const hit = hits[rid] || { hit: false, errors: [], samples: [], count: 0 };
        const card = buildRuleCard(rule, hit);
        list.appendChild(card);
    });
}

function buildRuleCard(rule, hit) {
    const rid = rule.id;
    const card = document.createElement('div');
    card.className = 'trule-card';
    // 命中但存在其余参数校验问题 → 黄边提示（仍算命中）
    if (hit.hit && hit.errors && hit.errors.length) card.classList.add('status-warn');

    // 状态判定：命中=绿勾（固定参数已匹配）；其余参数校验问题只是提示，不挡命中
    let badgeClass = 'miss', badgeText = '未命中';
    if (hit.hit) {
        badgeClass = 'hit'; badgeText = '✓ 已命中';
    }

    const paramsSummary = (rule.params || []).map(p => {
        let s = p.name;
        if (p.value) s += `=${p.value}`;
        if (p.type) s += `:${p.type}`;
        return s;
    }).join(', ');

    const main = document.createElement('div');
    main.className = 'trule-main';
    main.innerHTML = `
        <div class="trule-info">
            <div class="trule-event">${escapeHtml(rule.event)}</div>
            <div class="trule-scenario">${escapeHtml(rule.scenario || '')}</div>
            <div class="trule-params-summary">${escapeHtml(paramsSummary)}</div>
        </div>
        <div class="trule-right">
            <span class="trule-badge ${badgeClass}">${badgeText}</span>
            <span class="trule-count">${hit.count || 0} 次</span>
            <div class="trule-actions">
                <button onclick="openTrackingRuleEditor('${rid}')">编辑</button>
                <button onclick="deleteTrackingRule('${rid}')">删除</button>
            </div>
        </div>
        ${(hit.hit && hit.errors && hit.errors.length) ? `<div class="trule-warn-note">⚠ ${hit.errors.length} 项参数未上报/异常（不计入命中）</div>` : ''}`;
    main.onclick = (e) => {
        if (e.target.tagName === 'BUTTON') return; // 按钮自己处理
        trackingExpanded[rid] = !trackingExpanded[rid];
        renderDetail(card, rule, hit, trackingExpanded[rid]);
    };
    card.appendChild(main);

    if (trackingExpanded[rid]) {
        renderDetail(card, rule, hit, true);
    }
    return card;
}

function renderDetail(card, rule, hit, show) {
    // 移除旧 detail
    const old = card.querySelector('.trule-detail');
    if (old) old.remove();
    if (!show) return;

    const detail = document.createElement('div');
    detail.className = 'trule-detail';

    // 参数校验明细
    const ph = document.createElement('div');
    ph.innerHTML = '<h4>参数校验明细</h4>';
    const rows = document.createElement('div');
    rows.className = 'tparam-rows';
    // 样本取最近一次（固定参数已匹配，记录了 last_sample），用于展示真实参数值
    const _sampleObj = hit.last_sample || (hit.samples && hit.samples[0]) || null;
    const _sample = _sampleObj ? (_sampleObj.params || {}) : {};

    // 校验问题（其余参数：必填缺失/值不符/类型不符）映射，用于展示为中性“警告”
    const errMap = {};
    (hit.errors || []).forEach(err => { errMap[err.param] = err; });

    // 统一的行构造：命中只看固定参数是否匹配；其余参数校验问题展示为中性“警告”，不挡命中
    const mkRow = (p, actual, err) => {
        const missing = (actual === undefined || actual === null ||
                         (typeof actual === 'string' && actual.trim() === ''));
        if (err) return buildParamRow(p, actual, false, err, true);
        // “存在即可”(value 为空) 字段缺失 → 中性“未上报”，不挡命中
        if (missing && !(p.value)) return buildParamRow(p, actual, false, null, true);
        return buildParamRow(p, actual, true, null);
    };

    if (hit.hit) {
        // 已命中（固定参数匹配）：展示每个参数的期望/实际；其余参数缺失/异常显示“警告”
        (rule.params || []).forEach(p => {
            const err = errMap[p.name];
            const actual = (err && err.actual !== undefined) ? err.actual : _sample[p.name];
            rows.appendChild(mkRow(p, actual, err));
        });
        // 列出未在规则参数表中的额外校验问题
        (hit.errors || []).forEach(err => {
            if (!(rule.params || []).some(p => p.name === err.param)) {
                const r = document.createElement('div');
                r.className = 'tparam-row warn';
                r.innerHTML = `<span class="tparam-name">${escapeHtml(err.param)}</span>
                    <span class="tparam-expect">${escapeHtml(err.message)}</span>
                    <span class="tparam-state warn">异常</span>`;
                rows.appendChild(r);
            }
        });
    } else {
        const r = document.createElement('div');
        r.className = 'tparam-row';
        r.style.color = 'var(--text-muted)';
        r.textContent = '录制期内尚未捕获到该事件（event=' + rule.event + '）';
        rows.appendChild(r);
    }
    ph.appendChild(rows);
    detail.appendChild(ph);

    // 命中样本（校验通过显示全部样本；未通过时至少展示最近一次真实上报样本）
    const _showSamples = (hit.samples && hit.samples.length) ? hit.samples : (hit.last_sample ? [hit.last_sample] : []);
    if (_showSamples.length) {
        const sh = document.createElement('div');
        const title = (hit.samples && hit.samples.length)
            ? '命中样本（最近 ' + hit.samples.length + ' 条）'
            : '最近一次上报样本';
        sh.innerHTML = '<h4>' + title + '</h4>';
        const box = document.createElement('div');
        box.className = 'tsamples';
        _showSamples.forEach(s => {
            const d = document.createElement('div');
            d.className = 'tsample';
            d.textContent = '#' + s.log_id + '  event=' + s.event + '  ' +
                JSON.stringify(s.params);
            box.appendChild(d);
        });
        sh.appendChild(box);
        detail.appendChild(sh);
    }

    card.appendChild(detail);
}

function buildParamRow(param, actual, ok, err, warn) {
    const row = document.createElement('div');
    row.className = 'tparam-row ' + (warn ? 'warn' : (ok ? 'ok' : 'bad'));
    let expect = '存在即可';
    if (param.value) expect = '= ' + param.value;
    if (param.type) expect += (param.value ? ' ' : '') + '(' + param.type + ')';
    const missing = (actual === undefined || actual === null || (typeof actual === 'string' && actual.trim() === ''));
    const actualStr = missing ? '—缺失—' : String(actual);
    let stateCls, stateTxt;
    if (warn) {
        stateCls = 'warn';
        stateTxt = err ? (err.kind === 'missing' ? '未上报' : (err.kind === 'type' ? '类型不符' : '异常')) : '未上报';
    }
    else if (ok) { stateCls = 'ok'; stateTxt = 'OK'; }
    else { stateCls = 'bad'; stateTxt = err ? err.kind : 'FAIL'; }
    row.innerHTML = `
        <span class="tparam-name">${escapeHtml(param.name)}</span>
        <span class="tparam-expect">期望 ${escapeHtml(expect)}</span>
        <span class="tparam-actual ${stateCls}">实际 ${escapeHtml(actualStr)}</span>
        <span class="tparam-state ${stateCls}">${stateTxt}</span>`;
    return row;
}

// ─── 规则增删改 ───
function openTrackingRuleEditor(rid) {
    trackingEditingId = rid;
    const rule = rid ? trackingRulesCache.find(r => r.id === rid) : null;
    const isEdit = !!rule;
    const cur = rule || { id: '', event: '', scenario: '', params: [{ name: '', required: true, value: '', type: '' }] };

    const mask = document.createElement('div');
    mask.className = 'tmodal-mask';
    mask.onclick = (e) => { if (e.target === mask) mask.remove(); };

    const modal = document.createElement('div');
    modal.className = 'tmodal';
    modal.innerHTML = `
        <h3>${isEdit ? '编辑埋点规则' : '新增埋点规则'}</h3>
        <div class="tform-row">
            <div class="tform-group">
                <label>事件名 (event)</label>
                <input id="tr-event" value="${escapeHtml(cur.event)}" placeholder="如 buttonShow">
            </div>
            <div class="tform-group">
                <label>场景说明</label>
                <input id="tr-scenario" value="${escapeHtml(cur.scenario || '')}" placeholder="如 投屏按钮曝光">
            </div>
        </div>
        <label style="font-size:11px;font-weight:600;color:var(--text-muted);">参数约束</label>
        <div class="tparams-editor" id="tr-params"></div>
        <button class="tparam-edit-add" onclick="addTrackingParamRow()">＋ 添加参数</button>
        <div class="tmodal-actions">
            <button onclick="this.closest('.tmodal-mask').remove()">取消</button>
            <button class="tmodal-save" onclick="saveTrackingRule('${rid || ''}')">保存</button>
        </div>`;
    mask.appendChild(modal);
    document.body.appendChild(mask);

    const pe = modal.querySelector('#tr-params');
    (cur.params && cur.params.length ? cur.params : [{ name: '', required: true, value: '', type: '' }])
        .forEach(p => pe.appendChild(buildParamEditRow(p)));
}

function buildParamEditRow(p) {
    const row = document.createElement('div');
    row.className = 'tparam-edit-row';
    const typeOpts = TRACKING_TYPE_OPTIONS.map(t =>
        `<option value="${t}" ${t === (p.type || '') ? 'selected' : ''}>${t || '不校验'}</option>`).join('');
    row.innerHTML = `
        <input class="tp-name" value="${escapeHtml(p.name || '')}" placeholder="参数名">
        <select class="tp-req">
            <option value="true" ${p.required !== false ? 'selected' : ''}>必填</option>
            <option value="false" ${p.required === false ? 'selected' : ''}>可选</option>
        </select>
        <input class="tp-value" value="${escapeHtml(p.value || '')}" placeholder="期望值(空=不校验值)">
        <select class="tp-type">${typeOpts}</select>
        <button class="tparam-edit-del" onclick="this.parentElement.remove()">✕</button>`;
    return row;
}

function addTrackingParamRow() {
    const pe = document.getElementById('tr-params');
    if (pe) pe.appendChild(buildParamEditRow({ name: '', required: true, value: '', type: '' }));
}

async function saveTrackingRule(rid) {
    const event = document.getElementById('tr-event').value.trim();
    const scenario = document.getElementById('tr-scenario').value.trim();
    if (!event) { alert('事件名不能为空'); return; }
    const params = [];
    document.querySelectorAll('#tr-params .tparam-edit-row').forEach(row => {
        const name = row.querySelector('.tp-name').value.trim();
        if (!name) return;
        params.push({
            name,
            required: row.querySelector('.tp-req').value !== 'false',
            value: row.querySelector('.tp-value').value,
            type: row.querySelector('.tp-type').value,
        });
    });

    let existing = trackingRulesCache.slice();
    if (rid) {
        const idx = existing.findIndex(r => r.id === rid);
        const updated = { id: rid, event, scenario, params };
        if (idx >= 0) existing[idx] = updated; else existing.push(updated);
    } else {
        existing.push({ id: 'rule_' + Date.now(), event, scenario, params });
    }

    try {
        const res = await fetch('/api/tracking/rules', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rules: existing })
        });
        if (res.ok) {
            trackingRulesCache = existing;
            updateTrackingTabCount();
            closeTopModal();
            await refreshTrackingResults();
        }
    } catch (e) { alert('保存失败: ' + e); }
}

async function deleteTrackingRule(rid) {
    if (!confirm('确认删除该埋点规则？')) return;
    const existing = trackingRulesCache.filter(r => r.id !== rid);
    try {
        await fetch('/api/tracking/rules', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rules: existing })
        });
        trackingRulesCache = existing;
        updateTrackingTabCount();
        await refreshTrackingResults();
    } catch (e) {}
}

// ─── 来源编辑 ───
function openTrackingSourceEditor() {
    const mask = document.createElement('div');
    mask.className = 'tmodal-mask';
    mask.onclick = (e) => { if (e.target === mask) mask.remove(); };
    const modal = document.createElement('div');
    modal.className = 'tmodal';
    modal.innerHTML = `
        <h3>来源接口关键字</h3>
        <div class="tmodal-hint">留空则<b>捕获所有 JSON 请求</b>（最省心）。如需只校验特定接口，可增删多个关键字，按 original_url / path 包含匹配，如 ioslog、log.drdrab、aichat 等。</div>
        <div class="tparams-editor" id="tr-sources"></div>
        <button class="tparam-edit-add" onclick="addTrackingSourceRow()">＋ 添加关键字</button>
        <div class="tmodal-actions">
            <button onclick="this.closest('.tmodal-mask').remove()">取消</button>
            <button class="tmodal-save" onclick="saveTrackingSources()">保存</button>
        </div>`;
    mask.appendChild(modal);
    document.body.appendChild(mask);
    const box = modal.querySelector('#tr-sources');
    trackingSourcesCache.forEach(s =>
        box.appendChild(buildSourceRow(s)));
}

function buildSourceRow(s) {
    const row = document.createElement('div');
    row.className = 'tparam-edit-row';
    row.style.gridTemplateColumns = '1fr auto';
    row.innerHTML = `
        <input class="ts-src" value="${escapeHtml(s)}" placeholder="关键字">
        <button class="tparam-edit-del" onclick="this.parentElement.remove()">✕</button>`;
    return row;
}

function addTrackingSourceRow() {
    const box = document.getElementById('tr-sources');
    if (box) box.appendChild(buildSourceRow(''));
}

async function saveTrackingSources() {
    const sources = [];
    document.querySelectorAll('#tr-sources .ts-src').forEach(inp => {
        const v = inp.value.trim();
        if (v) sources.push(v);
    });
    if (!sources.length) sources.push('ioslog');
    try {
        await fetch('/api/tracking/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sources })
        });
        trackingSourcesCache = sources;
        renderTrackingSources();
        closeTopModal();
    } catch (e) {}
}

// ─── 批量粘贴导入 ───
function openTrackingImport() {
    const mask = document.createElement('div');
    mask.className = 'tmodal-mask';
    mask.onclick = (e) => { if (e.target === mask) mask.remove(); };
    const modal = document.createElement('div');
    modal.className = 'tmodal';
    modal.innerHTML = `
        <h3>批量粘贴导入埋点规则</h3>
        <div class="tmodal-hint">粘贴 JSON 数组，每条含 event / scenario / params[]（name, required, value, type）。<br>
        全部追加到现有规则列表（不合并）。示例：<br>
        [{"event":"buttonShow","scenario":"投屏按钮曝光","params":[{"name":"buttton_name","required":true,"value":"cast","type":"string"}]}]</div>
        <textarea id="tr-import" rows="12" style="width:100%;box-sizing:border-box;background:var(--surface2);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:10px;font-family:'JetBrains Mono',monospace;font-size:11px;"></textarea>
        <div class="tmodal-actions">
            <button onclick="this.closest('.tmodal-mask').remove()">取消</button>
            <button class="tmodal-save" onclick="applyTrackingImport()">导入</button>
        </div>`;
    mask.appendChild(modal);
    document.body.appendChild(mask);
}

async function applyTrackingImport(textOverride) {
    const txt = (textOverride !== undefined ? textOverride : document.getElementById('tr-import').value).trim();
    if (!txt) return false;
    let parsed;
    try {
        parsed = JSON.parse(txt);
    } catch (e) {
        alert('JSON 解析失败: ' + e.message);
        return false;
    }
    if (!Array.isArray(parsed)) { alert('根元素必须是数组'); return false; }
    // 规整 + 生成 id
    const imported = parsed.map(r => ({
        id: r.id || ('rule_' + r.event + '_' + Date.now() + Math.floor(Math.random() * 1000)),
        event: r.event,
        scenario: r.scenario || '',
        params: (r.params || []).map(p => ({
            name: p.name,
            required: p.required !== false,
            value: p.value || '',
            type: p.type || '',
        })),
    }));
    // 全部追加到现有（不合并，配置几条就显示几条）
    const merged = trackingRulesCache.concat(imported);
    try {
        await fetch('/api/tracking/rules', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rules: merged })
        });
        trackingRulesCache = merged;
        updateTrackingTabCount();
        closeTopModal();
        await refreshTrackingResults();
        return true;
    } catch (e) { alert('导入失败: ' + e); return false; }
}

function closeTopModal() {
    const m = document.querySelector('.tmodal-mask');
    if (m) m.remove();
}

// ─── AI 批量生成埋点规则 ───
// 用户输入需求 → 点击「生成」→ AI 输出 JSON 填入结果框 → 用户自行点「保存」追加
let _trackingAIGenAbort = null;

function openTrackingAIGenerate() {
    const mask = document.createElement('div');
    mask.className = 'tmodal-mask';
    mask.onclick = (e) => { if (e.target === mask) mask.remove(); };
    const modal = document.createElement('div');
    modal.className = 'tmodal tmodal-wide';
    modal.innerHTML = `
        <h3>✨ AI 批量生成埋点规则</h3>
        <div class="tmodal-hint">用自然语言描述你的埋点需求，AI 将生成以下示例结果，保存即可：<br>
        示例：<br>
        [{"event":"buttonShow","scenario":"投屏按钮曝光","params":[{"name":"buttton_name","required":true,"value":"cast","type":"string"}]}]</div>
        <label style="font-size:11px;font-weight:600;color:var(--text-muted);">需求描述</label>
        <textarea id="tr-ai-req" rows="4" style="width:100%;box-sizing:border-box;background:var(--surface2);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:10px;font-size:13px;resize:vertical;"></textarea>
        <div class="tmodal-actions" style="justify-content:flex-start;gap:8px;">
            <button class="tmodal-save" id="tr-ai-gen-btn" onclick="generateTrackingRulesAI()">🚀 生成</button>
            <span class="track-ai-status" id="tr-ai-status"></span>
        </div>
        <label style="font-size:11px;font-weight:600;color:var(--text-muted);margin-top:8px;">生成结果（可手动修改后保存）</label>
        <textarea id="tr-ai-result" rows="8" style="width:100%;box-sizing:border-box;background:var(--surface2);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:10px;font-family:'JetBrains Mono',monospace;font-size:11px;"></textarea>
        <div class="tmodal-actions">
            <button onclick="this.closest('.tmodal-mask').remove()">关闭</button>
            <button class="tmodal-save" onclick="saveTrackingAIGenResult()">💾 保存</button>
        </div>`;
    mask.appendChild(modal);
    document.body.appendChild(mask);
}

async function generateTrackingRulesAI() {
    const cfg = (typeof loadAIConfig === 'function') ? loadAIConfig() : {};
    if (!cfg || !cfg.apiKey) {
        alert('尚未配置 AI（请先在 AI 助手面板 ⚙️ 配置 API Key），无法生成。');
        return;
    }
    const reqEl = document.getElementById('tr-ai-req');
    const resultEl = document.getElementById('tr-ai-result');
    const statusEl = document.getElementById('tr-ai-status');
    const genBtn = document.getElementById('tr-ai-gen-btn');
    const req = (reqEl?.value || '').trim();
    if (!req) { statusEl.textContent = '⚠️ 请先填写需求描述'; statusEl.style.color = 'var(--orange)'; return; }

    if (_trackingAIGenAbort) _trackingAIGenAbort.abort();
    _trackingAIGenAbort = new AbortController();

    resultEl.value = '';
    statusEl.textContent = '⏳ AI 正在生成...';
    statusEl.style.color = 'var(--text-muted)';
    genBtn.disabled = true;

    const systemPrompt = `你是埋点规则生成助手。请根据用户的需求描述，生成符合规范的埋点校验规则 JSON 数组。
每条规则字段：
- event：事件名（英文驼峰，如 buttonShow、pageView）
- scenario：场景说明（中文，如「投屏按钮曝光」）
- params：参数约束数组，每项含：
    - name：参数名
    - required：是否必填（true/false）
    - value：期望固定值，空字符串 "" 表示不校验具体值（仅存在即可）
    - type：类型校验，可选空 "" / "string" / "number" / "bool"
要求：
1. 只输出一个 JSON 数组，不要任何解释、不要 Markdown 代码块标记。
2. 数组元素顺序与用户描述的需求顺序一致。`;

    const userPrompt = `请为以下需求生成埋点规则 JSON 数组：\n${req}`;

    try {
        const resp = await fetch('/api/ai-chat', {
            method: 'POST',
            signal: _trackingAIGenAbort.signal,
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
        let acc = '';

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
                        if (json.type === 'content_block_delta' && json.delta?.type === 'text_delta') delta = json.delta.text;
                    } else {
                        delta = json.choices?.[0]?.delta?.content || '';
                    }
                    if (delta) {
                        acc += delta;
                        resultEl.value = acc;
                        resultEl.scrollTop = resultEl.scrollHeight;
                        statusEl.textContent = '✍️ 生成中...';
                        statusEl.style.color = 'var(--text-muted)';
                    }
                } catch (parseErr) {
                    if (parseErr.message && !parseErr.message.startsWith('JSON')) throw parseErr;
                }
            }
        }
        // 清理可能被包裹的 ```json 包裹
        resultEl.value = stripCodeFence(acc).trim();
        statusEl.textContent = '✅ 生成完成（可修改后保存）';
        statusEl.style.color = 'var(--green)';
    } catch (err) {
        if (err.name === 'AbortError') {
            statusEl.textContent = '⏹️ 已中止';
        } else {
            statusEl.textContent = '❌ 生成失败';
            statusEl.style.color = '#ef4444';
            resultEl.value = `生成失败：${err.message}`;
        }
    } finally {
        genBtn.disabled = false;
    }
}

// 去掉 Markdown 代码块包裹（```json ... ```）
function stripCodeFence(text) {
    let t = (text || '').trim();
    const fence = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    if (fence) t = fence[1].trim();
    return t;
}

// 用户确认后，将生成结果作为批量导入追加到规则列表
async function saveTrackingAIGenResult() {
    const resultEl = document.getElementById('tr-ai-result');
    const txt = (resultEl?.value || '').trim();
    const statusEl = document.getElementById('tr-ai-status');
    if (!txt) { statusEl.textContent = '⚠️ 结果为空'; statusEl.style.color = 'var(--orange)'; return; }
    const ok = await applyTrackingImport(txt);
    if (!ok) {
        statusEl.textContent = '⚠️ 解析失败，请检查 JSON';
        statusEl.style.color = 'var(--orange)';
    }
}

function escapeHtml(s) {
    if (s === null || s === undefined) return '';
    return String(s).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

// ─── 埋点校验结果归档 ───
// 归档本次结果（可命名 + 自动日期）→ 主列表不再显示 → 从「归档列表」查看/恢复/删除

// 归档当前录制结果：弹出命名框（默认带日期）
function openArchiveSave() {
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    const defName = `归档 ${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const mask = document.createElement('div');
    mask.className = 'tmodal-mask';
    mask.onclick = (e) => { if (e.target === mask) mask.remove(); };
    const modal = document.createElement('div');
    modal.className = 'tmodal';
    modal.innerHTML = `
        <h3>📦 归档本次结果</h3>
        <div class="tmodal-hint">将当前录制校验结果快照保存，主列表随即清空（不再显示本次结果）。可从「归档列表」随时查看或恢复。</div>
        <label style="font-size:11px;font-weight:600;color:var(--text-muted);margin-top:6px;display:block;">归档名称（留空则使用默认）</label>
        <input id="tr-archive-name" value="${escapeHtml(defName)}" style="width:100%;box-sizing:border-box;background:var(--surface2);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:9px 12px;font-size:13px;margin-top:6px;">
        <div class="tmodal-actions">
            <button onclick="this.closest('.tmodal-mask').remove()">取消</button>
            <button class="tmodal-save" onclick="saveTrackingArchive()">💾 归档</button>
        </div>`;
    mask.appendChild(modal);
    document.body.appendChild(mask);
}

async function saveTrackingArchive() {
    const input = document.getElementById('tr-archive-name');
    const name = input ? input.value.trim() : '';
    try {
        const res = await fetch('/api/tracking/archive', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: name || null })
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        closeTopModal();
        await loadTrackingRules();   // 归档后规则列表已清空，重新拉取
        await refreshTrackingResults();
        showToast('📦 已归档本次结果');
    } catch (e) {
        showToast('归档失败：' + e.message, '#ef4444');
    }
}

// 清空埋点规则列表（不归档）
async function clearTrackingRules() {
    if (!confirm('确认清空埋点规则列表吗？此操作不会归档当前结果。')) return;
    try {
        const res = await fetch('/api/tracking/clear', { method: 'POST' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        trackingRulesCache = [];
        updateTrackingTabCount();
        await refreshTrackingResults();
        showToast('🗑️ 埋点列表已清空');
    } catch (e) {
        showToast('清空失败：' + e.message, '#ef4444');
    }
}

// 打开归档列表
async function openArchiveList() {
    const mask = document.createElement('div');
    mask.className = 'tmodal-mask';
    mask.onclick = (e) => { if (e.target === mask) mask.remove(); };
    const modal = document.createElement('div');
    modal.className = 'tmodal tmodal-wide';
    modal.innerHTML = `
        <h3>📂 归档列表</h3>
        <div class="ar-list" id="ar-list"><div class="pm-empty" style="text-align:center;color:var(--text-muted);padding:20px;">加载中...</div></div>
        <div class="tmodal-actions">
            <button onclick="this.closest('.tmodal-mask').remove()">关闭</button>
        </div>`;
    mask.appendChild(modal);
    document.body.appendChild(mask);
    await renderArchiveList();
}

async function renderArchiveList() {
    const list = document.getElementById('ar-list');
    if (!list) return;
    let archives = [];
    try {
        const res = await fetch('/api/tracking/archives');
        archives = await res.json();
    } catch (e) { archives = []; }

    if (!archives.length) {
        list.innerHTML = '<div class="pm-empty" style="text-align:center;color:var(--text-muted);padding:20px;">暂无归档记录</div>';
        return;
    }
    list.innerHTML = archives.map(a => {
        const s = a.summary || {};
        return `
        <div class="ar-item">
            <div class="ar-info">
                <div class="ar-name">${escapeHtml(a.name || '未命名归档')}</div>
                <div class="ar-meta">${escapeHtml(a.date || '')} · 共 ${s.total || 0} 条 · 命中 ${s.hit_count || 0} · 异常 ${s.error_count || 0}</div>
            </div>
            <div class="ar-actions">
                <button class="ar-view" onclick="viewArchive('${a.id}')">查看</button>
                <button class="ar-restore" onclick="restoreArchive('${a.id}')">恢复</button>
                <button class="ar-del" onclick="deleteArchive('${a.id}')">删除</button>
            </div>
        </div>`;
    }).join('');
}

// 查看归档详情（复用规则卡片渲染）
async function viewArchive(id) {
    let entry;
    try {
        const res = await fetch('/api/tracking/archive/' + encodeURIComponent(id));
        entry = await res.json();
    } catch (e) { showToast('加载失败：' + e.message, '#ef4444'); return; }
    if (entry.error) { showToast(entry.error, '#ef4444'); return; }

    const mask = document.createElement('div');
    mask.className = 'tmodal-mask';
    mask.onclick = (e) => { if (e.target === mask) mask.remove(); };
    const modal = document.createElement('div');
    modal.className = 'tmodal tmodal-wide';
    modal.innerHTML = `
        <h3>📦 ${escapeHtml(entry.name || '未命名归档')} <span style="font-size:12px;color:var(--text-muted);font-weight:400;">${escapeHtml(entry.date || '')}</span></h3>
        <div class="ar-view-list" id="ar-view-list"></div>
        <div class="tmodal-actions">
            <button onclick="restoreArchive('${entry.id}', true)">↩️ 恢复到主列表</button>
            <button onclick="this.closest('.tmodal-mask').remove()">关闭</button>
        </div>`;
    mask.appendChild(modal);
    document.body.appendChild(mask);

    const box = modal.querySelector('#ar-view-list');
    renderArchiveView(box, entry.rules || [], entry.hits || {});
}

function renderArchiveView(container, rules, hits) {
    container.innerHTML = '';
    if (!rules.length) {
        container.innerHTML = '<div class="pm-empty" style="text-align:center;color:var(--text-muted);padding:20px;">该归档无规则</div>';
        return;
    }
    rules.forEach(rule => {
        const rid = rule.id;
        const hit = hits[rid] || { hit: false, errors: [], samples: [], count: 0 };
        container.appendChild(buildRuleCard(rule, hit));
    });
}

async function restoreArchive(id, keepOpen) {
    try {
        const res = await fetch('/api/tracking/archive/' + encodeURIComponent(id) + '/restore', { method: 'POST' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        await refreshTrackingResults();
        showToast('↩️ 已恢复到主列表');
    } catch (e) {
        showToast('恢复失败：' + e.message, '#ef4444');
        return;
    }
    if (keepOpen) {
        // 关闭查看弹窗，回到列表
        const masks = document.querySelectorAll('.tmodal-mask');
        masks.forEach(m => m.remove());
        openArchiveList();
    } else {
        // 从列表点击恢复：刷新列表并刷新主面板
        await renderArchiveList();
    }
}

async function deleteArchive(id) {
    if (!confirm('确认删除该归档？此操作不可恢复。')) return;
    try {
        const res = await fetch('/api/tracking/archive/' + encodeURIComponent(id), { method: 'DELETE' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        await renderArchiveList();
        showToast('🗑 已删除归档');
    } catch (e) {
        showToast('删除失败：' + e.message, '#ef4444');
    }
}
