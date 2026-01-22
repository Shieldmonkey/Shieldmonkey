import { parseMetadata } from '../utils/metadataParser';
import { GM_API_SCRIPT } from '../core/gm_api';
import { matchPattern } from '../utils/urlMatcher';

console.log("StickyMonkey Background Script Loaded");

// Calculate and update badge for a tab
async function updateBadge(tabId: number, url: string) {
  try {
    const data = await chrome.storage.local.get('scripts');
    const scripts = (data.scripts || []) as any[];

    const count = scripts.filter(script => {
      if (!script.enabled) return false;
      const metadata = parseMetadata(script.code);
      const patterns = [...metadata.match, ...metadata.include];
      const effectivePatterns = patterns.length > 0 ? patterns : ["<all_urls>"];
      return effectivePatterns.some((pattern: string) => matchPattern(pattern, url));
    }).length;

    if (count > 0) {
      await chrome.action.setBadgeText({ tabId, text: count.toString() });
      await chrome.action.setBadgeBackgroundColor({ tabId, color: '#10b981' });
    } else {
      await chrome.action.setBadgeText({ tabId, text: '' });
    }
  } catch (e) {
    console.error("Failed to update badge", e);
  }
}

// Initialize userscripts environment
chrome.runtime.onInstalled.addListener(async () => {
  console.log("StickyMonkey installed - Initializing...");

  // Enable userScripts API if available
  if (chrome.userScripts) {
    try {
      await chrome.userScripts.configureWorld({
        messaging: true,
      });
      console.log("UserScripts world configured");

      // 1. Restore saved scripts from storage
      const data = await chrome.storage.local.get('scripts');
      const savedScripts = (data.scripts || []) as any[];

      if (savedScripts.length > 0) {
        console.log(`Restoring ${savedScripts.length} scripts from storage...`);
        for (const script of savedScripts) {
          if (!script.enabled) continue;

          try {
            const metadata = parseMetadata(script.code);
            const matches = [...metadata.match, ...metadata.include];
            const excludes = metadata.exclude;
            const runAt = metadata['run-at'] || 'document_end';

            // Unregister first just in case
            try { await chrome.userScripts.unregister({ ids: [script.id] }); } catch (e) { }

            await chrome.userScripts.register([{
              id: script.id,
              matches: matches.length > 0 ? matches : ["<all_urls>"],
              excludeMatches: excludes,
              js: [{ code: GM_API_SCRIPT + "\n" + script.code }],
              runAt: runAt as any,
              world: 'USER_SCRIPT'
            }]);
            console.log(`Restored script: ${script.name}`);
          } catch (e) {
            console.error(`Failed to restore script ${script.name}:`, e);
          }
        }
      }

      // 2. Register default hello world script ONLY if no scripts exist and none were restored
      const registeredScripts = await chrome.userScripts.getScripts();
      if (registeredScripts.length === 0 && savedScripts.length === 0) {
        const testScriptId = crypto.randomUUID();
        const code = `// ==UserScript==
// @name        Compatibility Test
// @namespace   com.stickymonkey.test
// @version     1.0
// @description Tests GM_ functions for StickyMonkey
// @match       <all_urls>
// ==/UserScript==

(function() {
    'use strict';
    
    console.log(\`%c 🧪 StickyMonkey Compatibility Test \`, "background: #3b82f6; color: white; padding: 4px; border-radius: 4px;");

    // Test GM_setValue / GM_getValue
    const KEY = 'test_count';
    GM_getValue(KEY).then(count => {
        const newCount = (count || 0) + 1;
        console.log(\`Count: \${newCount}\`);
        GM_setValue(KEY, newCount);
        
        // Show notification on first run or every 5th run
        if (newCount === 1 || newCount % 5 === 0) {
            GM_notification({
                title: 'Compatibility Test',
                text: \`Script has run \${newCount} times!\`,
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
`;
        await chrome.userScripts.register([{
          id: testScriptId,
          matches: ["<all_urls>"],
          js: [{ code: GM_API_SCRIPT + "\n" + code }],
          runAt: 'document_end',
          world: 'USER_SCRIPT'
        }]);

        await chrome.storage.local.set({
          scripts: [{
            id: testScriptId,
            name: 'Compatibility Test',
            code: code,
            enabled: true
          }]
        });
      }

    } catch (err) {
      console.error("Failed to initialize user scripts:", err);
    }
  } else {
    console.error("chrome.userScripts API is not available.");
  }
});

// Tab updates for badge
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    updateBadge(tabId, tab.url);
  }
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab.url) {
      updateBadge(activeInfo.tabId, tab.url);
    }
  } catch (e) {
    console.error(e);
  }
});

// Helper to update active tab badge after script changes
async function updateActiveTabBadge() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id && tab?.url) {
    updateBadge(tab.id, tab.url);
  }
}

// Listen for messages from the Options page (Dashboard)
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  console.log("Received message:", message, _sender);
  if (message.type === 'SAVE_SCRIPT') {
    const { script } = message;
    handleSaveScript(script).then(() => sendResponse({ success: true })).catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === 'TOGGLE_SCRIPT') {
    const { scriptId, enabled } = message;
    handleToggleScript(scriptId, enabled).then(() => sendResponse({ success: true })).catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === 'DELETE_SCRIPT') {
    const { scriptId } = message;
    handleDeleteScript(scriptId).then(() => sendResponse({ success: true })).catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
});

