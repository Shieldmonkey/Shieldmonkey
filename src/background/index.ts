import { parseMetadata } from '../utils/metadataParser';
import { getGMAPIScript } from '../core/gm_api';
import { matchPattern } from '../utils/urlMatcher';

console.log("Shieldmonkey Background Script Loaded");

interface Script {
  id: string;
  name: string;
  code: string;
  enabled?: boolean;
  grantedPermissions?: string[];
  [key: string]: unknown;
}

// Calculate and update badge for a tab
async function updateBadge(tabId: number, url: string) {
  try {
    const data = await chrome.storage.local.get('scripts');
    const scripts = (data.scripts || []) as Script[];

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

import { performBackup } from '../utils/backupManager';

// ... (existing imports)

// Initialize userscripts environment
chrome.runtime.onInstalled.addListener(async () => {
  console.log("Shieldmonkey installed - Initializing...");

  // Setup Backup Alarm (every 60 minutes)
  chrome.alarms.create('backup-alarm', { periodInMinutes: 60 });

  await reloadAllScripts();
});

// Reusable function to reload/register all scripts from storage
async function reloadAllScripts() {
  // Enable userScripts API if available
  if (chrome.userScripts) {
    try {
      await chrome.userScripts.configureWorld({
        messaging: true,
      });
      console.log("UserScripts world configured");

      // Check global enabled state
      const settings = await chrome.storage.local.get(['extensionEnabled', 'scripts']);
      const extensionEnabled = settings.extensionEnabled !== false; // Default true
      const savedScripts = (settings.scripts || []) as Script[];

      if (settings.extensionEnabled === undefined) {
        await chrome.storage.local.set({ extensionEnabled: true });
      }

      // Clear existing registrations first? 
      // unregistering undefined unregisters all?
      // Or we can unregister all explicitly.
      // But we don't have IDs easily unless we stored them.
      // Actually we can getScripts() to find registered IDs.
      try {
        const existing = await chrome.userScripts.getScripts();
        const ids = existing.map(s => s.id);
        if (ids.length > 0) {
          await chrome.userScripts.unregister({ ids });
        }
      } catch (e) {
        console.warn("Failed to unregister existing scripts", e);
      }

      if (extensionEnabled && savedScripts.length > 0) {
        console.log(`Loading ${savedScripts.length} scripts from storage...`);
        for (const script of savedScripts) {
          if (!script.enabled) continue;

          try {
            const metadata = parseMetadata(script.code);
            const matches = [...metadata.match, ...metadata.include];
            const excludes = metadata.exclude;
            const runAt = metadata['run-at'] || 'document_end';
            const granted = script.grantedPermissions || [];

            await chrome.userScripts.register([{
              id: script.id,
              matches: matches.length > 0 ? matches : ["<all_urls>"],
              excludeMatches: excludes,
              js: [{
                code: getGMAPIScript({
                  id: script.id,
                  name: script.name,
                  version: metadata.version || '1.0',
                  permissions: granted,
                  namespace: metadata.namespace,
                  description: metadata.description
                }) + "\n" + script.code
              }],
              runAt: runAt as 'document_start' | 'document_end' | 'document_idle',
              world: 'USER_SCRIPT'
            }]);
            console.log(`Registered script: ${script.name}`);
          } catch (e) {
            console.error(`Failed to register script ${script.name}:`, e);
          }
        }
      } else if (!extensionEnabled) {
        console.log("Extension is disabled globally. Skipping script registration.");
      }

    } catch (err) {
      console.error("Failed to initialize user scripts:", err);
    }
  } else {
    console.error("chrome.userScripts API is not available.");
  }

  await updateActiveTabBadge();
}

// Set to track tabs that should bypass the .user.js redirect
// Detect navigation to .user.js files and redirect to installer
// Track pending script installations: tabId -> scriptUrl
const pendingInstallations = new Map<number, string>();

// Detect navigation to .user.js files and redirect to loader page
chrome.webNavigation.onBeforeNavigate.addListener((details) => {
  if (details.frameId === 0 && details.url && /\.user\.js([?#].*)?$/i.test(details.url)) {
    console.log("Detected .user.js navigation:", details.url);

    // For file:// URLs, we must avoid the external loader (security restriction).
    // Redirect directly to the install page. The user MUST allow file access in extension settings.
    if (details.url.startsWith('file:')) {
      const installUrl = chrome.runtime.getURL('src/install/index.html') + `?url=${encodeURIComponent(details.url)}`;
      chrome.tabs.update(details.tabId, { url: installUrl });
    } else {
      // For http/https, use the safe trampoline to prompt/fetch content
      pendingInstallations.set(details.tabId, details.url);
      chrome.tabs.update(details.tabId, { url: 'https://shieldmonkey.github.io/' });
    }
  }
});

// Helper to fetch script content directly from background (used by Install page and others via Message)
async function fetchScriptContent(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }
  return response.text();
}

// Tab updates for badge
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Check if this is a pending installation tab that has finished loading the loader page
  if (changeInfo.status === 'complete' && pendingInstallations.has(tabId) && tab.url?.startsWith('https://shieldmonkey.github.io/')) {
    const targetUrl = pendingInstallations.get(tabId);
    // Remove from pending map shortly after injection? 
    // No, keep it until we redirect? Actually we can remove it now or let the script handle redirect.
    // If we remove it now, subsequent reloads might fail if they stay on about:blank? 
    // They will just show blank page. That's acceptable.
    pendingInstallations.delete(tabId);

    if (!targetUrl) return;

    chrome.scripting.executeScript({
      target: { tabId },
      func: (url: string, installPageUrl: string) => {
        // UI Construction in clean about:blank
        document.body.style.fontFamily = 'system-ui, sans-serif';
        document.body.style.display = 'flex';
        document.body.style.flexDirection = 'column';
        document.body.style.justifyContent = 'center';
        document.body.style.alignItems = 'center';
        document.body.style.height = '100vh';
        document.body.style.background = '#222';
        document.body.style.color = '#fff';
        document.body.style.margin = '0';

        const loader = document.createElement('div');
        loader.style.border = '4px solid #333';
        loader.style.borderTop = '4px solid #10b981';
        loader.style.borderRadius = '50%';
        loader.style.width = '40px';
        loader.style.height = '40px';
        loader.style.marginRight = '15px';

        // Simple CSS animation via style injection
        const style = document.createElement('style');
        style.textContent = `
          @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        `;
        document.head.appendChild(style);
        loader.style.animation = 'spin 1s linear infinite';

        const text = document.createElement('div');
        text.textContent = 'Fetching script...';

        const container = document.createElement('div');
        container.style.display = 'flex';
        container.style.alignItems = 'center';

        container.appendChild(loader);
        container.appendChild(text);
        document.body.appendChild(container);

        // Fetch script directly from the loader page context
        // Fetch script directly from the loader page context
        fetch(url)
          .then(res => {
            if (!res.ok) throw new Error("HTTP " + res.status);
            return res.text();
          })
          .then(text => {
            window.name = JSON.stringify({ type: 'SHIELDMONKEY_INSTALL_DATA', url: url, source: text });
            // Request navigation via background to avoid blocking
            chrome.runtime.sendMessage({ type: 'OPEN_INSTALL_PAGE', url: installPageUrl });
          })
          .catch(err => {
            text.textContent = 'Error: ' + (err.message || 'Unknown error');
            text.style.color = '#ef4444';
          });
      },
      args: [targetUrl, chrome.runtime.getURL('src/install/index.html')],
    });
  }

  // Helper handling for badge
  if (changeInfo.status === 'complete' && tab.url && tab.url !== 'about:blank') {
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

async function handleToggleGlobal(enabled: boolean) {
  await chrome.storage.local.set({ extensionEnabled: enabled });
  console.log("Global enabled state changed to:", enabled);
  await reloadAllScripts();
}

async function handleSaveScript(script: Script) {
  if (!chrome.userScripts) throw new Error("API unavailable");

  // 1. Update in Storage
  const data = await chrome.storage.local.get('scripts');
  const scripts: Script[] = Array.isArray(data.scripts) ? data.scripts : [];
  const index = scripts.findIndex((s) => s.id === script.id);

  // Preserve permissions if not passed (though they should be passed from UI)
  if (index !== -1 && !script.grantedPermissions) {
    script.grantedPermissions = scripts[index].grantedPermissions || [];
  }

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
  }
  if (metadata.namespace) {
    script.namespace = metadata.namespace;
  }

  // Update in storage again with new name/namespace
  // Use the calculated index or find it again if it was a push
  const newIndex = index !== -1 ? index : scripts.length - 1;
  scripts[newIndex] = script;
  await chrome.storage.local.set({ scripts });

  // 3. Register with UserScripts API (Inject GM API + User Code)
  // Ensure we unregister first to avoid duplicate ID error
  try {
    await chrome.userScripts.unregister({ ids: [script.id] });
  } catch {
    // Ignore error if script was not registered
  }

  if (script.enabled) {
    await chrome.userScripts.register([{
      id: script.id,
      matches: matches.length > 0 ? matches : ["<all_urls>"],
      excludeMatches: excludes,
      js: [{
        code: getGMAPIScript({
          id: script.id,
          name: script.name,
          version: metadata.version || '1.0',
          permissions: script.grantedPermissions || [],
          namespace: metadata.namespace,
          description: metadata.description
        }) + "\n" + script.code
      }],
      runAt: runAt as 'document_start' | 'document_end' | 'document_idle',
      world: 'USER_SCRIPT'
    }]);
  }

  console.log(`Script ${script.name} saved and registered.`);
  await updateActiveTabBadge();
}

async function handleToggleScript(scriptId: string, enabled: boolean) {
  if (!chrome.userScripts) return;

  const data = await chrome.storage.local.get('scripts');
  const scripts: Script[] = Array.isArray(data.scripts) ? data.scripts : [];
  const script = scripts.find((s) => s.id === scriptId);

  if (script) {
    script.enabled = enabled;
    await chrome.storage.local.set({ scripts });

    if (enabled) {
      const metadata = parseMetadata(script.code);
      const matches = [...metadata.match, ...metadata.include];
      const excludes = metadata.exclude;
      const granted = script.grantedPermissions || [];

      await chrome.userScripts.unregister({ ids: [script.id] });
      await chrome.userScripts.register([{
        id: script.id,
        matches: matches.length > 0 ? matches : ["<all_urls>"],
        excludeMatches: excludes,
        js: [{
          code: getGMAPIScript({
            id: script.id,
            name: script.name,
            version: metadata.version || '1.0',
            permissions: granted,
            namespace: metadata.namespace,
            description: metadata.description
          }) + "\n" + script.code
        }],
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
  const scripts: Script[] = Array.isArray(data.scripts) ? data.scripts : [];
  const newScripts = scripts.filter((s) => s.id !== scriptId);
  await chrome.storage.local.set({ scripts: newScripts });

  await chrome.userScripts.unregister({ ids: [scriptId] });
  await updateActiveTabBadge();
}

// Listen for messages from the Options page (Dashboard)
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  console.log("Received message:", message, _sender);
  if (message.type === 'SAVE_SCRIPT') {
    const { script } = message;
    handleSaveScript(script).then(() => sendResponse({ success: true })).catch((err: any) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === 'TOGGLE_SCRIPT') {
    const { scriptId, enabled } = message;
    handleToggleScript(scriptId, enabled).then(() => sendResponse({ success: true })).catch((err: any) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === 'TOGGLE_GLOBAL') {
    const { enabled } = message;
    handleToggleGlobal(enabled).then(() => sendResponse({ success: true })).catch((err: any) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === 'DELETE_SCRIPT') {
    const { scriptId } = message;
    handleDeleteScript(scriptId).then(() => sendResponse({ success: true })).catch((err: any) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === 'FETCH_SCRIPT_CONTENT') {
    const { url } = message;
    fetchScriptContent(url)
      .then(text => sendResponse({ success: true, text }))
      .catch((err: any) => sendResponse({ success: false, error: err.toString() }));
    return true; // Keep channel open
  }

  if (message.type === 'OPEN_INSTALL_PAGE') {
    if (_sender.tab && _sender.tab.id) {
      chrome.tabs.update(_sender.tab.id, { url: message.url });
    }
    return true;
  }

  if (message.type === 'START_INSTALL_FLOW') {
    const { url } = message;

    if (url.startsWith('file:')) {
      // For file://, open install page directly
      const installUrl = chrome.runtime.getURL('src/install/index.html') + `?url=${encodeURIComponent(url)}`;
      chrome.tabs.create({ url: installUrl });
    } else {
      // For web URLs, use the trampoline
      chrome.tabs.create({ url: 'https://shieldmonkey.github.io/' }).then(tab => {
        if (tab.id) {
          pendingInstallations.set(tab.id, url);
        }
      });
    }
    return true;
  }

  if (message.type === 'RELOAD_SCRIPTS') {
    reloadAllScripts().then(() => sendResponse({ success: true }));
    return true;
  }
});

chrome.runtime.onUserScriptMessage.addListener((message, _sender, sendResponse) => {
  console.log("Received message:", message, _sender);
  // Handle GM API requests from Injected Scripts
  if (message.type && message.type.startsWith('GM_')) {
    handleGMRequest(message.type, message.data, _sender, message.scriptId)
      .then(result => sendResponse({ result }))
      .catch(err => sendResponse({ error: err.message }));
    return true;
  }
});

// GM API Handlers
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleGMRequest(type: string, data: any, _sender: chrome.runtime.MessageSender, scriptId?: string) {
  console.log("GM Request:", type, data, _sender, scriptId);
  const origin = _sender.origin;

  // Verify permissions
  if (!scriptId) {
    console.error("GM Request received without scriptId. Access denied.");
    throw new Error("Access denied: Missing scriptId");
  }

  const db = await chrome.storage.local.get('scripts');
  const scripts = (db.scripts || []) as Script[];
  const script = scripts.find((s) => s.id === scriptId);

  if (!script) {
    throw new Error("Script not found");
  }

  const permissions = new Set(script.grantedPermissions || []);
  const apiName = type;

  // Exceptions that don't need permission or are internal
  if (apiName !== 'GM_xhrAbort' && !permissions.has(apiName)) {
    // Also check dot notation if applicable e.g. GM.setValue
    const dotName = apiName.replace('_', '.');
    if (!permissions.has(dotName)) {
      console.warn(`Script ${script.name} attempted to use ${apiName} without permission.`);
      throw new Error(`Permission denied: ${apiName}`);
    }
  }


  switch (type) {
    case 'GM_setValue':
      await chrome.storage.local.set({ [`val_${scriptId}_${origin}_${data.key}`]: data.value });
      return null;
    case 'GM_getValue':
      {
        const key = `val_${scriptId}_${origin}_${data.key}`;
        const res = await chrome.storage.local.get(key);
        return res[key];
      }
    case 'GM_deleteValue':
      await chrome.storage.local.remove(`val_${scriptId}_${origin}_${data.key}`);
      return null;
    case 'GM_listValues':
      {
        const all = await chrome.storage.local.get(null);
        const prefix = `val_${scriptId}_${origin}_`;
        return Object.keys(all).filter(k => k.startsWith(prefix)).map(k => k.slice(prefix.length));
      }
    case 'GM_notification':
      if (chrome.notifications) {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: data.image || '/icons/icon48.png',
          title: data.title || 'Shieldmonkey',
          message: data.text
        });
      }
      return null;
    case 'GM_openInTab':
      if (chrome.tabs) {
        const active = data.options?.active !== undefined ? data.options.active : true;
        await chrome.tabs.create({ url: data.url, active: active });
      }
      return null;
    case 'GM_xmlhttpRequest':
      try {
        const DETAILS = data.details;

        // Check @connect permissions
        const metadata = parseMetadata(script.code);
        const connectRules = metadata.connect || [];

        // Always allow if no rule? No, usually deny by default for security if not specified, 
        // but TM allows same-origin without connect?
        // Let's implement strict check based on connect rules.

        const targetUrl = new URL(DETAILS.url);
        const targetDomain = targetUrl.hostname;

        // 1. Allow if matched by any @connect rule
        const isAllowed = connectRules.some(rule => {
          if (rule === '*') return true;
          if (rule === 'self') return targetUrl.origin === origin;
          if (rule === 'localhost') return targetDomain === 'localhost' || targetDomain === '127.0.0.1';

          // Domain matching (e.g. "google.com" matches "google.com" and "www.google.com"?)
          // Usually strict on subdomains unless *.
          // Simple includes check for now or strict match?
          // "google.com" -> exact match or subdomain?
          // "www.google.com" -> exact match
          // "*.google.com" -> subdomains

          // Normalize rule
          if (rule.includes('*')) {
            // simple glob conversion
            const regex = new RegExp('^' + rule.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$');
            return regex.test(targetDomain);
          }

          return targetDomain === rule || targetDomain.endsWith('.' + rule);
        });

        if (!isAllowed && connectRules.length > 0) {
          console.warn(`GM_xmlhttpRequest blocked: ${DETAILS.url} not in @connect rules.`);
          throw new Error(`Permission denied: ${DETAILS.url} is not allowed by @connect.`);
        }
        // If connectRules is empty, maybe allow nothing? or depend on some default?
        // For now, if connect is provided, we enforce it. If NOT provided, we might allow everything (legacy) or block?
        // TM blocks if not specified. Let's start with warning or simple logic:
        // IF @connect exists, whitelist mode.
        // IF NO @connect, maybe only allow same origin?
        if (connectRules.length === 0) {
          // Fallback: Allow if same origin as the page
          if (targetUrl.origin !== origin) {
            // Or allow if permissions explicitly contain <all_urls> or *://*/* in matches?
            // No, matches controls WHERE script runs. connect controls WHAT it connects to.
            console.warn(`GM_xmlhttpRequest blocked: No @connect rules specified, and cross-origin request to ${DETAILS.url}.`);
            throw new Error("Permission denied: No @connect rules specified.");
          }
        }

        const response = await fetch(DETAILS.url, {
          method: DETAILS.method || 'GET',
          headers: DETAILS.headers,
          body: DETAILS.data
        });
        const text = await response.text();
        // Convert headers to string (simplification)
        const responseHeaders = Array.from(response.headers.entries()).map(([k, v]) => `${k}: ${v}`).join('\r\n');

        return {
          response: text, // for responseType text
          responseText: text,
          status: response.status,
          statusText: response.statusText,
          responseHeaders: responseHeaders,
          finalUrl: response.url
        };
      } catch (e) {
        throw new Error((e as Error).message || "Network Error");
      }
    case 'GM_registerMenuCommand':
      // Basic implementation using contextMenus
      // Note: This adds a menu item for every registered command. 
      // Context menu items persist, so we might need logic to clean them up or manage IDs better.
      // For now, using a simple ID generation based on scriptId and caption.
      if (chrome.contextMenus) {
        const menuId = `cmd_${scriptId}_${data.caption.replace(/[^a-zA-Z0-9]/g, '_')}`;
        // Create context menu item only if not exists (or update)
        // Since we can't easily check existence efficiently without callback error, just try create.
        // To handle click, we need a global listener, which is tricky inside this request handler.
        // Ideally, we should register a global listener ONCE and dispatch messages.
        // For this immediate step, we just create the UI item.
        // TODO: Implement the click handler logic in the main background scope.
        chrome.contextMenus.create({
          id: menuId,
          title: data.caption,
          contexts: ["page", "selection", "link"],
          parentId: "user-scripts-menu" // Assuming we create a parent menu for the extension
        }, () => {
          if (chrome.runtime.lastError) {
            // Suppress error if duplicate
          }
        });
      }
      return null;
  }
  return null;
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'backup-alarm') {
    performBackup().then(count => {
      console.log(`Auto-backup completed. Saved ${count} scripts.`);
      chrome.storage.local.set({ lastBackupTime: new Date().toISOString() });
    }).catch(err => {
      console.error("Auto-backup failed:", err);
      // Error is also logged in backupManager with notification
    });
  }
});

chrome.notifications.onClicked.addListener((notificationId) => {
  if (notificationId) {
    // Open options page to hash #settings
    chrome.runtime.openOptionsPage();
    // Or if we specifically want #settings:
    // chrome.tabs.create({ url: 'src/options/index.html#settings' });
  }
});
