import re

with open('/Users/lhl/Documents/coding/drama_ios_副本2/MockServer/templates/app.js', 'r', encoding='utf-8') as f:
    js = f.read()

# Define the new getPixelCatSVG
new_svg_func = """function getPixelCatSVG(state, stage) {
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
"""

start_idx = js.find('function getPixelCatSVG')
if start_idx != -1:
    # Need to match the closing brace correctly
    count = 0
    i = start_idx
    while i < len(js):
        if js[i] == '{':
            count += 1
        elif js[i] == '}':
            count -= 1
            if count == 0:
                end_idx = i + 1
                break
        i += 1
    
    js = js[:start_idx] + new_svg_func + js[end_idx:]
    with open('/Users/lhl/Documents/coding/drama_ios_副本2/MockServer/templates/app.js', 'w', encoding='utf-8') as f:
        f.write(js)
    print("getPixelCatSVG updated")
else:
    print("Could not find getPixelCatSVG")
