import re

with open('/Users/lhl/Documents/coding/drama_ios_副本2/MockServer/templates/app.js', 'r', encoding='utf-8') as f:
    js = f.read()

# Update selectLog
# find: document.getElementById('details-layout').style.display = 'grid';
# add: document.getElementById('selection-state').style.display = 'flex';
if "document.getElementById('selection-state').style.display = 'flex';" not in js:
    js = js.replace(
        "document.getElementById('details-layout').style.display = 'grid';",
        "document.getElementById('details-layout').style.display = 'grid';\n    const selState = document.getElementById('selection-state');\n    if(selState) selState.style.display = 'flex';"
    )

with open('/Users/lhl/Documents/coding/drama_ios_副本2/MockServer/templates/app.js', 'w', encoding='utf-8') as f:
    f.write(js)

print("app.js updated")
