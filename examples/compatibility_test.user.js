// ==UserScript==
// @name        Compatibility Test
// @namespace   com.stickymonkey.test
// @version     1.0
// @description Tests GM_ functions for StickyMonkey
// @match       <all_urls>
// ==/UserScript==

(function() {
    'use strict';
    
    console.log(`%c 🧪 StickyMonkey Compatibility Test `, "background: #3b82f6; color: white; padding: 4px; border-radius: 4px;");

    // Test GM_setValue / GM_getValue
    const KEY = 'test_count';
    GM_getValue(KEY).then(count => {
        const newCount = (count || 0) + 1;
        console.log(`Count: ${newCount}`);
        GM_setValue(KEY, newCount);
        
        // Show notification on first run or every 5th run
        if (newCount === 1 || newCount % 5 === 0) {
            GM_notification({
                title: 'Compatibility Test',
                text: `Script has run ${newCount} times!`,
            });
        }
    });
    
    // Add a visual indicator to the page
    const div = document.createElement('div');
    div.style.position = 'fixed';
    div.style.bottom = '10px';
    div.style.right = '10px';
    div.style.padding = '8px 12px';
    div.style.backgroundColor = '#10b981';
    div.style.color = 'white';
    div.style.borderRadius = '4px';
    div.style.zIndex = '999999';
    div.style.fontFamily = 'monospace';
    div.style.cursor = 'pointer';
    div.innerText = 'StickyMonkey Active 🐒';
    
    div.onclick = () => {
        if (confirm('Open StickyMonkey Repo?')) {
            GM_openInTab('https://github.com/toshs/stickymonkey', { active: true });
        }
    };
    
    document.body.appendChild(div);
})();
