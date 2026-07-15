import re

with open('/Users/lhl/Documents/coding/drama_ios_副本2/MockServer/templates/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Extract #no-selection-state
start_no_sel = content.find('<div id="no-selection-state"')
end_no_sel = content.find('<!-- Top Endpoints -->') # this is inside no-selection-state, we need to find its end.
# A better way is to count divs.
def get_tag_end(html, start_idx, tag_name='div'):
    count = 0
    i = start_idx
    open_tag = f'<{tag_name}'
    close_tag = f'</{tag_name}>'
    while i < len(html):
        if html.startswith(open_tag, i):
            # Make sure it's not <divide
            if html[i+len(open_tag)] in [' ', '>', '\n', '\t']:
                count += 1
        elif html.startswith(close_tag, i):
            count -= 1
            if count == 0:
                return i + len(close_tag)
        i += 1
    return -1

end_no_sel = get_tag_end(content, start_no_sel)
no_sel_content = content[start_no_sel:end_no_sel]

# 2. Extract #mock-layout (Mock Configuration Form)
start_mock_layout = content.find('<div id="mock-layout"')
end_mock_layout = get_tag_end(content, start_mock_layout)
mock_layout_content = content[start_mock_layout:end_mock_layout]

# 3. Extract the rest of request-tab (which contains the details-request-content, details-response-content, details-composer-content)
# It is between end_no_sel and the end of request-tab.
start_req_tab = content.find('<div id="request-tab"')
end_req_tab = get_tag_end(content, start_req_tab)
# The request details content starts after no_sel_content
req_details_start = content.find('<div class="details-header"', end_no_sel)
if req_details_start == -1:
    req_details_start = end_no_sel # fallback
req_details_content = content[req_details_start:end_req_tab-6] # minus closing div

# Now we construct the new main content area.
new_right_panel = f"""
            <!-- ─── Right Panel: Split Pane Details & AI Lab ─── -->
            <div id="right-panel" class="right-pane-container">
                <!-- Hidden components for app.js background updates compatibility -->
                <input type="checkbox" id="global-mock-switch" onchange="toggleGlobalMock(this.checked)" style="display: none;" checked>
                <button id="theme-toggle-btn" onclick="toggleTheme()" style="display: none;">🌙</button>

                {no_sel_content}

                <div id="selection-state" style="display: none; height: 100%; flex-direction: column;">
                    <div class="split-pane-details">
                        <!-- Top Half: Request/Response Details -->
                        <div class="details-top-half">
                            {req_details_content}
                        </div>
                        
                        <div class="split-pane-divider"></div>
                        
                        <!-- Bottom Half: Mock Config -->
                        <div class="details-bottom-half">
                            {mock_layout_content}
                        </div>
                    </div>
                </div>
            </div>
"""

# Replace the old main-content-area and right-panel
start_main_content = content.find('<!-- ─── Main Details & Config Wrapper ─── -->')
end_right_panel = get_tag_end(content, content.find('<div id="right-panel" class="mock-drawer">'))

new_content = content[:start_main_content] + new_right_panel + content[end_right_panel:]

# Remove the drawer overlay
overlay_str = '<div id="drawer-overlay" class="drawer-overlay" onclick="closeDrawer()" style="display: none;"></div>'
new_content = new_content.replace(overlay_str, '')

with open('/Users/lhl/Documents/coding/drama_ios_副本2/MockServer/templates/index.html', 'w', encoding='utf-8') as f:
    f.write(new_content)

print("Restructure complete")
