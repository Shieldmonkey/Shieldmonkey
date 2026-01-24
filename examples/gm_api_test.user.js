// ==UserScript==
// @name         Shieldmonkey API Test Suite
// @namespace    https://github.com/shieldmonkey/shieldmonkey
// @version      1.0
// @description  Comprehensive test suite for GM_ APIs in Shieldmonkey
// @author       Antigravity
// @match        <all_urls>
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_listValues
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @grant        GM_notification
// @grant        GM_setClipboard
// @grant        GM_addStyle
// @grant        GM_addElement
// @grant        GM_openInTab
// @grant        GM_log
// @grant        GM_info
// @grant        unsafeWindow
// ==/UserScript==

(function() {
    'use strict';

    // UI Configuration
    const UI_ID = 'gm-test-suite-ui';
    const TOGGLE_ID = 'gm-test-suite-toggle';
    
    // Create UI Container
    function createUI() {
        if (document.getElementById(UI_ID)) return;

        const container = document.createElement('div');
        container.id = UI_ID;
        container.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 2147483647;
            font-family: sans-serif;
            background: #222;
            color: #fff;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.5);
            width: 300px;
            display: none;
            flex-direction: column;
            border: 1px solid #444;
            max-height: 80vh;
        `;

        // header
        const header = document.createElement('div');
        header.style.cssText = `
            padding: 10px;
            background: #333;
            border-bottom: 1px solid #444;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-radius: 8px 8px 0 0;
            font-weight: bold;
        `;
        header.textContent = 'GM API Test Suite';
        
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '×';
        closeBtn.style.cssText = `
            background: none;
            border: none;
            color: #fff;
            cursor: pointer;
            font-size: 18px;
        `;
        closeBtn.onclick = toggleUI;
        header.appendChild(closeBtn);
        container.appendChild(header);

        // Content Area (Scrollable)
        const content = document.createElement('div');
        content.style.cssText = `
            padding: 10px;
            overflow-y: auto;
            flex-grow: 1;
        `;
        container.appendChild(content);

        // Log Area
        const logArea = document.createElement('pre');
        logArea.style.cssText = `
            height: 100px;
            overflow-y: auto;
            background: #000;
            color: #0f0;
            padding: 5px;
            margin: 0;
            font-size: 10px;
            border-top: 1px solid #444;
            border-radius: 0 0 8px 8px;
            white-space: pre-wrap;
        `;
        container.appendChild(logArea);

        document.body.appendChild(container);

        // Floating Toggle Button
        const toggle = document.createElement('div');
        toggle.id = TOGGLE_ID;
        toggle.textContent = '🛠️';
        toggle.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 2147483647;
            width: 50px;
            height: 50px;
            background: #007bff;
            color: white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            transition: transform 0.2s;
        `;
        toggle.onmouseover = () => toggle.style.transform = 'scale(1.1)';
        toggle.onmouseout = () => toggle.style.transform = 'scale(1)';
        toggle.onclick = toggleUI;
        document.body.appendChild(toggle);

        // Helper to add buttons
        function addBtn(label, fn) {
            const btn = document.createElement('button');
            btn.textContent = label;
            btn.style.cssText = `
                display: block;
                width: 100%;
                margin-bottom: 5px;
                padding: 8px;
                background: #444;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                text-align: left;
            `;
            btn.onclick = async () => {
                log(`Running: ${label}...`);
                try {
                    await fn();
                    // log(`Done: ${label}`);
                } catch (e) {
                    log(`Error in ${label}: ${e.message}`);
                    console.error(e);
                }
            };
            content.appendChild(btn);
        }

        // Logger
        function log(msg) {
            const line = document.createElement('div');
            line.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
            logArea.insertBefore(line, logArea.firstChild);
            console.log(`[ShieldmonkeyTest] ${msg}`);
        }

        // --- TESTS ---

        addBtn('Test Storage (Set/Get)', async () => {
            log('Setting value "testKey" = "Hello World"...');
            await GM_setValue('testKey', 'Hello World');
            const val = await GM_getValue('testKey');
            log(`Got value: "${val}"`);
            if (val === 'Hello World') log('SUCCESS: Storage Works');
            else log('FAILURE: Storage mismatch');
        });

        addBtn('Test Storage (List/Delete)', async () => {
            await GM_setValue('delKey', 'To be deleted');
            const listBefore = await GM_listValues();
            log(`Keys before: ${JSON.stringify(listBefore)}`);
            await GM_deleteValue('delKey');
            const listAfter = await GM_listValues();
            log(`Keys after: ${JSON.stringify(listAfter)}`);
            if (!listAfter.includes('delKey')) log('SUCCESS: Delete Works');
        });

        addBtn('Test GM_xmlhttpRequest (GET)', () => {
             return new Promise((resolve) => {
                 GM_xmlhttpRequest({
                     method: 'GET',
                     url: 'https://httpbin.org/get',
                     onload: function(response) {
                         log(`Status: ${response.status}`);
                         try {
                             const json = JSON.parse(response.responseText);
                             log(`Origin: ${json.origin}`);
                             log('SUCCESS: XHR Works');
                         } catch(e) {
                             log('Error parsing JSON');
                         }
                         resolve();
                     },
                     onerror: function(err) {
                         log(`XHR Error: ${JSON.stringify(err)}`);
                         resolve();
                     }
                 });
             });
        });

        addBtn('Test Menu Command', () => {
            GM_registerMenuCommand('Hello from Test Suite', () => {
                alert('Menu Command Clicked!');
                log('Menu command callback executed.');
            });
            log('Registered "Hello from Test Suite". Check extension menu.');
        });

        addBtn('Test Notification', () => {
            GM_notification({
                text: 'This is a test notification',
                title: 'Shieldmonkey Test',
                onclick: () => log('Notification clicked!')
            });
            log('Notification sent.');
        });

        addBtn('Test Clipboard', () => {
            GM_setClipboard('Copied from Shieldmonkey Test');
            log('Set clipboard to "Copied from Shieldmonkey Test". Paste somewhere to verify.');
        });

        addBtn('Test GM_addStyle', () => {
            GM_addStyle(`#${UI_ID} { border: 2px solid cyan !important; }`);
            log('Border changed to Cyan via GM_addStyle.');
        });
        
        addBtn('Test GM_openInTab', () => {
            GM_openInTab('https://example.com', { active: true, insert: true });
            log('Opened example.com in new tab.');
        });

        addBtn('Test Isolation (Window)', () => {
            window.shieldTestVar = 'Isolated?';
            log('Set window.shieldTestVar. Check console for window.shieldTestVar leaks.');
            log(`window === unsafeWindow is ${window === unsafeWindow}`);
            // Note: In typical UserScript engines, window != unsafeWindow.
            // If they are equal, sandbox might be weak or missing.
            if (window !== unsafeWindow) {
                log('SUCCESS: Window is isolated (window != unsafeWindow)');
            } else {
                log('WARNING: Window is NOT isolated (window == unsafeWindow)');
            }
        });
        
        addBtn('Test Runtime Access check', () => {
            log('Checking chrome.runtime.sendMessage access...');
            let runtime = null;
            try {
                // @ts-ignore
                if (typeof chrome !== 'undefined' && chrome.runtime) runtime = chrome.runtime;
                // @ts-ignore
                else if (typeof browser !== 'undefined' && browser.runtime) runtime = browser.runtime;
                
                if (runtime && runtime.sendMessage) {
                    log('INFO: chrome.runtime.sendMessage is accessible (Expected for messaging).');
                    // We rely on background script to validate permissions per request.
                    // See gm_permission_violation.user.js for escalation tests.
                } else {
                    log('INFO: chrome.runtime.sendMessage is NOT accessible.');
                }
            } catch(e) {
                log(`Error accessing runtime: ${e.message}`);
            }
        });

        addBtn('Print GM_info', () => {
            log(JSON.stringify(GM_info, null, 2));
        });
    }

    function toggleUI() {
        const ui = document.getElementById(UI_ID);
        const toggle = document.getElementById(TOGGLE_ID);
        if (ui.style.display === 'none') {
            ui.style.display = 'flex';
            toggle.style.display = 'none';
        } else {
            ui.style.display = 'none';
            toggle.style.display = 'flex';
        }
    }

    // Init
    // Wait for body
    if (document.body) {
        createUI();
    } else {
        const obs = new MutationObserver(() => {
            if (document.body) {
                createUI();
                obs.disconnect();
            }
        });
        obs.observe(document.documentElement, { childList: true });
    }

})();
