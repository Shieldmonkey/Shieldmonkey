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
        // Try to access SHIELD_TEST_A from Script A
        // If isolation works (scope isolation), this reference should fail or be undefined.
        // However, referencing an undefined variable throws ReferenceError.
        
        let leaked = false;
        try {
            // direct access
            // @ts-ignore
            if (typeof SHIELD_TEST_A !== 'undefined') {
                leaked = true;
            }
        } catch(e) {
            // ReferenceError means it's not defined, which is GOOD.
        }

        // Also check window just in case (though A doesn't put it there anymore)
        if (window.SHIELD_TEST_A) {
             // This would mean A puts it on window, which implies NO isolation of window.
             // But we changed A to not do that.
        }

        if (leaked) {
            GM_log('[Isolation B] FAIL: I can see SHIELD_TEST_A from Script A!');
        } else {
            GM_log('[Isolation B] SUCCESS: I cannot see window.SHIELD_TEST_A from Script A.');
        }

        const el = document.createElement('div');
        el.id = 'test-b-marker';
        el.textContent = 'Marker B';
        el.style.position = 'fixed';
        el.style.top = '50px';
        el.style.left = '0';
        el.style.zIndex = '9999';
        el.style.background = 'blue';
        el.style.width = '100px';
        el.style.height = '20px';
        document.body.appendChild(el);
    }, 500);
})();
