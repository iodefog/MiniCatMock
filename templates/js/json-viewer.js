// ─── Collapsible JSON Viewer Helper ───
function renderJsonView(container, data) {
    container.innerHTML = '';
    const root = document.createElement('div');
    root.className = 'json-view-root';

    function createNode(key, value, isLast) {
        const item = document.createElement('div');
        item.className = 'json-node';

        const line = document.createElement('div');
        line.className = 'json-line';

        if (key !== null) {
            const keySpan = document.createElement('span');
            keySpan.className = 'json-key';
            keySpan.innerText = `"${key}": `;
            line.appendChild(keySpan);
        }

        if (value === null) {
            const nullSpan = document.createElement('span');
            nullSpan.className = 'json-null';
            nullSpan.innerText = 'null' + (isLast ? '' : ',');
            line.appendChild(nullSpan);
            item.appendChild(line);
        } else if (typeof value === 'object') {
            const isArray = Array.isArray(value);
            const openBracket = isArray ? '[' : '{';
            const closeBracket = isArray ? ']' : '}';

            const bracketOpenSpan = document.createElement('span');
            bracketOpenSpan.className = 'json-bracket';
            bracketOpenSpan.innerText = openBracket;
            line.appendChild(bracketOpenSpan);

            const keys = Object.keys(value);
            if (keys.length === 0) {
                const bracketCloseSpan = document.createElement('span');
                bracketCloseSpan.className = 'json-bracket';
                bracketCloseSpan.innerText = closeBracket + (isLast ? '' : ',');
                line.appendChild(bracketCloseSpan);
                item.appendChild(line);
            } else {
                const toggle = document.createElement('span');
                toggle.className = 'json-toggle';
                toggle.innerText = '▼';
                line.insertBefore(toggle, line.firstChild);

                const countSpan = document.createElement('span');
                countSpan.className = 'json-count';
                countSpan.innerText = isArray ? ` // ${keys.length} items` : ` // ${keys.length} fields`;
                line.appendChild(countSpan);

                item.appendChild(line);

                const childrenContainer = document.createElement('div');
                childrenContainer.className = 'json-children';

                keys.forEach((childKey, idx) => {
                    const isChildLast = idx === keys.length - 1;
                    childrenContainer.appendChild(
                        createNode(isArray ? null : childKey, value[childKey], isChildLast)
                    );
                });

                item.appendChild(childrenContainer);

                const closingLine = document.createElement('div');
                closingLine.className = 'json-closing-line';

                const bracketCloseSpan = document.createElement('span');
                bracketCloseSpan.className = 'json-bracket';
                bracketCloseSpan.innerText = closeBracket + (isLast ? '' : ',');
                closingLine.appendChild(bracketCloseSpan);
                item.appendChild(closingLine);

                toggle.onclick = (e) => {
                    e.stopPropagation();
                    if (toggle.classList.contains('expanded') || toggle.innerText === '▼') {
                        toggle.innerText = '▶';
                        childrenContainer.style.display = 'none';
                        closingLine.style.display = 'none';
                        countSpan.innerText = isArray ? ` [...] ${keys.length} items` : ` {...} ${keys.length} fields`;
                    } else {
                        toggle.innerText = '▼';
                        childrenContainer.style.display = 'block';
                        closingLine.style.display = 'block';
                        countSpan.innerText = isArray ? ` // ${keys.length} items` : ` // ${keys.length} fields`;
                    }
                };
            }
        } else {
            const valSpan = document.createElement('span');
            valSpan.className = `json-${typeof value}`;
            if (typeof value === 'string') {
                valSpan.innerText = `"${value}"` + (isLast ? '' : ',');
            } else {
                valSpan.innerText = String(value) + (isLast ? '' : ',');
            }
            line.appendChild(valSpan);
            item.appendChild(line);
        }

        const actionsContainer = document.createElement('span');
        actionsContainer.className = 'json-actions';
        
        const btnCopy = document.createElement('span');
        btnCopy.className = 'json-btn json-btn-copy';
        btnCopy.title = '复制该节点下的完整 JSON 数据';
        btnCopy.innerText = '📋';
        btnCopy.onclick = (e) => {
            e.stopPropagation();
            let copyText = "";
            if (key !== null) {
                const formattedVal = JSON.stringify(value, null, 4);
                if (typeof value === 'object' && value !== null) {
                    const indentedVal = formattedVal.split('\n').map((line, i) => i === 0 ? line : '    ' + line).join('\n');
                    copyText = `"${key}": ${indentedVal}`;
                } else {
                    copyText = `"${key}": ${formattedVal}`;
                }
            } else {
                copyText = JSON.stringify(value, null, 4);
            }
            navigator.clipboard.writeText(copyText).then(() => {
                showToast('✅ 节点数据已复制到剪贴板', '#10b981');
            });
        };
        actionsContainer.appendChild(btnCopy);
        line.appendChild(actionsContainer);

        return item;
    }

    root.appendChild(createNode(null, data, true));
    container.appendChild(root);
}

