import re

with open('/Users/lhl/Documents/coding/drama_ios_副本2/MockServer/templates/style.css', 'r', encoding='utf-8') as f:
    css = f.read()

# 1. Update #left-panel
# Change flex: 1; to width: 400px; flex-shrink: 0;
left_panel_pattern = r'(#left-panel\s*{[^}]*)flex:\s*1;'
css = re.sub(left_panel_pattern, r'\1width: 400px;\n    flex-shrink: 0;', css)

# 2. Add split pane styles
split_pane_styles = """
/* ─── Right Panel: Split Pane Details & AI Lab ─── */
.right-pane-container {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg);
    border-left: 1px solid var(--border);
    overflow: hidden;
}

#selection-state {
    background: var(--surface);
    height: 100%;
    display: flex;
    flex-direction: column;
}

.split-pane-details {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
}

.details-top-half {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
}

.split-pane-divider {
    height: 4px;
    background: var(--bg);
    border-top: 1px solid var(--border);
    border-bottom: 1px solid var(--border);
    cursor: row-resize;
    flex-shrink: 0;
}

.details-bottom-half {
    height: 45%;
    min-height: 300px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    background: var(--surface);
}

/* Adjust mock layout inside bottom half */
#mock-layout {
    height: auto !important;
    min-height: 100%;
}

.mock-config-block {
    border: none !important;
    border-radius: 0 !important;
}

.details-header {
    background: var(--surface) !important;
    border-bottom: 1px solid var(--border) !important;
    padding: 16px 24px !important;
}
"""

if '.right-pane-container' not in css:
    css += '\n' + split_pane_styles

with open('/Users/lhl/Documents/coding/drama_ios_副本2/MockServer/templates/style.css', 'w', encoding='utf-8') as f:
    f.write(css)

print("CSS updated")
