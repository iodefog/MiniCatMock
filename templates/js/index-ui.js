        function switchDetailsSubTab(tab) {
            document.querySelectorAll('.details-tab').forEach(btn => btn.classList.remove('active'));
            const clickedBtn = Array.from(document.querySelectorAll('.details-tab')).find(btn => btn.innerText.toLowerCase().includes(tab.toLowerCase()));
            if (clickedBtn) clickedBtn.classList.add('active');

            const reqContent = document.getElementById('details-request-content');
            const respContent = document.getElementById('details-response-content');
            const composerContent = document.getElementById('details-composer-content');

            if (reqContent) reqContent.style.display = 'none';
            if (respContent) respContent.style.display = 'none';
            if (composerContent) composerContent.style.display = 'none';

            if (tab === 'request') {
                if (reqContent) reqContent.style.display = 'flex';
            } else if (tab === 'response') {
                if (respContent) respContent.style.display = 'flex';
            } else if (tab === 'composer') {
                if (composerContent) composerContent.style.display = 'flex';
            }

            // 切换标签后重新计算「回到顶部」按钮的可见性
            if (typeof updateRespScrollTopBtn === 'function') updateRespScrollTopBtn();
        }

        window.fillComposerFromLog = function (log, originalUrl) {
            const composerMethod = document.getElementById('composer-method');
            const composerUrl = document.getElementById('composer-url');
            const composerHeaders = document.getElementById('composer-headers');
            const composerBody = document.getElementById('composer-body');
            const composerQuery = document.getElementById('composer-query');

            if (composerMethod) composerMethod.value = log.method || 'GET';

            if (composerUrl) {
                try {
                    const parsedUrl = new URL(originalUrl);
                    const queryParams = {};
                    for (let [k, v] of parsedUrl.searchParams.entries()) {
                        queryParams[k] = v;
                    }
                    parsedUrl.search = '';
                    composerUrl.value = parsedUrl.toString();
                    if (composerQuery) {
                        const mergedQuery = { ...queryParams, ...(log.query_params || {}) };
                        composerQuery.value = Object.keys(mergedQuery).length > 0 ? JSON.stringify(mergedQuery, null, 4) : '';
                    }
                } catch (e) {
                    composerUrl.value = originalUrl || '';
                    if (composerQuery) {
                        const qp = log.query_params || {};
                        composerQuery.value = Object.keys(qp).length > 0 ? JSON.stringify(qp, null, 4) : '';
                    }
                }
            }

            if (composerHeaders) {
                const cleanHeaders = {};
                const PROXY_EXCLUDED_HEADERS = new Set([
                    'host', 'x-original-url', 'x-original-host', 'content-length',
                    'x-forwarded-proto', 'x-forwarded-for', 'x-forwarded-port',
                    'x-forwarded-host', 'x-real-ip', 'x-scheme', 'connection',
                    'keep-alive', 'accept-encoding'
                ]);
                for (const [key, value] of Object.entries(log.headers || {})) {
                    if (!PROXY_EXCLUDED_HEADERS.has(key.toLowerCase())) {
                        cleanHeaders[key] = value;
                    }
                }
                composerHeaders.value = JSON.stringify(cleanHeaders, null, 4);
            }

            if (composerBody) {
                if (log.body) {
                    if (typeof log.body === 'object') {
                        composerBody.value = JSON.stringify(log.body, null, 4);
                    } else {
                        composerBody.value = String(log.body);
                    }
                } else {
                    composerBody.value = '';
                }
            }

            // Reset composer response area
            const statusLabel = document.getElementById('composer-status');
            const respArea = document.getElementById('composer-response-area');
            if (statusLabel) statusLabel.style.display = 'none';
            if (respArea) respArea.style.display = 'none';
        };

        async function sendComposerRequest() {
            const method = document.getElementById('composer-method').value;
            let urlStr = document.getElementById('composer-url').value.trim();
            const headersStr = document.getElementById('composer-headers').value.trim();
            const bodyStr = document.getElementById('composer-body').value.trim();
            const queryStr = document.getElementById('composer-query')?.value.trim();

            if (!urlStr) {
                showToast('⚠️ 请先输入请求 URL', '#f59e0b');
                return;
            }

            if (queryStr) {
                try {
                    const parsedQuery = JSON.parse(queryStr);
                    if (Object.keys(parsedQuery).length > 0) {
                        const urlObj = new URL(urlStr);
                        for (const [k, v] of Object.entries(parsedQuery)) {
                            urlObj.searchParams.set(k, v);
                        }
                        urlStr = urlObj.toString();
                    }
                } catch (e) {
                    showToast('❌ Query JSON 格式错误', '#ef4444');
                    return;
                }
            }

            let parsedHeaders = {};
            if (headersStr) {
                try {
                    parsedHeaders = JSON.parse(headersStr);
                } catch (e) {
                    showToast('❌ Headers JSON 格式错误', '#ef4444');
                    return;
                }
            }

            let parsedBody = bodyStr;
            if (bodyStr) {
                try {
                    // 压缩并以字符串发送，防止后端 Python json.dumps 自动加空格导致 content-length 变化及签名鉴权失败
                    parsedBody = JSON.stringify(JSON.parse(bodyStr));
                } catch (e) {
                    // fallback to plain string
                    parsedBody = bodyStr;
                }
            }

            const sendBtn = document.getElementById('btn-composer-send');
            const statusLabel = document.getElementById('composer-status');
            const originalText = sendBtn.innerHTML;

            sendBtn.innerHTML = '⚡ 发送中...';
            sendBtn.disabled = true;
            sendBtn.style.opacity = '0.7';

            statusLabel.style.display = 'none';
            document.getElementById('composer-response-area').style.display = 'none';

            try {
                const res = await fetch('/api/replay-request', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        url: urlStr,
                        method: method,
                        headers: parsedHeaders,
                        body: parsedBody
                    })
                });

                const result = await res.json();

                if (result.error) {
                    showToast('❌ ' + result.error, '#ef4444');
                    statusLabel.innerText = 'FAILED';
                    statusLabel.style.background = '#fee2e2';
                    statusLabel.style.color = '#ef4444';
                    statusLabel.style.display = 'inline-block';
                } else {
                    showToast('🎉 请求成功！');
                    statusLabel.innerText = 'STATUS: ' + result.status_code;
                    if (result.status_code >= 200 && result.status_code < 300) {
                        statusLabel.style.background = '#d1fae5';
                        statusLabel.style.color = '#10b981';
                    } else {
                        statusLabel.style.background = '#fee2e2';
                        statusLabel.style.color = '#ef4444';
                    }
                    statusLabel.style.display = 'inline-block';

                    document.getElementById('composer-response-area').style.display = 'flex';

                    // Format response headers
                    if (window.tryRenderJsonView) {
                        window.tryRenderJsonView('composer-resp-headers', result.headers);
                    } else {
                        document.getElementById('composer-resp-headers').innerText = JSON.stringify(result.headers, null, 4);
                    }

                    // Format response body
                    if (window.tryRenderJsonView) {
                        window.tryRenderJsonView('composer-resp-body', result.data);
                    } else {
                        let responseStr = typeof result.data === 'object' ? JSON.stringify(result.data, null, 4) : String(result.data);
                        document.getElementById('composer-resp-body').innerText = responseStr;
                    }
                }
            } catch (err) {
                console.error('❌ 发送模拟请求出错:', err);
                showToast('❌ 发送或解析请求失败，请查看控制台', '#ef4444');
            } finally {
                sendBtn.innerHTML = originalText;
                sendBtn.disabled = false;
                sendBtn.style.opacity = '1';
            }
        }

        function fillComposerResponseToMock() {
            const respBody = document.getElementById('composer-resp-body').innerText;
            if (!respBody || respBody === '无响应数据') {
                showToast('⚠️ 无可回填的响应数据', '#eab308');
                return;
            }

            const ruleBodyInput = document.getElementById('rule-body');
            if (ruleBodyInput) {
                ruleBodyInput.value = respBody;
                syncRawToTree();
                if (activeEditorMode === 'tree') {
                    renderTreeEditor();
                }
                showToast('🎯 成功回填至 Mock 规则 Response Body！');
            }
        }

        function updateDelayTooltip(val) {
            const tooltip = document.getElementById('delay-tooltip');
            if (tooltip) {
                tooltip.innerText = val + 'ms';
            }
        }

        function formatMockJson() {
            const rawText = document.getElementById('rule-body').value;
            try {
                const obj = JSON.parse(rawText);
                const formatted = JSON.stringify(obj, null, 4);
                document.getElementById('rule-body').value = formatted;
                syncRawToTree();
                if (activeEditorMode === 'tree') {
                    renderTreeEditor();
                }
                showToast('✨ JSON 格式化成功！');
            } catch (e) {
                showToast('❌ JSON 格式错误，无法格式化', '#ef4444');
            }
        }

        function copyMockJson() {
            const rawText = document.getElementById('rule-body').value;
            if (!rawText.trim()) {
                showToast('没有可复制的内容', '#f59e0b');
                return;
            }
            try {
                // Try to format it beautifully before copying
                const obj = JSON.parse(rawText);
                const formatted = JSON.stringify(obj, null, 4);
                navigator.clipboard.writeText(formatted).then(() => {
                    showToast('✅ 完整响应数据已复制', '#10b981');
                });
            } catch (e) {
                // Fallback to copy raw text if not valid JSON
                navigator.clipboard.writeText(rawText).then(() => {
                    showToast('✅ 完整数据已复制', '#10b981');
                });
            }
        }

        function copyRealResponseJson() {
            if (!currentSelectedLogId || !window.capturedLogsMap[currentSelectedLogId]) return;
            const log = window.capturedLogsMap[currentSelectedLogId];
            const dataOrString = log.mock_response || log.response_body;
            if (!dataOrString) {
                showToast('没有可复制的内容', '#f59e0b');
                return;
            }
            try {
                const formatted = typeof dataOrString === 'object' ?
                    JSON.stringify(dataOrString, null, 4) :
                    JSON.stringify(JSON.parse(dataOrString), null, 4);
                navigator.clipboard.writeText(formatted).then(() => {
                    showToast('✅ 真实响应数据已复制', '#10b981');
                });
            } catch (e) {
                navigator.clipboard.writeText(String(dataOrString)).then(() => {
                    showToast('✅ 真实数据已复制', '#10b981');
                });
            }
        }

        async function toggleServiceButton() {
            const checkbox = document.getElementById('global-mock-switch');
            if (!checkbox) return;
            const newChecked = !checkbox.checked;
            checkbox.checked = newChecked;

            await toggleGlobalMock(newChecked);
            updateToggleServiceButtonStyle(newChecked);
        }

        function updateToggleServiceButtonStyle(enabled) {
            const btn = document.getElementById('btn-toggle-service');
            const dot = document.querySelector('.status-dot-badge .dot');
            const text = document.getElementById('mock-status-dot-badge');

            if (btn) {
                if (enabled) {
                    btn.innerText = 'ON';
                    btn.classList.add('active');
                } else {
                    btn.innerText = 'OFF';
                    btn.classList.remove('active');
                }
            }

            if (dot) {
                if (enabled) {
                    dot.classList.add('active');
                } else {
                    dot.classList.remove('active');
                }
            }

            if (text) {
                text.innerHTML = enabled
                    ? '<span class="dot active"></span> Mock Active'
                    : '<span class="dot"></span> Mock Disabled';
            }
        }

        // Intercept delay changes to update visual tooltips
        setInterval(() => {
            const slider = document.getElementById('rule-delay');
            if (slider) {
                updateDelayTooltip(slider.value);
            }
            // Auto sync toggle service on start
            const checkbox = document.getElementById('global-mock-switch');
            if (checkbox) {
                updateToggleServiceButtonStyle(checkbox.checked);
            }
        }, 1000);

        // ─── Response Body 滚动回顶部按钮 ───
        // 规则：当对应详情列表向下滚动 >= 300px 时显示按钮，否则隐藏。
        // 真正的滚动容器是 .detail-block（overflow-y:auto）；同时兼顾 .details-top-half
        // 视图与响应体 <pre>（#inspect-response）自身独立滚动的情况。
        function updateRespScrollTopBtn() {
            var btn = document.getElementById('resp-scroll-top-btn');
            if (!btn) return;
            var candidates = [
                document.querySelector('.detail-block'),
                document.querySelector('.details-top-half'),
                document.getElementById('inspect-response')
            ];
            var maxScroll = 0;
            candidates.forEach(function (el) {
                // 仅统计当前可见（非 display:none）的滚动容器，避免隐藏视图误判
                if (el && el.offsetParent !== null && el.scrollTop > maxScroll) {
                    maxScroll = el.scrollTop;
                }
            });
            btn.classList.toggle('visible', maxScroll >= 300);
        }

        function initRespScrollTopBtn() {
            var btn = document.getElementById('resp-scroll-top-btn');
            if (!btn) return;
            var candidates = [
                document.querySelector('.detail-block'),
                document.querySelector('.details-top-half'),
                document.getElementById('inspect-response'),
                document.getElementById('inspect-req-headers'),
                document.getElementById('inspect-query'),
                document.getElementById('inspect-body')
            ];

            candidates.forEach(function (el) {
                if (!el) return;
                el.addEventListener('scroll', updateRespScrollTopBtn);
                // 内容被填充 / 高度变化（含切换详情子标签）时重新计算可见性
                new MutationObserver(updateRespScrollTopBtn).observe(el, { childList: true, subtree: true, characterData: true });
            });

            btn.addEventListener('click', function () {
                // 外层详情面板容器（请求/响应/cURL 共用，.detail-block 才是真正滚动的容器）
                var detailBlock = document.querySelector('.detail-block');
                if (detailBlock) detailBlock.scrollTo({ top: 0, behavior: 'smooth' });
                // 响应体 / 请求体内部独立滚动的 <pre> 区域
                ['inspect-response', 'inspect-req-headers', 'inspect-query', 'inspect-body', 'inspect-req-url']
                    .forEach(function (id) {
                        var el = document.getElementById(id);
                        if (el) el.scrollTo({ top: 0, behavior: 'smooth' });
                    });
                // 兼容 selection-state 视图里的 details-top-half
                if (topHalf) topHalf.scrollTo({ top: 0, behavior: 'smooth' });
            });

            updateRespScrollTopBtn();
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initRespScrollTopBtn);
        } else {
            initRespScrollTopBtn();
        }
