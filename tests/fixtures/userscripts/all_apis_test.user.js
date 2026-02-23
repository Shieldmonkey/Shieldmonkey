// ==UserScript==
// @name         ShieldMonkey All API Test
// @namespace    https://github.com/shieldmonkey/
// @copyright    2026, ShieldMonkey Team
// @version      1.0.0
// @description  Test suite for all standard and non-standard GM APIs supported (or unsupported) by ShieldMonkey.
// @icon         https://www.google.com/s2/favicons?sz=64&domain=example.com
// @iconURL      https://www.google.com/s2/favicons?sz=64&domain=example.com
// @defaulticon  https://www.google.com/s2/favicons?sz=64&domain=example.com
// @icon64       https://www.google.com/s2/favicons?sz=64&domain=example.com
// @icon64URL    https://www.google.com/s2/favicons?sz=64&domain=example.com
// @author       ShieldMonkey
// @homepage     https://example.com
// @homepageURL  https://example.com
// @website      https://example.com
// @source       https://github.com/shieldmonkey/shieldmonkey
// @antifeature  ads
// @require      https://cdn.jsdelivr.net/npm/toastify-js
// @resource     testResource https://www.example.com/
// @include      *://example.com/*
// @match        *://example.com/*
// @exclude      *://example.com/exclude
// @run-at       document-end
// @run-in       user-content
// @sandbox      JavaScript
// @tag          test
// @connect      example.com
// @connect      httpbin.org
// @noframes
// @updateURL    https://example.com/script.meta.js
// @downloadURL  https://example.com/script.user.js
// @supportURL   https://github.com/shieldmonkey/shieldmonkey/issues
// @webRequest   {"selector": "*", "action": "cancel"}
// @unwrap
// @grant        unsafeWindow
// @grant        GM_addElement
// @grant        GM_addStyle
// @grant        GM_download
// @grant        GM_getResourceText
// @grant        GM_getResourceURL
// @grant        GM_info
// @grant        GM_log
// @grant        GM_notification
// @grant        GM_openInTab

// @grant        GM_setClipboard
// @grant        GM_getTab
// @grant        GM_saveTab
// @grant        GM_getTabs
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_listValues
// @grant        GM_setValues
// @grant        GM_getValues
// @grant        GM_deleteValues
// @grant        GM_addValueChangeListener
// @grant        GM_removeValueChangeListener
// @grant        GM_xmlhttpRequest
// @grant        GM_webRequest
// @grant        GM_cookie.list
// @grant        GM_cookie.set
// @grant        GM_cookie.delete
// @grant        GM_audio
// @grant        window.onurlchange
// @grant        window.close
// @grant        window.focus
// ==/UserScript==

