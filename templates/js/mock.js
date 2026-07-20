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
        let mockLabel = `🟢 Mock 命中 (规则: ${log.mock_rule_name || '未命名'})`;
        if (log.business_error) {
            mockLabel += ` ⚠ 业务错误 ${log.business_status != null ? log.business_status : ''}`;
            respStatusBadge.classList.add('mock-badge-err');
        }
        respStatusBadge.innerText = mockLabel;
        tryRenderJsonView('inspect-response', log.mock_response || '{}');
    } else {
        respStatusBadge.className = 'mock-badge missed';
        let proxyLabel = `⚪ 真实透传响应 (${log.mock_status || 200})`;
        if (log.business_error) {
            proxyLabel += ` ⚠ 业务错误 ${log.business_status != null ? log.business_status : ''}`;
            respStatusBadge.classList.add('mock-badge-err');
        }
        respStatusBadge.innerText = proxyLabel;

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
