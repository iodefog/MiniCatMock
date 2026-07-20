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

// 从自然语言描述中提取接口路径（如 sf001/list、/api/v1/user/profile）。
// 规则：优先匹配"链接/路径/接口/url 为 xxx"后跟随的路径；否则回退到全局匹配
// 首个"含至少一个斜杠、由字母数字/_-组成的段"的 token。找到后统一补上前导 /。
function extractPathFromPrompt(text) {
    if (!text) return '';
    // 含至少一个 / 分隔的路径 token，允许结尾带 .json 等扩展名
    const pathToken = '\\/?[A-Za-z0-9_\\-]+(?:\\/[A-Za-z0-9_\\-.]+)+';
    // 1) 关键词引导：链接/路径/接口/地址/url 为/是/: xxx
    const kw = new RegExp('(?:链接|路径|接口|地址|url|URL|api|API)\\s*(?:为|是|:|：|=)?\\s*(' + pathToken + ')');
    let m = text.match(kw);
    if (!m) {
        // 2) 全局回退：抓第一个符合路径形态的 token
        m = text.match(new RegExp(pathToken));
    }
    if (!m) return '';
    let p = (m[1] || m[0]).trim();
    if (!p) return '';
    if (!p.startsWith('/')) p = '/' + p;
    return p;
}

// 从已捕获请求列表(/api/logs)中匹配与目标路径一致的真实请求，作为 AI 生成时的参考依据。
// 匹配策略：忽略前导 / 后，path 相等或以目标结尾/包含，优先返回带有响应体或请求体的那条。
async function findReferenceRequest(targetPath) {
    try {
        const res = await fetch('/api/logs');
        const logs = await res.json();
        if (!Array.isArray(logs) || !targetPath) return null;
        const norm = targetPath.replace(/^\/+/, '').toLowerCase();
        if (!norm) return null;
        let best = null;
        for (const log of logs) {
            const lp = (log.path || '').replace(/^\/+/, '').toLowerCase();
            const hit = lp === norm || lp.endsWith('/' + norm) || norm.endsWith('/' + lp) || (norm && lp.includes(norm));
            if (!hit) continue;
            // 优先选携带了响应体或请求体的请求，参考价值更高
            if (!best || (log.mock_response || log.body)) best = log;
        }
        return best;
    } catch (e) {
        return null;
    }
}

// 把匹配到的真实请求整理成可读文本，注入给 AI 作为"依赖已有接口"的参考。
function buildReferenceText(log) {
    if (!log) return '';
    const parts = [];
    parts.push(`参考请求：\n- 方法(Method): ${log.method || ''}\n- 路径(Path): ${log.path || ''}`);
    if (log.query_params && Object.keys(log.query_params).length) {
        parts.push(`- Query 参数: ${JSON.stringify(log.query_params)}`);
    }
    if (log.body) {
        const b = typeof log.body === 'string' ? log.body : JSON.stringify(log.body);
        if (b && b !== 'null' && b.trim()) parts.push(`- 请求体(Request Body): ${b}`);
    }
    if (log.mock_response) {
        parts.push(`- 已有响应体(Response 结构参考): ${log.mock_response}`);
    }
    return parts.join('\n');
}

// ─── 快捷指令提示词（AI 实验室 与 AI Mock 助手 共用，保证功能与 UI 对齐）───
// 点击快捷指令芯片时，把对应的「完善提示语」填入目标输入框，不自动执行，由用户确认后再生成。
const QUICK_ACTION_PROMPTS = {
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
    // ── 实用查询 / 改造类指令（查找接口、改字段、定位层级、参考生成）──
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
    // ── 重新请求（🔁）：点击芯片仅把提示语填入输入框，真正发请求由发送按钮触发 ──
    replay: {
        zh: '请通过 curl 重新请求当前接口（自动带上原始请求方法、URL、Header 与 Body），把真实线上响应完整回显给我，用于核对与抓包数据是否一致。',
        en: 'Re-request the current endpoint via curl (auto-including the original method, URL, headers and body), and show me the complete real live response, so I can verify it against the captured data.'
    }
};