(function() {
    'use strict';

    // UI creation helper
    const containerId = 'sm-test-container';
    if (document.getElementById(containerId)) return;

    GM_addStyle(`
        #${containerId} {
            position: fixed;
            top: 20px;
            right: 20px;
            width: 350px;
            max-height: 90vh;
            overflow-y: auto;
            background: rgba(0, 0, 0, 0.9);
            color: #fff;
            z-index: 999999;
            padding: 15px;
            border-radius: 8px;
            font-family: monospace;
            box-shadow: 0 4px 12px rgba(0,0,0,0.5);
            font-size: 12px;
        }
        #${containerId} h2 {
            margin: 0 0 10px 0;
            font-size: 16px;
            border-bottom: 1px solid #444;
            padding-bottom: 5px;
        }
        #${containerId} button {
            display: block;
            width: 100%;
            margin-bottom: 5px;
            padding: 5px;
            background: #333;
            color: white;
            border: 1px solid #555;
            cursor: pointer;
            text-align: left;
        }
        #${containerId} button:hover {
            background: #444;
        }
        #${containerId} .group {
            margin-bottom: 15px;
            border-top: 1px solid #333;
            padding-top: 10px;
        }
        #${containerId} .log-area {
            width: 100%;
            height: 100px;
            background: #111;
            border: 1px solid #333;
            color: #0f0;
            padding: 5px;
            font-size: 10px;
            margin-top: 10px;
            white-space: pre-wrap;
            overflow-y: scroll;
        }
    `);

    // Create Container
    const container = document.createElement('div');
    container.id = containerId;
    container.innerHTML = `
        <h2>ShieldMonkey API Test</h2>
        <div id="sm-test-buttons"></div>
        <div class="log-area" id="sm-test-log"></div>
    `;
    document.body.appendChild(container);

    const logArea = document.getElementById('sm-test-log');
    function log(msg, type = 'info') {
        const line = document.createElement('div');
        line.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
        line.style.color = type === 'error' ? '#f55' : type === 'success' ? '#5f5' : '#ddd';
        logArea.prepend(line);
        console.log(`[SM-TEST] ${msg}`);
        
        // Also use GM_log if available
        if (typeof GM_log === 'function') GM_log(msg);
    }

    function createGroup(title) {
        const div = document.createElement('div');
        div.className = 'group';
        div.innerHTML = `<strong>${title}</strong>`;
        document.getElementById('sm-test-buttons').appendChild(div);
        return div;
    }

    function createButton(group, label, onClick) {
        const btn = document.createElement('button');
        btn.textContent = label;
        btn.onclick = async () => {
            try {
                await onClick();
            } catch (e) {
                log(`Error: ${e.message}`, 'error');
            }
        };
        group.appendChild(btn);
    }

    // --- Tests ---

    // 1. Core / Info
    const grpCore = createGroup('Core & Info');
    createButton(grpCore, 'Log GM_info', () => {
        log(JSON.stringify(GM_info, null, 2));
    });
    createButton(grpCore, 'Check unsafeWindow', () => {
        log(`unsafeWindow: ${unsafeWindow}`);
        log(`unsafeWindow === window: ${unsafeWindow === window}`);
        try {
            unsafeWindow.testProp = 123;
            log('Set unsafeWindow.testProp = 123');
        } catch(e) { log(e.message, 'error'); }
    });

    // 2. Storage
    const grpStorage = createGroup('Storage');
    createButton(grpStorage, 'GM_setValue (foo=bar)', async () => {
        await GM_setValue('foo', 'bar');
        log('Set foo=bar');
    });
    createButton(grpStorage, 'GM_getValue (foo)', async () => {
        const val = await GM_getValue('foo');
        log(`Got foo: ${val}`, val === 'bar' ? 'success' : 'info');
    });
    createButton(grpStorage, 'GM_deleteValue (foo)', async () => {
        await GM_deleteValue('foo');
        log('Deleted foo');
    });
    createButton(grpStorage, 'GM_listValues', async () => {
        const keys = await GM_listValues();
        log(`Keys: ${JSON.stringify(keys)}`);
    });
    createButton(grpStorage, 'GM_setValues (bulk)', async () => {
        await GM_setValues({a: 1, b: 2});
        log('Set a=1, b=2');
    });
    createButton(grpStorage, 'GM_getValues (a, b)', async () => {
        const vals = await GM_getValues(['a', 'b']);
        log(`Got: ${JSON.stringify(vals)}`);
    });
    
    // Listener
    let listenerId;
    createButton(grpStorage, 'Add Change Listener (foo)', () => {
        if (listenerId) return log('Listener already active', 'error');
        listenerId = GM_addValueChangeListener('foo', (k, o, n, r) => {
            log(`CHANGE: ${k} | ${o} -> ${n} | remote:${r}`, 'success');
        });
        log(`Listener added (ID: ${listenerId})`);
    });
    createButton(grpStorage, 'Remove Change Listener', () => {
        if (!listenerId) return;
        GM_removeValueChangeListener(listenerId);
        log(`Listener removed (ID: ${listenerId})`);
        listenerId = null;
    });

    // 3. Network
    const grpNet = createGroup('Network');
    createButton(grpNet, 'GM_xmlhttpRequest (GET)', () => {
        GM_xmlhttpRequest({
            method: "GET",
            url: "https://httpbin.org/get",
            onload: (res) => log(`XHR Load: ${res.status}`),
            onerror: (err) => log(`XHR Error: ${JSON.stringify(err)}`, 'error')
        });
    });
    createButton(grpNet, 'GM_download', () => {
        GM_download({
            url: "https://httpbin.org/image/png",
            name: "test_image.png",
            onload: () => log('Download complete'),
            onerror: (e) => log('Download error', 'error')
        });
        log('Triggered download...');
    });
    
    // 4. Resources
    const grpRes = createGroup('Resources');
    createButton(grpRes, 'Get Resource URL', () => {
        try {
            const url = GM_getResourceURL('testResource');
            log(`Resource URL: ${url}`);
        } catch(e) { log(e.message, 'error'); }
    });
    createButton(grpRes, 'Get Resource Text', () => {
        try {
            const txt = GM_getResourceText('testResource');
            log(`Resource Text: ${txt}`);
        } catch(e) { log(e.message, 'error'); }
    });

    // 5. Tabs & Windows
    const grpWin = createGroup('Tabs & Window');
    createButton(grpWin, 'GM_openInTab (Foreground)', () => {
        GM_openInTab('https://example.com', { active: true });
    });
    createButton(grpWin, 'GM_openInTab (Background)', () => {
        GM_openInTab('https://example.com', { active: false });
    });
    createButton(grpWin, 'window.close', () => {
        window.close();
    });
    createButton(grpWin, 'GM_notification', () => {
        GM_notification({
            text: "Hello from ShieldMonkey!",
            title: "Test Notification",
            onclick: () => log("Notification clicked")
        });
    });
    createButton(grpWin, 'GM_setClipboard', () => {
        GM_setClipboard("Copied from ShieldMonkey");
        log("Set clipboard");
    });



    // 7. Unsupported / Others
    const grpMisc = createGroup('Unsupported / Misc');
    createButton(grpMisc, 'GM_cookie.list', () => {
        if (typeof GM_cookie !== 'undefined' && GM_cookie.list) {
            GM_cookie.list({}, (cookies) => log(`Cookies: ${cookies}`));
        } else {
            log("GM_cookie not defined", 'error');
        }
    });

    // URL Change Test
    createButton(grpMisc, 'Trigger history.pushState', () => {
        history.pushState({test:1}, "Test", "#pushStateTest");
        log("Pushed state (check onurlchange)");
    });
    
    if (window.onurlchange === undefined) {
        window.onurlchange = (url) => log(`[Event] onurlchange: ${url}`, 'success');
        log("Attached window.onurlchange listener");
    }

})();