// ─── Interactive Editable JSON Tree Editor ───
let activeEditorMode = 'tree'; // 'tree' or 'raw'
let currentTreeEditorData = null;
let editingRule = null;

function setJsonByPath(obj, path, val) {
    if (path.length === 0) return;
    let current = obj;
    for (let i = 0; i < path.length - 1; i++) {
        current = current[path[i]];
    }
    current[path[path.length - 1]] = val;
}

function renameJsonKey(obj, path, newKey) {
    if (path.length === 0) return;
    let current = obj;
    for (let i = 0; i < path.length - 1; i++) {
        current = current[path[i]];
    }
    const oldKey = path[path.length - 1];
    if (current && typeof current === 'object' && oldKey in current) {
        const keys = Object.keys(current);
        const temp = {};
        for (const k of keys) {
            if (k === oldKey) {
                temp[newKey] = current[oldKey];
            } else {
                temp[k] = current[k];
            }
        }
        for (const k of keys) {
            delete current[k];
        }
        Object.assign(current, temp);
    }
}

function deleteParameterAtPath(obj, path) {
    if (path.length === 0) return;
    let current = obj;
    for (let i = 0; i < path.length - 1; i++) {
        current = current[path[i]];
    }
    const keyToDelete = path[path.length - 1];
    if (Array.isArray(current)) {
        const idx = parseInt(keyToDelete);
        if (!isNaN(idx)) {
            current.splice(idx, 1);
        }
    } else if (current && typeof current === 'object') {
        delete current[keyToDelete];
    }
    document.getElementById('rule-body').value = JSON.stringify(currentTreeEditorData, null, 4);
    renderTreeEditor();
}

function addSiblingAfterPath(obj, path) {
    let newKeyPath = null;
    if (path.length === 0) {
        if (Array.isArray(obj)) {
            obj.push("__BLANK_LINE__");
            newKeyPath = [obj.length - 1];
        } else {
            let newKey = "__BLANK_LINE__";
            while (newKey in obj) newKey += "_";
            obj[newKey] = "__BLANK_LINE__";
            newKeyPath = [newKey];
        }
    } else {
        let parent = obj;
        for (let i = 0; i < path.length - 1; i++) {
            parent = parent[path[i]];
        }
        const targetKey = path[path.length - 1];
        
        if (Array.isArray(parent)) {
            const index = parseInt(targetKey);
            parent.splice(index + 1, 0, "__BLANK_LINE__");
            newKeyPath = [...path.slice(0, -1), index + 1];
        } else {
            let newKey = "__BLANK_LINE__";
            while (newKey in parent) newKey += "_";
            
            const oldEntries = Object.entries(parent);
            for (let k in parent) delete parent[k];
            
            for (let [k, v] of oldEntries) {
                parent[k] = v;
                if (k === targetKey) {
                    parent[newKey] = "__BLANK_LINE__";
                }
            }
            newKeyPath = [...path.slice(0, -1), newKey];
        }
    }
    document.getElementById('rule-body').value = JSON.stringify(currentTreeEditorData, null, 4);
    window.nodePathToFocus = newKeyPath;
    renderTreeEditor();
}

function parseEditedValue(text, originalType) {
    if (originalType === 'number') {
        const num = Number(text);
        return isNaN(num) ? text : num;
    }
    if (originalType === 'boolean') {
        return text.trim().toLowerCase() === 'true';
    }
    if (originalType === 'object' && text === 'null') {
        return null;
    }
    return text;
}