// 把快捷指令对应的完善提示语填入指定输入框（覆盖写入，便于用户查看/编辑后点击生成）。
function insertQuickActionPrompt(actionKey, targetId) {
    const el = document.getElementById(targetId);
    if (!el || !QUICK_ACTION_PROMPTS[actionKey]) return;
    const lang = (typeof currentLang !== 'undefined' && currentLang === 'en') ? 'en' : 'zh';
    const text = QUICK_ACTION_PROMPTS[actionKey][lang] || QUICK_ACTION_PROMPTS[actionKey].zh;
    el.value = text;
    el.focus();
    if (typeof autoResizeTextarea === 'function') { try { autoResizeTextarea(el); } catch (e) {} }
}

// 从一段文本里尝试提取接口路径：支持完整 URL（取 path+query）或以 / 开头的路径 token。
function extractPathFromText(text) {
    if (!text) return '';
    let m = text.match(/https?:\/\/[^\s"'，。、]+/);
    if (m) {
        try { const u = new URL(m[0]); return (u.pathname + u.search) || ''; } catch (e) {}
    }
    m = text.match(/\/[A-Za-z0-9_\-./]+(?:\?[^\s"'，。]*)?/);
    if (m) return m[0];
    return '';
}

// 解析接口路径：优先读调用方指定的输入框；若为空，则回退到其它已知路径输入框
// （抽屉用 ai-nl-path，AI 实验室用 global-ai-path）；再不行则从指令输入框(ai-nl-rule-input)里
// 抽取路径 token，避免用户把路径填在别处时仍被提示"需要输入 path"。
function resolveEndpointPath(preferredId) {
    const candidates = [preferredId, 'ai-nl-path', 'global-ai-path'];
    for (const id of candidates) {
        if (!id) continue;
        const el = document.getElementById(id);
        if (el && el.value && el.value.trim()) return el.value.trim();
    }
    const ta = document.getElementById('ai-nl-rule-input');
    if (ta && ta.value && ta.value.trim()) {
        const p = extractPathFromText(ta.value);
        if (p) return p;
    }
    const gp = document.getElementById('global-ai-prompt');
    if (gp && gp.value && gp.value.trim()) {
        const p = extractPathFromText(gp.value);
        if (p) return p;
    }
    return '';
}

// ─── 重新请求接口：自动拼 curl 并打到上游，回显命令与真实结果 ───
async function replayInterfaceViaCurl(pathId, outputId, statusId) {
    const path = resolveEndpointPath(pathId);
    const lang = (typeof currentLang !== 'undefined' && currentLang === 'en') ? 'en' : 'zh';
    if (!path) {
        showToast(lang === 'zh' ? '⚠️ 请先填写接口路径' : '⚠️ Please input the endpoint path first', '#f59e0b');
        return;
    }
    const outputEl = document.getElementById(outputId);
    const statusEl = statusId ? document.getElementById(statusId) : null;
    if (!outputEl) return;
    if (outputId === 'global-ai-stream-preview') {
        const sec = document.getElementById('global-ai-result-section');
        if (sec) sec.style.display = 'block';
    } else {
        outputEl.style.display = 'block';
    }
    if (statusEl) statusEl.textContent = lang === 'zh' ? '⏳ 正在通过 curl 重新请求...' : '⏳ Re-requesting via curl...';
    outputEl.textContent = lang === 'zh' ? '⏳ 正在通过 curl 重新请求真实接口...' : '⏳ Re-requesting real endpoint via curl...';

    try {
        const resp = await fetch('/api/curl', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path })
        });
        const data = await resp.json();
        let text;
        if (!data.found) {
            text = '❌ ' + (data.error || 'not found');
        } else {
            const parts = [
                (lang === 'zh' ? '🔁 已自动通过 curl 重新请求该接口：' : '🔁 Auto re-requested the endpoint via curl:'),
                '',
                '$ ' + (data.command || ''),
                ''
            ];
            if (data.status_code != null) parts.push('HTTP ' + data.status_code, '');
            parts.push(data.output || '');
            if (data.stderr) parts.push('', '[stderr]', data.stderr);
            if (data.error) parts.push('', '❌ ' + data.error);
            text = parts.join('\n');
        }
        outputEl.textContent = text;
        if (statusEl) statusEl.textContent = lang === 'zh' ? '✅ 已完成' : '✅ Done';
    } catch (e) {
        outputEl.textContent = '❌ ' + e.message;
        if (statusEl) statusEl.textContent = lang === 'zh' ? '❌ 出错' : '❌ Error';
    }
}

// 判断用户输入是否像“提问/分析”而非“生成 Mock 规则”。
// 命中问号或中文疑问词即视为提问，走检索式分析，避免被强制输出纯 JSON。
function isQuestionLike(text) {
    if (!text) return false;
    if (text.includes('?') || text.includes('？')) return true;
    return /哪个|哪些|哪里|哪几|哪一个|哪几个|什么|怎么|如何|是否|在哪|查询|查找|搜索|搜一下|搜|定位|属于|存在|属于哪个|在哪|在哪个|区别|为什么|为什么|解释/i.test(text);
}

// 判断是否为「重新请求接口」意图（点击 🔁 芯片填入的提示语，或用户手动输入）。
// 命中后由发送按钮真正发起 curl 请求，而不是点击芯片时直接发请求。
function isReplayLike(text) {
    if (!text) return false;
    return /重新请求|重新调用|重发|重放|re-?request|replay|curl/i.test(text);
}

// 从提问中提取可检索的字段名/值：引号字符串、JSON 键名、英文标识符。
function extractSearchTerms(text) {
    const terms = new Set();
    const q = text.match(/"[^"]+"|'[^']+'/g);
    if (q) q.forEach(s => { const v = s.slice(1, -1).trim(); if (v) terms.add(v); });
    const k = text.match(/"([^"]+)"\s*:/g);
    if (k) k.forEach(s => { const m = s.match(/"([^"]+)"\s*:/); if (m) { const v = m[1].trim(); if (v) terms.add(v); } });
    const w = text.match(/[A-Za-z_][A-Za-z0-9_]*/g);
    if (w) w.forEach(s => { if (s.length >= 2) terms.add(s); });
    return Array.from(terms).filter(Boolean);
}

// 提问型输入的统一处理：在已捕获请求中检索相关接口，再用自然语言回答（不强制 JSON）。
// 这样“roleName 这个字段在哪个接口里？”会去抓包记录里找含该字段/值的接口，而不是编一段 JSON。
async function askAIAnalysis(question, cfg, outputEl, statusEl, isDrawer) {
    const lang = (typeof currentLang !== 'undefined' && currentLang === 'en') ? 'en' : 'zh';
    if (outputEl) {
        if (outputEl.id === 'global-ai-stream-preview') {
            const sec = document.getElementById('global-ai-result-section');
            if (sec) sec.style.display = 'block';
        } else {
            outputEl.style.display = 'block';
        }
        outputEl.textContent = '';
    }
    if (statusEl) statusEl.textContent = lang === 'zh' ? '⏳ 正在检索已捕获的接口...' : '⏳ Searching captured interfaces...';

    const terms = extractSearchTerms(question);

    let logs = [];
    try { const res = await fetch('/api/logs'); logs = await res.json(); } catch (e) { logs = []; }

    let matchedAny = false;
    const contextParts = [];

    // 1) 若用户在路径框填写了接口，优先用它的真实请求作为上下文
    const pathEl = document.getElementById(isDrawer ? 'ai-nl-path' : 'global-ai-path');
    const path = pathEl ? pathEl.value.trim() : '';
    if (path) {
        const ref = await findReferenceRequest(path);
        if (ref) { contextParts.push('【指定接口 ' + path + ' 的真实请求】\n' + buildReferenceText(ref)); matchedAny = true; }
    }

    // 2) 全局检索：在已捕获请求里查找包含这些字段/值的接口（按命中数排序，取前 5）
    if (Array.isArray(logs) && logs.length) {
        const ranked = [];
        for (const log of logs) {
            const hay = JSON.stringify({
                path: log.path, method: log.method,
                query_params: log.query_params, body: log.body, response: log.mock_response
            });
            let score = 0; const hits = [];
            for (const t of terms) {
                if (t && hay.indexOf(t) !== -1) { score++; if (hits.indexOf(t) === -1) hits.push(t); }
            }
            if (score > 0) ranked.push({ log, score, hits });
        }
        ranked.sort((a, b) => b.score - a.score);
        for (const r of ranked.slice(0, 5)) {
            matchedAny = true;
            contextParts.push('【命中接口 ' + (r.log.method || '') + ' ' + (r.log.path || '') + '，命中关键词: ' + r.hits.join('、') + '】\n' + buildReferenceText(r.log));
        }
    }

    const contextText = matchedAny ? contextParts.join('\n\n') :
        (lang === 'zh' ? '（未在已捕获的请求记录中匹配到相关接口/字段——这些接口可能尚未在 App 中被请求过，或该字段还未出现在抓包数据里）'
                      : '(No matching interface/field found in captured requests — these endpoints may not have been requested in the App yet, or the field is not in captured data)');

    const systemPrompt = (lang === 'zh'
        ? '你是一个专业的 API 分析助手。用户会用自然语言提出与接口、字段相关的问题（例如“某字段在哪个接口里”“某接口返回结构是怎样的”）。请基于下方【已捕获的真实请求记录】用清晰的自然语言回答，可引用接口路径与字段名，必要时给出代码块示例；不要生硬地只输出纯 JSON，除非用户明确要求生成 Mock 数据。'
        : 'You are a professional API analysis assistant. The user asks natural-language questions about interfaces and fields. Answer clearly in natural language based on the 【captured real request records】 below, citing endpoint paths and field names; do not force pure-JSON output unless the user explicitly asks to generate Mock data.')
        + '\n\n' + contextText;

    aiGeneratedText = '';
    aiIsStreaming = true;
    aiAbortController = new AbortController();
    try {
        await streamViaProxy(cfg, systemPrompt, question, outputEl, statusEl || { textContent: '' });
        // 分析结果是自然语言，不是可保存的 JSON 规则
        if (isDrawer) {
            drawerGeneratedText = '';
            const sb = document.getElementById('ai-nl-save-btn');
            if (sb) sb.style.display = 'none';
        } else if (typeof globalAiGeneratedText !== 'undefined') {
            globalAiGeneratedText = '';
        }
        if (statusEl) statusEl.textContent = lang === 'zh' ? '✅ 已回答' : '✅ Answered';
    } catch (err) {
        if (statusEl) statusEl.textContent = lang === 'zh' ? '❌ 出错' : '❌ Error';
        showToast('Analysis failed: ' + err.message, '#ef4444');
    } finally {
        aiIsStreaming = false;
    }
}

// ─── AI Mock 配置助手：发送按钮（原 simulateAIRuleGen 空壳，现已实现）───
// 读取自然语言指令 + 可选接口路径，附带该接口真实请求数据作为参考，让 AI 生成 Mock 响应 JSON，
// 生成后可在结果区一键「保存为规则」。
let drawerGeneratedText = '';
async function simulateAIRuleGen() {
    const input = document.getElementById('ai-nl-rule-input');
    const instruction = input ? input.value.trim() : '';
    const lang = (typeof currentLang !== 'undefined' && currentLang === 'en') ? 'en' : 'zh';
    if (!instruction) {
        showToast(lang === 'zh' ? '⚠️ 请先输入指令' : '⚠️ Please input a command first', '#f59e0b');
        return;
    }

    // 重新请求意图（点击 🔁 芯片填入的提示语）→ 真正发起 curl，不依赖 API Key
    if (isReplayLike(instruction)) {
        await replayInterfaceViaCurl('ai-nl-path', 'ai-nl-output', 'ai-nl-output-status');
        return;
    }

    const cfg = loadAIConfig();
    if (!cfg.apiKey) {
        showToast(lang === 'zh' ? '⚠️ 请先配置 API Key' : '⚠️ Please configure API Key first', '#f59e0b');
        return;
    }

    // 提问型输入（而非生成 Mock 规则）→ 走检索式分析，避免被强制输出纯 JSON
    if (isQuestionLike(instruction)) {
        const outEl = document.getElementById('ai-nl-output');
        const stEl = document.getElementById('ai-nl-output-status');
        await askAIAnalysis(instruction, cfg, outEl, stEl, true);
        return;
    }

    const pathEl = document.getElementById('ai-nl-path');
    const path = pathEl ? pathEl.value.trim() : '';
    const outputEl = document.getElementById('ai-nl-output');
    const statusEl = document.getElementById('ai-nl-output-status');
    if (outputEl) outputEl.style.display = 'block';

    let referenceLog = null;
    if (path) { try { referenceLog = await findReferenceRequest(path); } catch (e) {} }
    const referenceText = buildReferenceText(referenceLog);

    const systemPrompt = (lang === 'zh'
        ? '你是一个 AI Mock 配置助手。根据用户的自然语言指令，为指定接口生成 Mock 响应 JSON。'
        : 'You are an AI Mock configuration assistant. Based on the user natural-language command, generate the Mock response JSON for the endpoint.')
        + '要求：只输出合法、可直接解析的纯 JSON，不要 Markdown 代码块标记，不要解释性文字。'
        + '默认外层结构 {"code":200,"message":"success","data":...}。'
        + (referenceText ? `\n\n【真实接口参考】\n${referenceText}` : '');

    if (outputEl) outputEl.textContent = '';
    if (statusEl) statusEl.textContent = lang === 'zh' ? '⏳ 正在生成 Mock 规则...' : '⏳ Generating Mock rule...';

    aiGeneratedText = '';
    aiIsStreaming = true;
    aiAbortController = new AbortController();
    try {
        await streamViaProxy(cfg, systemPrompt, instruction, outputEl, statusEl || { textContent: '' });
        drawerGeneratedText = aiGeneratedText;
        const saveBtn = document.getElementById('ai-nl-save-btn');
        if (saveBtn) saveBtn.style.display = 'inline-block';
        if (statusEl) statusEl.textContent = lang === 'zh' ? '✅ 生成完成（可保存为规则）' : '✅ Done (save as rule below)';
    } catch (err) {
        if (statusEl) statusEl.textContent = lang === 'zh' ? '❌ 出错' : '❌ Error';
        showToast('Generate failed: ' + err.message, '#ef4444');
    } finally {
        aiIsStreaming = false;
    }
}

async function saveDrawerAIResult() {
    if (!drawerGeneratedText) return;
    const pathEl = document.getElementById('ai-nl-path');
    const pathInput = pathEl ? pathEl.value.trim() : '';
    const methodEl = document.getElementById('ai-nl-method');
    const method = methodEl ? methodEl.value : 'GET';
    const lang = (typeof currentLang !== 'undefined' && currentLang === 'en') ? 'en' : 'zh';
    if (!pathInput) {
        showToast(lang === 'zh' ? '⚠️ 请先填写接口路径再保存' : '⚠️ Please input the endpoint path before saving', '#f59e0b');
        return;
    }
    let jsonStr = drawerGeneratedText.trim();
    const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) jsonStr = codeBlockMatch[1].trim();
    try {
        JSON.parse(jsonStr);
    } catch (e) {
        showToast(lang === 'zh' ? '⚠️ 生成内容非合法 JSON，无法保存为规则' : '⚠️ Generated content is not valid JSON', '#f59e0b');
        return;
    }
    const newRule = {
        name: `AI_${pathInput.replace(/[^a-zA-Z0-9]/g, '_')}`,
        url_pattern: pathInput,
        method: method,
        enabled: true,
        delay_ms: 0,
        response_body: jsonStr,
        status_code: 200,
        folder: '未分类'
    };
    try {
        const resp = await fetch('/api/rules', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newRule)
        });
        if (!resp.ok) throw new Error(await resp.text());
        showToast(lang === 'zh' ? '🎉 Mock 规则已保存！' : '🎉 Mock rule saved!', '#10b981');
        if (typeof loadRuleTree === 'function') loadRuleTree();
    } catch (e) {
        showToast('Save failed: ' + e.message, '#ef4444');
    }
}

