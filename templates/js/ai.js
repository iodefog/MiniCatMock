// ─── AI 智能生成 JSON 功能模块 ───
// ═══════════════════════════════════════════════════════════

// ─── 共享 AI 提示词库（ai.js 编辑器模式 & pet.js AI助手 共用）───
const SHARED_AI_PROMPTS = {
    generate: {
        zh: '请为当前接口一键生成一个完整、真实可信的 Mock 数据集：包含 id、名称、头像 URL、状态、创建时间等常见字段，以数组形式返回 10 条，外层统一包裹为 {"code": 200, "message": "success", "data": {"list": [...], "total": 10, "page": 1}}。',
        en: 'Generate a complete, realistic Mock dataset for the current endpoint: include id, name, avatar URL, status, createdAt and other common fields, return an array of 10 items, wrapped as {"code": 200, "message": "success", "data": {"list": [...], "total": 10, "page": 1}}.'
    },
    boundary: {
        zh: '请注入边界与脏数据测试用例：覆盖超长字符串、emoji 表情、特殊字符(<>&\'")、null、空字符串、空数组、负数、极大值与极小值、SQL 注入片段与脚本片段，用于验证接口健壮性。',
        en: 'Inject boundary and dirty-data test cases: cover extra-long strings, emoji, special chars (<>&\'"), null, empty string, empty array, negative numbers, very large/small numbers, SQL injection and script snippets, to validate API robustness.'
    },
    multilang: {
        zh: '请生成用于 UI 撑破测试的数据：超长标题与描述文本、超长列表(50+ 条)、深层嵌套对象(5 层以上)、超长字段名，验证前端渲染不崩溃、布局不溢出。',
        en: 'Generate UI-stress-test data: extra-long title/description text, an extra-long list (50+ items), deeply nested objects (5+ levels), and very long field names, to verify the frontend does not crash and layout does not overflow.'
    },
    network: {
        zh: '请为当前接口配置模拟弱网：固定响应延迟 3000ms，并叠加 ±500ms 随机抖动，模拟高延迟/不稳定网络场景。',
        en: 'Configure simulated weak network for the current endpoint: fixed response latency 3000ms plus ±500ms random jitter, simulating high-latency / unstable network conditions.'
    },
    token: {
        zh: '请模拟 Token 失效场景：当请求携带过期或无效 Token 时，返回 {"code": 401, "message": "Token expired or invalid"}，结构体与成功响应保持一致。',
        en: 'Simulate token-expired scenario: when the request carries an expired or invalid token, return {"code": 401, "message": "Token expired or invalid"}, keeping the structure consistent with the success response.'
    },
    reverse: {
        zh: '请将列表数据倒序排列（最新数据排在最前），并保持 total、page、pageSize 等分页字段完整且正确。',
        en: 'Reverse the list order (newest items first) while keeping pagination fields like total, page, pageSize complete and correct.'
    },
    findParams: {
        zh: '请帮我查找并汇总指定接口（如 xxx 接口）的完整契约信息：① 请求方法、URL 与全部请求参数（query / header / body 字段）；② 已保存或捕获到的请求示例数据；③ 当前返回结果的数据结构与字段说明。请以清晰清单逐项列出，便于我核对接口定义。',
        en: 'Find and summarize the full contract of the specified endpoint (e.g. xxx): ① request method, URL and all request parameters (query / header / body fields); ② saved or captured example request data; ③ current response structure and field descriptions. List them as a clear checklist for verifying the API definition.'
    },
    modifyField: {
        zh: '请帮我在指定接口（例如 xxx 接口）的返回数据中：把某字段的值修改为指定内容，或在某字段的同级位置下新增一个字段。请直接输出修改后的完整 JSON，并标注改动的具体路径（如 data.list[0].user.name）。',
        en: 'For the specified endpoint (e.g. xxx), in its response data: change a given field value to the specified content, or add a new field next to a given field at the same level. Output the complete modified JSON and mark the changed paths (e.g. data.list[0].user.name).'
    },
    findLevel: {
        zh: '请帮我在指定接口的返回数据中，定位某个字段位于第几层嵌套（最外层的 data 记为第 1 层），并给出从根节点到该字段的完整路径，方便我做数据提取或断言校验。',
        en: 'In the specified endpoint response, locate at which nesting depth a given field sits (the outermost data counts as level 1), and give the full path from root to that field, so I can extract or assert on the data.'
    },
    genRelated: {
        zh: '请参考指定接口或某段描述字段，自动生成一组相关/互补的接口（如配套的列表、详情、创建、更新、删除接口），保证字段命名、状态码与响应结构风格一致，并给出每个接口的请求方式与示例响应 JSON。',
        en: 'Based on a reference endpoint or a description field, auto-generate a set of related/complementary endpoints (e.g. paired list, detail, create, update, delete), keeping field naming, status codes and response structure style consistent, and provide each endpoint method with example response JSON.'
    },
    replay: {
        zh: '请通过 curl 重新请求当前接口（自动带上原始请求方法、URL、Header 与 Body），把真实线上响应完整回显给我，用于核对与抓包数据是否一致。',
        en: 'Re-request the current endpoint via curl (auto-including the original method, URL, headers and body), and show me the complete real live response, so I can verify it against the captured data.'
    },
    // ── 编辑器模式专用 System Prompt（用于 runAIGenerate）──
    system: {
        jsonRules: `要求：
1. 【最重要】默认情况下，你必须基于给定的原始数据（如果存在）进行修改或扩展，保留原始数据的结构和已知字段。
2. 如果原始数据不为空且不是 JSON 格式，你必须严格保持原有的格式风格，绝对不能强制将其转换为标准的 JSON 对象或结构。
3. 如果数据属于标准 JSON 格式，你输出的内容必须是合法的、可以直接被解析的纯 JSON 格式文本。绝对不能包含任何 Markdown 代码块标记（如 \`\`\`json），绝对不能包含任何解释性文字或对话。`,
        generate: `你是一个专业的 Mock API 数据生成与修改助手。根据用户的描述，生成或修改并返回符合要求的数据。`,
        mutate: `你是一个网络接口健壮性测试助手（混沌测试）。你的任务是根据给定的原始数据，生成包含各种极端异常情况、边界值、脏数据的异常变异数据，以帮助测试客户端应用程序的健壮性。`,
        repair: `你是一个专业的数据语法修复工具。你的任务是尽全力修复给定的由于复制粘贴等原因引起的、格式损坏的数据，并输出符合对应标准格式规范的内容。`
    }
};