function switchEditorMode(mode) {
    activeEditorMode = mode;
    const treeContainer = document.getElementById('rule-body-tree-container');
    const rawTextarea = document.getElementById('rule-body');
    const btnTree = document.getElementById('btn-edit-tree');
    const btnRaw = document.getElementById('btn-edit-raw');

    if (mode === 'tree') {
        treeContainer.style.visibility = 'visible';
        treeContainer.style.zIndex = '2';
        rawTextarea.style.visibility = 'hidden';
        rawTextarea.style.zIndex = '1';
        btnTree.classList.add('active');
        btnTree.style.background = 'var(--accent)';
        btnTree.style.color = 'white';
        btnRaw.classList.remove('active');
        btnRaw.style.background = 'transparent';
        btnRaw.style.color = 'var(--text-dim)';

        // Sync from textarea back to Tree
        try {
            const jsonStr = rawTextarea.value;
            currentTreeEditorData = JSON.parse(jsonStr);
            renderTreeEditor();
        } catch (e) {
            // If JSON is invalid, switch to raw mode
            showToast('⚠️ 当前内容不是合法的 JSON，已切回源码模式', '#f59e0b');
            setTimeout(() => switchEditorMode('raw'), 10);
            return;
        }
    } else {
        treeContainer.style.visibility = 'hidden';
        treeContainer.style.zIndex = '1';
        rawTextarea.style.visibility = 'visible';
        rawTextarea.style.zIndex = '2';
        btnRaw.classList.add('active');
        btnRaw.style.background = 'var(--accent)';
        btnRaw.style.color = 'white';
        btnTree.classList.remove('active');
        btnTree.style.background = 'transparent';
        btnTree.style.color = 'var(--text-dim)';
    }
}

function renderTreeEditor() {
    if (!currentTreeEditorData) return;
    const container = document.getElementById('rule-body-tree');
    renderEditableJsonView(container, currentTreeEditorData, (updatedData) => {
        // When edited in tree, update the raw textarea value
        document.getElementById('rule-body').value = JSON.stringify(updatedData, null, 4);
    });
}

function syncTextareaToTree() {
    try {
        const val = document.getElementById('rule-body').value;
        currentTreeEditorData = JSON.parse(val);
        renderTreeEditor();
        if (activeEditorMode === 'raw' && val && typeof currentTreeEditorData === 'object') {
            // 如果本来在raw且是合法json，可以选择不强制切回去，或者留给用户手动切
        }
    } catch (e) {
        // 如果不是合法的 JSON（例如流式请求），则强制切换到源码视图以显示真实数据
        if (activeEditorMode === 'tree') {
            switchEditorMode('raw');
        }
    }
}

function syncRawToTree() {
    if (activeEditorMode === 'tree') return;
    try {
        const val = document.getElementById('rule-body').value;
        currentTreeEditorData = JSON.parse(val);
    } catch (e) { }
}

