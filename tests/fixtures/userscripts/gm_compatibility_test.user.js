// ==UserScript==
// @name         GM Compatibility Test
// @namespace    https://github.com/shieldmonkey/shieldmonkey
// @version      1.0
// @description  Tests GM API stubs and window overrides
// @author       Antigravity
// @match        <all_urls>
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_setValues
// @grant        GM_getValues
// @grant        GM_deleteValues
// @grant        GM_listValues
// @grant        GM_addValueChangeListener

// @grant        GM_download
// @grant        unsafeWindowtValue
// @grant        GM_closeTab
// @grant        window.close
// @grant        window.onurlchange
// ==/UserScript==

(function() {
    'use strict';
    const LOG_PREFIX = '[CompatTest]';
    console.log(`${LOG_PREFIX} Starting compatibility tests...`);

    // 1. GM_xmlhttpRequest
    try {
        GM_xmlhttpRequest({
            method: "GET",
            url: "https://httpbin.org/get",
            onload: function(response) {
                console.error(`${LOG_PREFIX} [FAIL] GM_xmlhttpRequest loaded data (should be blocked)!`);
            },
            onerror: function(err) {
                console.log(`${LOG_PREFIX} [PASS] GM_xmlhttpRequest blocked:`, err);
            }
        });
    } catch(e) {
        // If it throws synchronously
        console.log(`${LOG_PREFIX} [PASS] GM_xmlhttpRequest blocked (caught):`, e);
    }

    // --- 2. Storage API (Synced) ---
    try {
        const key = 'test_sync';
        const val = { a: 1, b: "hello" };
        
        // Listener test
        let listenerCalled = false;
        if (typeof GM_addValueChangeListener !== 'undefined') {
             GM_addValueChangeListener(key, (name, oldV, newV, remote) => {
                 console.log(`${LOG_PREFIX} Listener fired: ${name} = ${newV}`);
                 listenerCalled = true;
             });
        }
        
        GM_setValue(key, val);
        
        // Immediate sync read
        const retrieved = GM_getValue(key);
        console.log(`${LOG_PREFIX} Storage Retrieve:`, retrieved);
        
        if (JSON.stringify(retrieved) === JSON.stringify(val)) {
             console.log(`${LOG_PREFIX} Storage PASS`);
        } else {
             console.log(`${LOG_PREFIX} Storage FAIL: Expected ${JSON.stringify(val)}, got ${JSON.stringify(retrieved)}`);
        }
        
        setTimeout(() => {
             if (listenerCalled) console.log(`${LOG_PREFIX} Listener PASS`);
             else console.log(`${LOG_PREFIX} Listener FAIL`);
        }, 500);

        const keys = GM_listValues();
        console.log(`${LOG_PREFIX} Keys:`, keys);
        
        GM_deleteValue(key);
    } catch(e) { 
        console.error(`${LOG_PREFIX} Storage Error:`, e);
    }

    // 3. onurlchange
    window.onurlchange = function(newUrl) {
        console.log(`${LOG_PREFIX} [PASS] onurlchange fired: ${newUrl}`);
    };

    // 5. Bulk Storage
    try {
        const bulkData = { k1: 1, k2: 2 };
        if (typeof GM_setValues !== 'undefined') {
            GM_setValues(bulkData);
            const retrieved = GM_getValues(['k1', 'k2']);
            console.log(`${LOG_PREFIX} Bulk Retrieve:`, retrieved);
            
            if (retrieved.k1 === 1 && retrieved.k2 === 2) {
                console.log(`${LOG_PREFIX} Bulk Storage PASS`);
            } else {
                 console.log(`${LOG_PREFIX} Bulk Storage FAIL`, retrieved);
            }
            GM_deleteValues(['k1', 'k2']);
        }
    } catch(e) {
        console.error(`${LOG_PREFIX} Bulk Storage Error:`, e);
    }
    
    // 6. Menu & Download
    try {

        
        if (typeof GM_download !== 'undefined') {
             // Mock call, might fail if permission denied or requires user gesture, but check existence
             console.log(`${LOG_PREFIX} GM_download exists`);
             // Don't actually download to avoid prompt in test
        }
        
        if (typeof GM_getResourceText !== 'undefined') {
            // Should be stubbed
            GM_getResourceText("foo");
        }
    } catch(e) {
        console.error(`${LOG_PREFIX} Menu/Download Error:`, e);
    }

    // 7. window.close (GM_closeTab)st
    window.addEventListener('message', (event) => {
        if (event.data === 'TRIGGER_CLOSE') {
            console.log(`${LOG_PREFIX} Triggering close via message...`);
            window.close();
        }
    });

})();