async function runGlobalAIGenerate() {
    const cfg = loadAIConfig();
    const prompt = document.getElementById('global-ai-prompt').value.trim();
    const pathEl = document.getElementById('global-ai-path');
    let pathInput = pathEl.value.trim();
    const method = document.getElementById('global-ai-method').value;

    // 路径框为空时，尝试从需求描述中自动提取形如 sf001/list、/api/v1/user 的路径并回填，
    // 降低"路径必须单独手填"的交互摩擦。提取不到才提示用户手动输入。
    if (!pathInput && prompt) {
        const extracted = extractPathFromPrompt(prompt);
        if (extracted) {
            pathInput = extracted;
            pathEl.value = extracted;
        }
    }

    // 提问型输入（而非生成 Mock 规则）→ 直接检索已捕获接口并自然语言回答，
    // 不要求路径、不强制纯 JSON 输出（例如“roleName 这个字段在哪个接口里？”）。
    if (isQuestionLike(prompt)) {
        const pv = document.getElementById('global-ai-stream-preview');
        const st = document.getElementById('global-ai-gen-status');
        const gb = document.getElementById('btn-global-ai-generate');
        if (gb) { gb.disabled = true; gb.textContent = (typeof currentLang !== 'undefined' && currentLang === 'en') ? '⏳ Analyzing...' : '⏳ 分析中...'; }
        await askAIAnalysis(prompt, cfg, pv, st, false);
        if (gb) { gb.disabled = false; gb.textContent = (typeof currentLang !== 'undefined' && currentLang === 'en') ? '🚀 Generate Rule' : '🚀 生成规则'; }
        return;
    }

    // 重新请求意图（点击 🔁 芯片填入的提示语）→ 真正发起 curl，不依赖 API Key
    if (isReplayLike(prompt)) {
        await replayInterfaceViaCurl('global-ai-path', 'global-ai-stream-preview', 'global-ai-gen-status');
        return;
    }

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

    // 尝试匹配已捕获的真实请求，作为参考依据，让生成真正"依赖已有接口"而非凭空编造。
    let referenceLog = null;
    try {
        referenceLog = await findReferenceRequest(pathInput);
    } catch (e) {
        referenceLog = null;
    }
    const referenceText = buildReferenceText(referenceLog);

    let systemPrompt = `你是一个专业的 Mock API 数据生成助手。
根据用户的描述，生成并返回符合要求的数据。
要求：
1. 你输出的内容必须是合法的、可以直接被解析的纯 JSON 格式文本。绝对不能包含任何 Markdown 代码块标记（如 \`\`\`json），绝对不能包含任何解释性文字或对话。
2. 数字类型合理随机，字符串内容真实可信，不要使用敷衍的占位符。
3. 默认外层结构为 {"code": 200, "message": "success", "data": ...}。`;

    let finalPrompt = prompt;
    if (referenceText) {
        systemPrompt += `\n\n【重要参考】已为你匹配到真实请求 "${pathInput}" 的参考数据。请严格基于以下真实的参数名称、类型与响应结构来生成，保持字段命名与层级结构一致，不要凭空编造字段：\n${referenceText}`;
        finalPrompt += `\n\n（提示：已检测到接口 ${pathInput} 的参考请求，请基于上面的参考参数 / 响应结构生成）`;
    }

    try {
        await streamViaProxy(cfg, systemPrompt, finalPrompt, previewEl, statusEl);

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