function renderEditableJsonView(container, masterData, onChange) {
    container.innerHTML = '';
    const root = document.createElement('div');
    root.className = 'json-view-root';

    function createEditableNode(key, value, path, isLast) {
        const item = document.createElement('div');
        item.className = 'json-node';

        const line = document.createElement('div');
        line.className = 'json-line';

        const isBlankLine = (key && key.startsWith('__BLANK_LINE__')) || value === '__BLANK_LINE__';

        if (isBlankLine) {
            const blankInput = document.createElement('span');
            blankInput.className = 'json-blank-input';
            blankInput.contentEditable = "true";
            blankInput.style.minWidth = '150px';
            blankInput.style.display = 'inline-block';
            blankInput.style.borderBottom = '1px dashed #6b7280';
            blankInput.style.outline = 'none';
            blankInput.style.color = 'var(--text-main)';
            
            if (window.nodePathToFocus && JSON.stringify(path) === JSON.stringify(window.nodePathToFocus)) {
                setTimeout(() => blankInput.focus(), 10);
                window.nodePathToFocus = null;
            }

            blankInput.addEventListener('paste', (e) => {
                const pastedText = (e.clipboardData || window.clipboardData).getData('text');
                e.preventDefault();
                try {
                    let parsed = null;
                    let isKeyValue = false;
                    if (pastedText.match(/^\s*".+"\s*:/)) {
                        parsed = JSON.parse(`{${pastedText}}`);
                        isKeyValue = true;
                    } else {
                        parsed = JSON.parse(pastedText);
                    }
                    
                    if (isKeyValue) {
                        const newKey = Object.keys(parsed)[0];
                        const newVal = parsed[newKey];
                        if (key && key.startsWith('__BLANK_LINE__')) {
                            renameJsonKey(masterData, path, newKey);
                            setJsonByPath(masterData, [...path.slice(0, -1), newKey], newVal);
                        } else {
                            setJsonByPath(masterData, path, parsed);
                        }
                    } else {
                        if (key && key.startsWith('__BLANK_LINE__')) {
                            let genKey = "new_param";
                            renameJsonKey(masterData, path, genKey);
                            setJsonByPath(masterData, [...path.slice(0, -1), genKey], parsed);
                        } else {
                            setJsonByPath(masterData, path, parsed);
                        }
                    }
                    if (onChange) onChange(masterData);
                    renderTreeEditor();
                } catch (err) {
                    document.execCommand('insertText', false, pastedText);
                }
            });

            blankInput.onblur = () => {
                const text = blankInput.innerText.trim();
                if (!text) {
                    deleteParameterAtPath(masterData, path);
                    if (onChange) onChange(masterData);
                    renderTreeEditor();
                    return;
                }
                
                try {
                    let parsed = null;
                    let isKeyValue = false;
                    if (text.match(/^\s*".+"\s*:/)) {
                        parsed = JSON.parse(`{${text}}`);
                        isKeyValue = true;
                    } else {
                        parsed = JSON.parse(text);
                    }
                    
                    if (isKeyValue) {
                        const newKey = Object.keys(parsed)[0];
                        const newVal = parsed[newKey];
                        if (key && key.startsWith('__BLANK_LINE__')) {
                            renameJsonKey(masterData, path, newKey);
                            setJsonByPath(masterData, [...path.slice(0, -1), newKey], newVal);
                        } else {
                            setJsonByPath(masterData, path, parsed);
                        }
                    } else {
                        if (key && key.startsWith('__BLANK_LINE__')) {
                            let genKey = "new_param";
                            renameJsonKey(masterData, path, genKey);
                            setJsonByPath(masterData, [...path.slice(0, -1), genKey], parsed);
                        } else {
                            setJsonByPath(masterData, path, parsed);
                        }
                    }
                } catch (e) {
                    if (key && key.startsWith('__BLANK_LINE__')) {
                        renameJsonKey(masterData, path, text);
                        setJsonByPath(masterData, [...path.slice(0, -1), text], "");
                    } else {
                        setJsonByPath(masterData, path, text);
                    }
                }
                if (onChange) onChange(masterData);
                renderTreeEditor();
            };

            line.appendChild(blankInput);
            item.appendChild(line);
            return item;
        }

        const handlePaste = (e, isKey) => {
            const pastedText = (e.clipboardData || window.clipboardData).getData('text');
            try {
                let parsed = null;
                let isKeyValue = false;
                if (pastedText.match(/^\s*".+"\s*:/)) {
                    parsed = JSON.parse(`{${pastedText}}`);
                    isKeyValue = true;
                } else {
                    parsed = JSON.parse(pastedText);
                }
                
                e.preventDefault();
                if (isKeyValue) {
                    const newKey = Object.keys(parsed)[0];
                    const newVal = parsed[newKey];
                    if (isKey) {
                        renameJsonKey(masterData, path, newKey);
                        setJsonByPath(masterData, [...path.slice(0, -1), newKey], newVal);
                    } else {
                        setJsonByPath(masterData, path, parsed);
                    }
                } else {
                    if (isKey) return;
                    setJsonByPath(masterData, path, parsed);
                }
                if (onChange) onChange(masterData);
                renderTreeEditor();
            } catch (err) {}
        };

        // Render Key
        if (key !== null) {
            const quoteOpen = document.createElement('span');
            quoteOpen.className = 'json-bracket';
            quoteOpen.innerText = '"';
            line.appendChild(quoteOpen);

            const keySpan = document.createElement('span');
            keySpan.className = 'json-key-editable';
            keySpan.contentEditable = "true";
            keySpan.innerText = key;
            
            if (window.nodePathToFocus && JSON.stringify(path) === JSON.stringify(window.nodePathToFocus)) {
                setTimeout(() => {
                    keySpan.focus();
                    document.execCommand('selectAll', false, null);
                }, 10);
                window.nodePathToFocus = null;
            }

            keySpan.addEventListener('paste', (e) => handlePaste(e, true));

            keySpan.onblur = () => {
                const newKey = keySpan.innerText.trim();
                if (newKey && newKey !== key) {
                    renameJsonKey(masterData, path, newKey);
                    if (onChange) onChange(masterData);
                    renderTreeEditor();
                } else {
                    keySpan.innerText = key;
                }
            };
            line.appendChild(keySpan);

            const quoteClose = document.createElement('span');
            quoteClose.className = 'json-bracket';
            quoteClose.innerText = '": ';
            line.appendChild(quoteClose);
        }

        if (value === null) {
            const nullSpan = document.createElement('span');
            nullSpan.className = 'json-null editable-json-value';
            nullSpan.contentEditable = "true";
            nullSpan.innerText = 'null';

            nullSpan.onblur = () => {
                const newVal = nullSpan.innerText.trim() === 'null' ? null : nullSpan.innerText;
                setJsonByPath(masterData, path, newVal);
                if (onChange) onChange(masterData);
            };

            line.appendChild(nullSpan);

            const comma = document.createElement('span');
            comma.innerText = isLast ? '' : ',';
            line.appendChild(comma);

            item.appendChild(line);
        } else if (typeof value === 'object') {
            const isArray = Array.isArray(value);
            const openBracket = isArray ? '[' : '{';
            const closeBracket = isArray ? ']' : '}';

            const bracketOpenSpan = document.createElement('span');
            bracketOpenSpan.className = 'json-bracket';
            bracketOpenSpan.innerText = openBracket;
            line.appendChild(bracketOpenSpan);

            const keys = Object.keys(value);
            if (keys.length === 0) {
                const bracketCloseSpan = document.createElement('span');
                bracketCloseSpan.className = 'json-bracket';
                bracketCloseSpan.innerText = closeBracket + (isLast ? '' : ',');
                line.appendChild(bracketCloseSpan);
                item.appendChild(line);
            } else {
                const toggle = document.createElement('span');
                toggle.className = 'json-toggle';
                toggle.innerText = '▼';
                line.insertBefore(toggle, line.firstChild);

                const countSpan = document.createElement('span');
                countSpan.className = 'json-count';
                countSpan.innerText = isArray ? ` // ${keys.length} items` : ` // ${keys.length} fields`;
                line.appendChild(countSpan);

                item.appendChild(line);

                const childrenContainer = document.createElement('div');
                childrenContainer.className = 'json-children';

                keys.forEach((childKey, idx) => {
                    const isChildLast = idx === keys.length - 1;
                    const newPath = [...path, childKey];
                    childrenContainer.appendChild(
                        createEditableNode(isArray ? null : childKey, value[childKey], newPath, isChildLast)
                    );
                });

                item.appendChild(childrenContainer);

                const closingLine = document.createElement('div');
                closingLine.className = 'json-closing-line';

                const bracketCloseSpan = document.createElement('span');
                bracketCloseSpan.className = 'json-bracket';
                bracketCloseSpan.innerText = closeBracket + (isLast ? '' : ',');
                closingLine.appendChild(bracketCloseSpan);
                item.appendChild(closingLine);

                toggle.onclick = (e) => {
                    e.stopPropagation();
                    if (toggle.innerText === '▼') {
                        toggle.innerText = '▶';
                        childrenContainer.style.display = 'none';
                        closingLine.style.display = 'none';
                        countSpan.innerText = isArray ? ` [...] ${keys.length} items` : ` {...} ${keys.length} fields`;
                    } else {
                        toggle.innerText = '▼';
                        childrenContainer.style.display = 'block';
                        closingLine.style.display = 'block';
                        countSpan.innerText = isArray ? ` // ${keys.length} items` : ` // ${keys.length} fields`;
                    }
                };
            }
        } else {
            const originalType = typeof value;
            
            if (originalType === 'string') {
                const quoteOpen = document.createElement('span');
                quoteOpen.className = 'json-bracket';
                quoteOpen.innerText = '"';
                line.appendChild(quoteOpen);
            }

            const valSpan = document.createElement('span');
            valSpan.className = `json-${originalType} editable-json-value`;
            valSpan.contentEditable = "true";
            valSpan.innerText = typeof value === 'string' ? value : String(value);

            if (window.nodePathToFocus && key === null && JSON.stringify(path) === JSON.stringify(window.nodePathToFocus)) {
                setTimeout(() => {
                    valSpan.focus();
                    document.execCommand('selectAll', false, null);
                }, 10);
                window.nodePathToFocus = null;
            }

            valSpan.addEventListener('paste', (e) => handlePaste(e, false));

            valSpan.onblur = () => {
                const rawText = valSpan.innerText;
                const parsed = parseEditedValue(rawText, originalType);
                setJsonByPath(masterData, path, parsed);
                if (onChange) onChange(masterData);
            };

            line.appendChild(valSpan);

            if (originalType === 'string') {
                const quoteClose = document.createElement('span');
                quoteClose.className = 'json-bracket';
                quoteClose.innerText = '"';
                line.appendChild(quoteClose);
            }

            const comma = document.createElement('span');
            comma.innerText = isLast ? '' : ',';
            line.appendChild(comma);

            item.appendChild(line);
        }

        // Add advanced actions (＋ / ×) for parameter editing!
        const actionsContainer = document.createElement('span');
        actionsContainer.className = 'json-actions';

        const btnAdd = document.createElement('span');
        btnAdd.className = 'json-btn json-btn-add';
        btnAdd.title = '在此字段下方插入新字段';
        btnAdd.innerText = '＋';
        btnAdd.onclick = (e) => {
            e.stopPropagation();
            addSiblingAfterPath(masterData, path);
        };
        actionsContainer.appendChild(btnAdd);

        if (path.length > 0) {
            const btnDel = document.createElement('span');
            btnDel.className = 'json-btn json-btn-del';
            btnDel.title = '删除此参数';
            btnDel.innerText = '×';
            btnDel.onclick = (e) => {
                e.stopPropagation();
                deleteParameterAtPath(masterData, path);
            };
            actionsContainer.appendChild(btnDel);
        }

        const btnCopy = document.createElement('span');
        btnCopy.className = 'json-btn json-btn-copy';
        btnCopy.title = '复制该节点下的完整 JSON 数据';
        btnCopy.innerText = '📋';
        btnCopy.onclick = (e) => {
            e.stopPropagation();
            let copyText = "";
            if (key !== null) {
                const formattedVal = JSON.stringify(value, null, 4);
                if (typeof value === 'object' && value !== null) {
                    const indentedVal = formattedVal.split('\n').map((line, i) => i === 0 ? line : '    ' + line).join('\n');
                    copyText = `"${key}": ${indentedVal}`;
                } else {
                    copyText = `"${key}": ${formattedVal}`;
                }
            } else {
                copyText = JSON.stringify(value, null, 4);
            }
            navigator.clipboard.writeText(copyText).then(() => {
                showToast('✅ 节点数据已复制到剪贴板', '#10b981');
            });
        };
        actionsContainer.appendChild(btnCopy);

        if (actionsContainer.children.length > 0) {
            line.appendChild(actionsContainer);
        }

        return item;
    }

    root.appendChild(createEditableNode(null, masterData, [], true));
    container.appendChild(root);
}

function tryRenderJsonView(elementId, dataOrString) {
    const container = document.getElementById(elementId);
    if (!container) return;
    container.innerHTML = '';

    if (!dataOrString || (typeof dataOrString === 'object' && Object.keys(dataOrString).length === 0)) {
        container.innerText = '{}';
        return;
    }

    let jsonObj = null;
    if (typeof dataOrString === 'object') {
        jsonObj = dataOrString;
    } else {
        try {
            jsonObj = JSON.parse(dataOrString);
        } catch (e) {
            container.innerText = dataOrString;
            return;
        }
    }
    renderJsonView(container, jsonObj);
}