// 获取共享提示词（按当前语言返回对应文本）
function getSharedAIPrompt(actionKey) {
    if (!SHARED_AI_PROMPTS[actionKey] || typeof SHARED_AI_PROMPTS[actionKey] === 'string') {
        return SHARED_AI_PROMPTS[actionKey] || '';
    }
    const entry = SHARED_AI_PROMPTS[actionKey];
    if (!entry.zh) return '';
    const lang = (typeof currentLang !== 'undefined' && currentLang === 'en') ? 'en' : 'zh';
    return entry[lang] || entry.zh;
}

// 构建编辑器 AI 模态的 System Prompt（根据 mode 返回完整 systemPrompt）
function buildEditorSystemPrompt(mode, isOriginalJson) {
    const rules = SHARED_AI_PROMPTS.system.jsonRules;
    const notJsonNote = `\n\n另外，当前编辑器中的原始数据${isOriginalJson ? '是' : '不是'}标准 JSON 格式，请根据上述规则 2/3 对应处理。`;

    if (mode === 'generate') {
        return `${SHARED_AI_PROMPTS.system.generate}\n${rules}
4. 数字类型合理随机，字符串内容真实可信，不要使用敷衍的占位符。
5. 如果原数据为空且用户没有指定其他的格式，默认外层结构为 {"code": 200, "message": "success", "data": ...}。${notJsonNote}`;
    } else if (mode === 'mutate') {
        const boundaryDesc = getSharedAIPrompt('boundary');
        return `${SHARED_AI_PROMPTS.system.mutate}\n变异规则包括（随机组合使用）：${boundaryDesc}\n${rules}
4. 输出必须保持与原始数据一致的格式风格（如原先是 JSON 字典则返回字典，原先是 SSE 文本流则返回 SSE 文本流）。${notJsonNote}`;
    } else if (mode === 'repair') {
        return `${SHARED_AI_PROMPTS.system.repair}\n修复指南：${rules}
3. 如果原数据本就属于 JSON 格式，请补齐缺失的括号、双引号、单引号、冒号或逗号；将非法的单引号键值替换为标准双引号；剔除末尾多余的逗号，保证输出合法的、可以直接被解析的纯 JSON 格式文本。
4. 绝对不能随意阉割或破坏核心数据，只做格式修复。输出必须保持与原始数据一致的格式和命名风格。${notJsonNote}`;
    } else if (mode === 'overflow') {
        const overflowDesc = getSharedAIPrompt('multilang');
        return `${SHARED_AI_PROMPTS.system.generate}\n任务：${overflowDesc}\n${rules}
4. 生成的超长列表每条数据必须结构一致、字段完整，不能出现截断或丢失字段的情况。${notJsonNote}`;
    } else if (mode === 'tokenExpired') {
        const tokenDesc = getSharedAIPrompt('token');
        return `你是一个接口鉴权测试助手。\n任务：${tokenDesc}\n${rules}
4. 如果原始数据存在成功响应的结构，请保持 code 之外的字段结构一致，仅将 code 改为 401 并修改 message。${notJsonNote}`;
    } else if (mode === 'reverse') {
        const reverseDesc = getSharedAIPrompt('reverse');
        return `${SHARED_AI_PROMPTS.system.generate}\n任务：${reverseDesc}\n${rules}
4. 如果数据中存在多个嵌套列表，请逐一倒序排列。
5. 注意 total 应该是总数（不需要改），page 和 pageSize 保持不变。${notJsonNote}`;
    } else if (mode === 'modify') {
        const modifyDesc = getSharedAIPrompt('modifyField');
        return `${SHARED_AI_PROMPTS.system.generate}\n任务：${modifyDesc}\n${rules}
4. 请精准定位到用户指定的字段路径进行修改或新增，不能改动其他无关字段。
5. 输出结果时需要标注改动路径，格式为 /** 改动: data.list[0].user.name */。${notJsonNote}`;
    } else if (mode === 'genRelated') {
        const relatedDesc = getSharedAIPrompt('genRelated');
        return `${SHARED_AI_PROMPTS.system.generate}\n任务：${relatedDesc}\n${rules}
4. 参考当前编辑器中已有接口的命名风格、字段类型和响应结构，生成配套接口时保持完全一致。
5. 每个接口输出为独立 JSON 块，并标注接口说明和请求方式。${notJsonNote}`;
    }
    return '';
}

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
    } else if (aiMode === 'overflow') {
        titleEl.innerHTML = `🌍 AI UI 撑破测试 <span id="ai-gen-provider-tag" class="ai-provider-tag tag-deepseek">DeepSeek</span>` + settingsBtnHtml;
        subTitleEl.textContent = '基于当前数据生成超长文本、超长列表、深层嵌套等极端数据，验证前端渲染健壮性。';
        textareaEl.placeholder = '（可选）指定撑破方向，例如：只拉长 name 字段、嵌套再加 3 层、列表扩展到 100 条';
        textareaEl.value = '';
        submitBtn.textContent = '🌍 生成撑破数据';
    } else if (aiMode === 'tokenExpired') {
        titleEl.innerHTML = `🔐 AI Token 失效模拟 <span id="ai-gen-provider-tag" class="ai-provider-tag tag-deepseek">DeepSeek</span>` + settingsBtnHtml;
        subTitleEl.textContent = '将当前成功响应数据转换为 Token 过期/无效的错误响应，保持结构一致。';
        textareaEl.placeholder = '（可选）自定义错误码和提示信息，例如：code 403、message "Forbidden"';
        textareaEl.value = '';
        submitBtn.textContent = '🔐 生成错误响应';
    } else if (aiMode === 'reverse') {
        titleEl.innerHTML = `🔀 AI 数据倒序 <span id="ai-gen-provider-tag" class="ai-provider-tag tag-deepseek">DeepSeek</span>` + settingsBtnHtml;
        subTitleEl.textContent = '将当前数据中的所有列表倒序排列，自动保持分页字段完整。';
        textareaEl.placeholder = '（可选）指定倒序范围，例如：只倒序 data.list、跳过 data.related';
        textareaEl.value = '';
        submitBtn.textContent = '🔀 开始倒序';
    } else if (aiMode === 'modify') {
        titleEl.innerHTML = `✏️ AI 改/增字段 <span id="ai-gen-provider-tag" class="ai-provider-tag tag-deepseek">DeepSeek</span>` + settingsBtnHtml;
        subTitleEl.textContent = '修改指定字段的值或在同级位置新增字段，精准定位输出改动路径。';
        textareaEl.placeholder = '例如：把 data.list 里所有 name 改为 "测试商品"，在 price 同级新增 discount 字段';
        textareaEl.value = '';
        submitBtn.textContent = '✏️ 开始修改';
    } else if (aiMode === 'genRelated') {
        titleEl.innerHTML = `🧩 AI 参考生成接口 <span id="ai-gen-provider-tag" class="ai-provider-tag tag-deepseek">DeepSeek</span>` + settingsBtnHtml;
        subTitleEl.textContent = '参考当前接口结构，自动生成配套的列表、详情、创建、更新、删除等接口。';
        textareaEl.placeholder = '（可选）指定需要生成的接口类型，例如：只要列表和详情两个接口';
        textareaEl.value = '';
        submitBtn.textContent = '🧩 生成配套接口';
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

// ─── 触发 UI 撑破测试 ───
function runAIOverflow() {
    const originalJson = document.getElementById('rule-body').value.trim();
    if (!originalJson) {
        showToast('⚠️ 当前 Mock 编辑器内容为空，无法生成撑破测试数据！', '#f59e0b');
        return;
    }
    aiMode = 'overflow';
    setupAIModal();
}

// ─── 触发 Token 失效模拟 ───
function runAITokenExpired() {
    const originalJson = document.getElementById('rule-body').value.trim();
    if (!originalJson) {
        showToast('⚠️ 当前 Mock 编辑器内容为空，无法生成 Token 失效响应！', '#f59e0b');
        return;
    }
    aiMode = 'tokenExpired';
    setupAIModal();
}

// ─── 触发数据倒序 ───
function runAIReverse() {
    const originalJson = document.getElementById('rule-body').value.trim();
    if (!originalJson) {
        showToast('⚠️ 当前 Mock 编辑器内容为空，无法进行数据倒序！', '#f59e0b');
        return;
    }
    aiMode = 'reverse';
    setupAIModal();
}

// ─── 触发改/增字段 ───
function runAIModify() {
    const originalJson = document.getElementById('rule-body').value.trim();
    if (!originalJson) {
        showToast('⚠️ 当前 Mock 编辑器内容为空，无法修改字段！', '#f59e0b');
        return;
    }
    aiMode = 'modify';
    setupAIModal();
}

// ─── 触发参考生成接口 ───
function runAIGenRelated() {
    const originalJson = document.getElementById('rule-body').value.trim();
    if (!originalJson) {
        showToast('⚠️ 当前 Mock 编辑器内容为空，无法参考生成接口！', '#f59e0b');
        return;
    }
    aiMode = 'genRelated';
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
        'repair': '⏳ 修复中...',
        'overflow': '⏳ 生成撑破数据...',
        'tokenExpired': '⏳ 生成错误响应...',
        'reverse': '⏳ 倒序中...',
        'modify': '⏳ 修改中...',
        'genRelated': '⏳ 生成配套接口...'
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

    // 使用共享提示词库构建 System Prompt
    systemPrompt = buildEditorSystemPrompt(aiMode, isOriginalJson);

    if (aiMode === 'generate') {
        userPrompt = originalJson ? `【现有数据（非JSON时请原样拓展，不要转为JSON）】：\n${originalJson}\n\n【用户的生成/修改需求】：\n${prompt}` : prompt;
    } else if (aiMode === 'mutate') {
        userPrompt = originalJson ? `【原始数据（非JSON时请保持原结构格式变异）】：\n${originalJson}\n\n【用户的变异额外要求】：\n${prompt}` : prompt;
    } else if (aiMode === 'repair') {
        userPrompt = originalJson ? `【损坏的原始数据】：\n${originalJson}\n\n【额外重构指令】：\n${prompt}` : prompt;
    } else {
        // overflow / tokenExpired / reverse / modify / genRelated 等模式
        userPrompt = originalJson ? `【原始数据】：\n${originalJson}\n\n【用户的额外要求】：\n${prompt || '按默认规则处理'}` : (prompt || '按默认规则处理');
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

