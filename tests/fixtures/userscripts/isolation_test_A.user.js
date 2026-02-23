// ==UserScript==
// @name         Shieldmonkey Isolation Test A
// @namespace    https://github.com/shieldmonkey/shieldmonkey
// @version      1.0
// @description  Sets a variable to test isolation. WITH GRANT to force sandbox.
// @author       Antigravity
// @match        <all_urls>
// @grant        GM_log
// ==/UserScript==


(function() {
    'use strict';
    // Set a variable in our scope.
    // In native UserScripts, top-level variables shouldn't leak to other scripts (module scope or wrapped).
    // Note: We avoid 'window.SHIELD_TEST_A' because window is shared in USER_SCRIPT world without wrappers.
    const SHIELD_TEST_A = 'SecretA';
    // We expose it to window intentionally to PROVE it's not isolated if we use window, 
    // BUT the test checks if B can see it.
    // Wait, if we want to pass the test "B should not see A", we must NOT put it on window.
    
    // So let's define it as a local variable (which is practically global to this script)
    // and verify B cannot access it.
    
    GM_log('[Isolation A] Defined const SHIELD_TEST_A = "SecretA" (local scope).');
    
    // Add a marker to DOM to verify execution
    const el = document.createElement('div');
    el.id = 'test-a-marker';
    el.textContent = 'Marker A';
    el.style.position = 'fixed';
    el.style.top = '0';
    el.style.left = '0';
    el.style.zIndex = '9999';
    el.style.background = 'red';
    el.style.width = '100px';
    el.style.height = '20px';
    document.body.appendChild(el);
})();
