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
  console.log("Environment Debug:", {
    DEV: import.meta.env.DEV,
    MODE: import.meta.env.MODE,
    __DEV__: typeof __DEV__ !== 'undefined' ? __DEV__ : 'undefined'
  });

  // Setup Backup Alarm
  setupBackupAlarm();

  // In Development mode, preload example scripts
  // In Development mode, preload example scripts
  // Use explicit __DEV__ global (defined in vite config) to ensure correct mode detection
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.log("Development mode detected (__DEV__ is true). Loading example scripts...");
    const examples = [
      'gm_api_test.user.js',
      'gm_permission_violation.user.js',
      'isolation_test_A.user.js',
      'isolation_test_B.user.js',
      'compatibility_test.user.js'
    ];

    for (const filename of examples) {
      try {
        const url = chrome.runtime.getURL(`examples/${filename}`);
        console.log(`Fetching example from: ${url}`);
        const code = await fetchScriptContent(url);
        const id = `dev-example-${filename.replace('.user.js', '').replace(/[^a-z0-9]/g, '-')}`;

        await handleSaveScript({
          id,
          name: filename, // will be overwritten by metadata
          code,
          enabled: true
        });
        console.log(`Loaded example script: ${filename}`);
      } catch (e) {
        console.warn(`Failed to load example script ${filename}:`, e);
      }
    }
  }

  await reloadAllScripts();
  await checkUserScriptsPermission();
});

chrome.runtime.onStartup.addListener(() => {
  checkUserScriptsPermission();
});

// Check if userScripts permission is available, if not open help page
// Check if userScripts permission is available, if not open help page
async function checkUserScriptsPermission() {
  if (!chrome.userScripts) {
    console.warn("chrome.userScripts is undefined. Prompting user to enable permissions.");
    // Open Options page with hash
    chrome.runtime.openOptionsPage();
    // Wait a brief moment to ensure options page is open then try to update tab or if unique...
    // simpler: check if options page is open?
    // chrome.runtime.openOptionsPage() will focus it if open.
    // BUT we want to ensure it navigates to #permission-help.

    // We can't easily pass args to openOptionsPage to change hash if already open.
    // Instead we find the exact URL.
    const optionsUrl = chrome.runtime.getURL('src/options/index.html');
    const helpUrl = optionsUrl + '#permission-help';

    const tabs = await chrome.tabs.query({ url: optionsUrl + '*' });
    if (tabs.length > 0) {
      const tab = tabs[0];
      if (tab.id) {
        chrome.tabs.update(tab.id, { url: helpUrl, active: true });
      }
    } else {
      chrome.tabs.create({ url: helpUrl });
    }
  }
}

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

