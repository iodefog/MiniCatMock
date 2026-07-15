import re

with open('/Users/lhl/Documents/coding/drama_ios_副本2/MockServer/templates/index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# 1. We have to take #mock-layout out of #right-panel.
# Wait, let's extract #mock-layout.
mock_layout_start = html.find('<div id="mock-layout"')
if mock_layout_start == -1:
    print("Cannot find #mock-layout")
else:
    # Find the matching closing div for #mock-layout
    count = 0
    i = mock_layout_start
    while i < len(html):
        if html.startswith('<div', i):
            count += 1
        elif html.startswith('</div', i):
            count -= 1
            if count == 0:
                mock_layout_end = i + 6
                break
        i += 1
    
    mock_layout_html = html[mock_layout_start:mock_layout_end]
    
    # 2. Extract <div id="right-panel" class="mock-drawer"> completely and remove it.
    right_panel_start = html.find('<div id="right-panel" class="mock-drawer">')
    count = 0
    i = right_panel_start
    while i < len(html):
        if html.startswith('<div', i):
            count += 1
        elif html.startswith('</div', i):
            count -= 1
            if count == 0:
                right_panel_end = i + 6
                break
        i += 1
    
    # Remove #right-panel from html
    html = html[:right_panel_start] + html[right_panel_end:]
    
    # 3. Inject #mock-layout into .main-content-area, right after #log-content-container or inside #request-tab.
    # Actually, the user wants:
    # Right panel default state: #no-selection-state
    # Right panel selected state: BOTH request details and mock config.
    # Currently, #request-tab contains #no-selection-state and #log-content-container.
    # Wait, #log-content-container contains the actual table of requests?
    pass

print("Done")
