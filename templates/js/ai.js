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

// ─── 非流式 AI 调用：收集完整文本后返回（供语义搜索等需要结构化解析的场景）───
async function callAIComplete(cfg, systemPrompt, userPrompt) {
    const resp = await fetch('/api/ai-chat', {
        method: 'POST',
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
    let full = '';
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
                if (delta) full += delta;
            } catch (parseErr) {
                if (parseErr.message && !parseErr.message.startsWith('JSON')) throw parseErr;
            }
        }
    }
    return full;
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