// Detect navigation to .user.js files and redirect to loader page
// Detect navigation to .user.js files
// Instead of redirecting to the install page immediately, we:
// 1. Stop the navigation (window.stop()) to keep the user on the current page (with cookies/session)
// 2. Fetch the script content from the current page context
// 3. Send the content to the background to open the install page
chrome.webNavigation.onBeforeNavigate.addListener((details) => {
  if (details.frameId === 0 && details.url && /\.user\.js([?#].*)?$/i.test(details.url)) {
    console.log("Detected .user.js navigation:", details.url);

    chrome.scripting.executeScript({
      target: { tabId: details.tabId },
      func: async (scriptUrl: string) => {
        // Stop the pending navigation
        window.stop();
        console.log("Shieldmonkey: Navigation intercepted. Fetching script...", scriptUrl);

        try {
          const response = await fetch(scriptUrl);
          if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
          const content = await response.text();

          chrome.runtime.sendMessage({
            type: "INSTALL_SCRIPT_WITH_CONTENT",
            url: scriptUrl,
            content: content
          });
        } catch (err) {
          console.error("Shieldmonkey: Failed to fetch script:", err);
          chrome.runtime.sendMessage({
            type: "INSTALL_SCRIPT_FETCH_FAILED",
            url: scriptUrl,
            error: err instanceof Error ? err.message : String(err)
          });
        }
      },
      args: [details.url]
    }).catch((err) => {
      console.warn("Shieldmonkey: Failed to inject interception script (probably restricted page). Fallback to redirect.", err);
      // Fallback: Redirect to install page if we can't inject script (e.g. chrome:// pages or restricted domains)
      const installUrl = chrome.runtime.getURL('src/options/index.html') + `#/install?url=${encodeURIComponent(details.url)}`;
      chrome.tabs.update(details.tabId, { url: installUrl });
    });
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

// Handle messages from Content Script (INSTALL_SCRIPT_WITH_CONTENT)
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'INSTALL_SCRIPT_WITH_CONTENT') {
    const { url, content } = message;
    const installId = crypto.randomUUID();
    const key = `pending_install_${installId}`;

    // Store content temporarily
    chrome.storage.local.set({ [key]: { url, content } }).then(() => {
      const installUrl = chrome.runtime.getURL(`src/options/index.html#/install?installId=${installId}`);
      chrome.tabs.create({ url: installUrl });
    });
    return; // No response needed
  }

  if (message.type === 'INSTALL_SCRIPT_FETCH_FAILED') {
    const { url, error } = message;
    console.warn(`Content script failed to fetch ${url}: ${error}. Falling back to background fetch.`);

    // Fallback: Open install page with URL only, let it request background fetch
    const installUrl = chrome.runtime.getURL(`src/options/index.html#/install?url=${encodeURIComponent(url)}`);
    chrome.tabs.create({ url: installUrl });
    return;
  }
});

// Tab updates for badge
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
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

  // Update permissions from metadata
  if (metadata.grant && Array.isArray(metadata.grant)) {
    script.grantedPermissions = metadata.grant;
  }

  // Update in storage again with new name/namespace
  // Enforce uniqueness of name + namespace pair
  let uniqueName = script.name;
  let counter = 1;
  while (true) {
    const conflict = scripts.find((s) =>
      s.id !== script.id &&
      s.name === uniqueName &&
      (s.namespace || '') === (script.namespace || '')
    );
    if (!conflict) break;
    uniqueName = `${script.name} (${counter})`;
    counter++;
  }
  script.name = uniqueName;

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
    handleSaveScript(script).then(() => sendResponse({ success: true })).catch((err: unknown) => sendResponse({ success: false, error: err instanceof Error ? err.message : String(err) }));
    return true;
  }

  if (message.type === 'TOGGLE_SCRIPT') {
    const { scriptId, enabled } = message;
    handleToggleScript(scriptId, enabled).then(() => sendResponse({ success: true })).catch((err: unknown) => sendResponse({ success: false, error: err instanceof Error ? err.message : String(err) }));
    return true;
  }

  if (message.type === 'TOGGLE_GLOBAL') {
    const { enabled } = message;
    handleToggleGlobal(enabled).then(() => sendResponse({ success: true })).catch((err: unknown) => sendResponse({ success: false, error: err instanceof Error ? err.message : String(err) }));
    return true;
  }

  if (message.type === 'DELETE_SCRIPT') {
    const { scriptId } = message;
    handleDeleteScript(scriptId).then(() => sendResponse({ success: true })).catch((err: unknown) => sendResponse({ success: false, error: err instanceof Error ? err.message : String(err) }));
    return true;
  }

  if (message.type === 'FETCH_SCRIPT_CONTENT') {
    const { url } = message;
    fetchScriptContent(url)
      .then(text => sendResponse({ success: true, text }))
      .catch((err: unknown) => sendResponse({ success: false, error: err instanceof Error ? err.message : String(err) }));
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
    const installUrl = chrome.runtime.getURL('src/options/index.html') + `#/install?url=${encodeURIComponent(url)}`;
    chrome.tabs.create({ url: installUrl });
    return true;
  }

  if (message.type === 'RELOAD_SCRIPTS') {
    reloadAllScripts().then(() => sendResponse({ success: true }));
    return true;
  }
});

chrome.runtime.onUserScriptMessage.addListener((message, _sender, sendResponse) => {
  console.log("Shieldmonkey: Received UserScript Message:", message, "Sender:", _sender);

  if (!message || !message.type) {
    console.warn("Shieldmonkey: Invalid message format");
    return;
  }

  // Handle GM API requests from Injected Scripts
  if (message.type && message.type.startsWith('GM_')) {
    handleGMRequest(message.type, message.data, _sender, message.scriptId)
      .then(result => {
        // console.log("Shieldmonkey: GM Request Success", result);
        sendResponse({ result });
      })
      .catch(err => {
        console.error("Shieldmonkey: GM Request Failed", err);
        sendResponse({ error: err.message });
      });
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
    chrome.storage.local.get(['autoBackup'], (res) => {
      if (res.autoBackup) {
        performBackup().then(count => {
          console.log(`Auto-backup completed. Saved ${count} scripts.`);
          chrome.storage.local.set({ lastBackupTime: new Date().toISOString() });
        }).catch(err => {
          console.error("Auto-backup failed:", err);
          // Error is also logged in backupManager with notification
        });
      } else {
        console.log("Auto-backup skipped (disabled in settings).");
      }
    });
  }
});

// Update alarm when settings change
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local') {
    if (changes.autoBackup || changes.backupFrequency) {
      setupBackupAlarm();
    }
  }
});

function setupBackupAlarm() {
  chrome.storage.local.get(['autoBackup', 'backupFrequency'], (res) => {
    const enabled = !!res.autoBackup;
    const frequency = res.backupFrequency || 'daily'; // default daily

    if (enabled) {
      let periodInMinutes = 60 * 24; // daily
      if (frequency === 'hourly') periodInMinutes = 60;
      if (frequency === 'weekly') periodInMinutes = 60 * 24 * 7;

      chrome.alarms.create('backup-alarm', { periodInMinutes });
      console.log(`Backup alarm set to ${frequency} (${periodInMinutes} mins)`);
    } else {
      chrome.alarms.clear('backup-alarm');
      console.log("Backup alarm cleared");
    }
  });
}

chrome.notifications.onClicked.addListener((notificationId) => {
  if (notificationId) {
    // Open options page to hash #settings
    chrome.runtime.openOptionsPage();
    // Or if we specifically want #settings:
    // chrome.tabs.create({ url: 'src/options/index.html#settings' });
  }
});
