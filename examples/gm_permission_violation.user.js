// ==UserScript==
// @name         Shieldmonkey Permission Violation Test
// @namespace    https://github.com/shieldmonkey/shieldmonkey
// @version      1.0
// @description  Tries to use APIs without permission and access restricted runtime
// @author       Antigravity
// @match        <all_urls>
// @grant        GM_log
// ==/UserScript==

(function() {
    'use strict';
    
    const LOG_PREFIX = '[ViolationTest]';
    // ID generated in dev mode for this file
    // src/background/index.ts: dev-example-${filename...}
    const SCRIPT_ID = 'dev-example-gm-permission-violation';

    console.log(`${LOG_PREFIX} Starting violation tests...`);
    
    // Test 1: Try to use GM_xmlhttpRequest directly (Should be undefined)
    if (typeof GM_xmlhttpRequest === 'undefined') {
         console.log(`${LOG_PREFIX} [PASS] GM_xmlhttpRequest is undefined.`);
    } else {
         console.error(`${LOG_PREFIX} [FAIL] GM_xmlhttpRequest IS DEFINED! Sandbox leak?`);
    }

    // Test 2: Try to bypass sandbox using chrome.runtime.sendMessage
    // We attempt to call GM_xmlhttpRequest manually via the background messaging channel.
    // Since this script does NOT have @grant GM_xmlhttpRequest, the background should deny it.
    
    // Find the runtime object (UserScripts might have access to a shimmed or real runtime)
    // In Shieldmonkey, we enable messaging: true, so chrome.runtime should be available in the USER_SCRIPT world.
    const runtime = (typeof chrome !== 'undefined' && chrome.runtime) ? chrome.runtime : 
                    (typeof browser !== 'undefined' && browser.runtime) ? browser.runtime : null;

    if (runtime && runtime.sendMessage) {
        console.log(`${LOG_PREFIX} chrome.runtime.sendMessage found. Attempting privilege escalation...`);
        
        const payload = {
            type: 'GM_xmlhttpRequest',
            scriptId: SCRIPT_ID,
            data: {
                details: {
                    method: 'GET',
                    url: 'https://httpbin.org/get'
                }
            }
        };

        runtime.sendMessage(payload, (response) => {
            if (chrome.runtime.lastError) {
                console.log(`${LOG_PREFIX} [PASS?] Runtime Error:`, chrome.runtime.lastError.message);
                return;
            }
            
            if (response && response.error) {
                console.log(`${LOG_PREFIX} [PASS] Background denied request:`, response.error);
            } else if (response && response.result) {
                console.error(`${LOG_PREFIX} [FAIL] ESCALATION SUCCESSFUL! Request executed:`, response.result);
                alert('CRITICAL: Shieldmonkey Permission Escalation Vulnerability Found!');
            } else {
                console.log(`${LOG_PREFIX} [?] Unknown response:`, response);
            }
        });
    } else {
        console.log(`${LOG_PREFIX} chrome.runtime.sendMessage NOT available (Messaging disabled?).`);
    }

})();
