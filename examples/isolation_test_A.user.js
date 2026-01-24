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
    // Set a variable in our scope
    window.SHIELD_TEST_A = 'SecretA';
    GM_log('[Isolation A] Set window.SHIELD_TEST_A = "SecretA".');
})();
