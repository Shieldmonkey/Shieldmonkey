// ==UserScript==
// @name         Shieldmonkey Isolation Test B
// @namespace    https://github.com/shieldmonkey/shieldmonkey
// @version      1.0
// @description  Checks if it can see variables from Test A. WITH GRANT.
// @author       Antigravity
// @match        <all_urls>
// @grant        GM_log
// ==/UserScript==

(function() {
    'use strict';
    
    // Slight delay to ensure A runs if loaded together
    setTimeout(() => {
        if (window.SHIELD_TEST_A) {
            GM_log('[Isolation B] FAIL: I can see window.SHIELD_TEST_A from Script A!');
        } else {
            GM_log('[Isolation B] SUCCESS: I cannot see window.SHIELD_TEST_A from Script A.');
        }
    }, 500);
})();