chrome.runtime.onUserScriptMessage.addListener((message, _sender, sendResponse) => {
  console.log("Received message:", message, _sender);
  // Handle GM API requests from Injected Scripts
  if (message.type && message.type.startsWith('GM_')) {
    handleGMRequest(message.type, message.data, _sender).then(result => sendResponse({ result })).catch(err => sendResponse({ error: err.message }));
    return true;
  }
});



async function handleSaveScript(script: any) {
  if (!chrome.userScripts) throw new Error("API unavailable");

  // 1. Update in Storage
  const data = await chrome.storage.local.get('scripts');
  const scripts: any[] = Array.isArray(data.scripts) ? data.scripts : [];
  const index = scripts.findIndex((s: any) => s.id === script.id);

  if (index !== -1) {
    scripts[index] = script;
  } else {
    scripts.push(script);
  }
  await chrome.storage.local.set({ scripts });

  // 2. Parse metadata
  const metadata = parseMetadata(script.code);
  const matches = [...metadata.match, ...metadata.include];
  const excludes = metadata.exclude;
  const runAt = metadata['run-at'] || 'document_end';

  // Update script name from metadata if present
  if (metadata.name) {
    script.name = metadata.name;
    // Update in storage again with new name
    scripts[index !== -1 ? index : scripts.length - 1] = script;
    await chrome.storage.local.set({ scripts });
  }

  // 3. Register with UserScripts API (Inject GM API + User Code)
  // Ensure we unregister first to avoid duplicate ID error
  try {
    await chrome.userScripts.unregister({ ids: [script.id] });
  } catch (e) {
    // Ignore error if script was not registered
  }

  await chrome.userScripts.register([{
    id: script.id,
    matches: matches.length > 0 ? matches : ["<all_urls>"],
    excludeMatches: excludes,
    js: [{ code: GM_API_SCRIPT + "\n" + script.code }],
    runAt: runAt as any,
    world: 'USER_SCRIPT'
  }]);

  console.log(`Script ${script.name} saved and registered.`);
  await updateActiveTabBadge();
}

async function handleToggleScript(scriptId: string, enabled: boolean) {
  if (!chrome.userScripts) return;

  const data = await chrome.storage.local.get('scripts');
  const scripts: any[] = Array.isArray(data.scripts) ? data.scripts : [];
  const script = scripts.find((s: any) => s.id === scriptId);

  if (script) {
    script.enabled = enabled;
    await chrome.storage.local.set({ scripts });

    if (enabled) {
      const metadata = parseMetadata(script.code);
      const matches = [...metadata.match, ...metadata.include];
      const excludes = metadata.exclude;
      await chrome.userScripts.unregister({ ids: [script.id] });
      await chrome.userScripts.register([{
        id: script.id,
        matches: matches.length > 0 ? matches : ["<all_urls>"],
        excludeMatches: excludes,
        js: [{ code: GM_API_SCRIPT + "\n" + script.code }],
        world: 'USER_SCRIPT'
      }]);
    } else {
      await chrome.userScripts.unregister({ ids: [scriptId] });
    }
    await updateActiveTabBadge();
  }
}

async function handleDeleteScript(scriptId: string) {
  if (!chrome.userScripts) return;

  const data = await chrome.storage.local.get('scripts');
  const scripts: any[] = Array.isArray(data.scripts) ? data.scripts : [];
  const newScripts = scripts.filter((s: any) => s.id !== scriptId);
  await chrome.storage.local.set({ scripts: newScripts });

  await chrome.userScripts.unregister({ ids: [scriptId] });
  await updateActiveTabBadge();
}

// GM API Handlers
async function handleGMRequest(type: string, data: any, _sender: chrome.runtime.MessageSender) {
  // console.log("GM Request:", type, data);

  // In a real implementation, we would key storage by script ID or namespace
  // Since message sender in USER_SCRIPT world might not have strict ID isolation easily without more work, 
  // we simply use global storage for now as a POC.
  // Ideally we identify the script ID from the sender if possible or passed in data.

  switch (type) {
    case 'GM_setValue':
      await chrome.storage.local.set({ [`store_${data.key}`]: data.value });
      return null;
    case 'GM_getValue':
      const res = await chrome.storage.local.get(`store_${data.key}`);
      return res[`store_${data.key}`];
    case 'GM_deleteValue':
      await chrome.storage.local.remove(`store_${data.key}`);
      return null;
    case 'GM_listValues':
      const all = await chrome.storage.local.get(null);
      return Object.keys(all).filter(k => k.startsWith('store_')).map(k => k.replace('store_', ''));
    case 'GM_notification':
      if (chrome.notifications) {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: data.image || '/icons/icon48.png',
          title: data.title || 'StickyMonkey',
          message: data.text
        });
      } else {
        console.warn("StickyMonkey: chrome.notifications API not available. Check permissions.");
      }
      return null;
    case 'GM_openInTab':
      if (chrome.tabs) {
        // options.active defaults to true if not specified
        const active = data.options?.active !== undefined ? data.options.active : true;
        await chrome.tabs.create({ url: data.url, active: active });
      } else {
        console.warn("StickyMonkey: chrome.tabs API not available. Check permissions.");
      }
      return null;
  }
  return null;
}

