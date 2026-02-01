import type { Script } from './types';
import { UserscriptMessageType } from '../types/messages';


// GM API Handlers
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleGMRequest(type: UserscriptMessageType | string, data: any, _sender: chrome.runtime.MessageSender, scriptId?: string, token?: string) {
    const origin = _sender.origin;
    const tabId = _sender.tab?.id;

    // Verify permissions
    if (!scriptId) {
        throw new Error("Access denied: Missing scriptId");
    }

    const db = await chrome.storage.local.get('scripts');
    const scripts = (db.scripts || []) as Script[];
    const script = scripts.find((s) => s.id === scriptId);

    if (!script) {
        throw new Error("Script not found");
    }

    // Verify token
    if (script.token && script.token !== token) {
        throw new Error("Access denied: Invalid script token");
    }

    const permissions = new Set(script.grantedPermissions || []);
    const apiName = type;

    // Exceptions that don't need permission or are internal
    if (apiName !== UserscriptMessageType.GM_xhrAbort && apiName !== UserscriptMessageType.GM_closeTab && !permissions.has(apiName)) {
        // Also check dot notation if applicable e.g. GM.setValue
        const dotName = apiName.replace('_', '.');
        if (!permissions.has(dotName)) {
            console.warn(`Script ${script.name} attempted to use ${apiName} without permission.`);
            if (apiName === 'GM_closeTab' && (permissions.has('window.close') || permissions.has('close'))) {
                // Allowed
            } else {
                throw new Error(`Permission denied: ${apiName}`);
            }
        }
    }


    switch (type) {
        case UserscriptMessageType.GM_setValue:
            {
                const key = `val_${scriptId}_${origin}_${data.key}`;
                await chrome.storage.local.set({ [key]: data.value });

                // Broadcast change (exclude sender)
                chrome.tabs.query({}, (tabs) => {
                    for (const tab of tabs) {
                        if (tab.id && tab.id !== tabId) {
                            chrome.tabs.sendMessage(tab.id, {
                                type: 'GM_STORAGE_CHANGE',
                                scriptId: scriptId,
                                key: data.key,
                                value: data.value,
                                remote: true
                            }).catch(() => { });
                        }
                    }
                });
                return null;
            }
        case UserscriptMessageType.GM_getValue:
            {
                const key = `val_${scriptId}_${origin}_${data.key}`;
                const res = await chrome.storage.local.get(key);
                return res[key];
            }
        case UserscriptMessageType.GM_deleteValue:
            {
                const key = `val_${scriptId}_${origin}_${data.key}`;
                await chrome.storage.local.remove(key);

                // Broadcast change (exclude sender)
                chrome.tabs.query({}, (tabs) => {
                    for (const tab of tabs) {
                        if (tab.id && tab.id !== tabId) {
                            chrome.tabs.sendMessage(tab.id, {
                                type: 'GM_STORAGE_CHANGE',
                                scriptId: scriptId,
                                key: data.key,
                                value: undefined, // deleted
                                remote: true
                            }).catch(() => { });
                        }
                    }
                });
                return null;
            }
        case UserscriptMessageType.GM_listValues:
            {
                const all = await chrome.storage.local.get(null);
                const prefix = `val_${scriptId}_${origin}_`;
                return Object.keys(all).filter(k => k.startsWith(prefix)).map(k => k.slice(prefix.length));
            }
        case UserscriptMessageType.GM_notification:
            if (chrome.notifications) {
                chrome.notifications.create({
                    type: 'basic',
                    iconUrl: data.image || '/icons/icon48.png',
                    title: data.title || 'Shieldmonkey',
                    message: data.text
                });
            }
            return null;
        case UserscriptMessageType.GM_openInTab:
            if (chrome.tabs) {
                const active = data.options?.active !== undefined ? data.options.active : true;
                await chrome.tabs.create({ url: data.url, active: active });
            }
            return null;
        case UserscriptMessageType.GM_xmlhttpRequest:
            // Explicitly not supported
            throw new Error("Shieldmonkey: GM_xmlhttpRequest is explicitly not supported.");
        case UserscriptMessageType.GM_closeTab:
            if (tabId) {
                chrome.tabs.remove(tabId);
            }
            return null;
        case UserscriptMessageType.GM_registerMenuCommand:
            if (chrome.contextMenus) {
                const menuId = `cmd_${scriptId}_${data.caption.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}`;
                chrome.contextMenus.create({
                    id: menuId,
                    title: data.caption,
                    contexts: ["page", "selection", "link"],
                    parentId: "user-scripts-menu"
                }, () => {
                    if (chrome.runtime.lastError) {
                        // Suppress error if duplicate
                    }
                });
                return menuId;
            }
            return null;
        case UserscriptMessageType.GM_unregisterMenuCommand:
            if (chrome.contextMenus) {
                // Note: We use data.menuCmdId directly as it should match what was returned by register
                chrome.contextMenus.remove(data.menuCmdId, () => {
                    if (chrome.runtime.lastError) { /* ignore */ }
                });
            }
            return null;
        case UserscriptMessageType.GM_download:
            if (chrome.downloads) {
                const id = await chrome.downloads.download({
                    url: data.url,
                    filename: data.name, // optional
                    saveAs: false,
                    conflictAction: 'uniquify'
                });
                return id;
            } else {
                throw new Error("Agnt: GM_download permission not granted (internal)");
            }
        case UserscriptMessageType.GM_setValues:
            {
                // Bulk set
                const items: Record<string, unknown> = {};
                for (const key of Object.keys(data.values)) {
                    const storageKey = `val_${scriptId}_${origin}_${key}`;
                    items[storageKey] = data.values[key];
                }
                await chrome.storage.local.set(items);

                // Broadcast all changes
                chrome.tabs.query({}, (tabs) => {
                    for (const tab of tabs) {
                        if (tab.id && tab.id !== tabId) {
                            for (const key of Object.keys(data.values)) {
                                chrome.tabs.sendMessage(tab.id, {
                                    type: 'GM_STORAGE_CHANGE',
                                    scriptId: scriptId,
                                    key: key,
                                    value: data.values[key],
                                    remote: true
                                }).catch(() => { });
                            }
                        }
                    }
                });
                return null;
            }
        case UserscriptMessageType.GM_getValues:
            {
                const keys = data.keys as string[];
                const storageKeys = keys.map(k => `val_${scriptId}_${origin}_${k}`);
                const res = await chrome.storage.local.get(storageKeys);
                const values: Record<string, unknown> = {};

                // Map back to original keys
                for (const k of keys) {
                    const storageKey = `val_${scriptId}_${origin}_${k}`;
                    if (res[storageKey] !== undefined) {
                        values[k] = res[storageKey];
                    }
                }
                return values;
            }
        case UserscriptMessageType.GM_deleteValues:
            {
                const keys = data.keys as string[];
                const storageKeys = keys.map(k => `val_${scriptId}_${origin}_${k}`);
                await chrome.storage.local.remove(storageKeys);

                // Broadcast changes
                chrome.tabs.query({}, (tabs) => {
                    for (const tab of tabs) {
                        if (tab.id && tab.id !== tabId) {
                            for (const k of keys) {
                                chrome.tabs.sendMessage(tab.id, {
                                    type: 'GM_STORAGE_CHANGE',
                                    scriptId: scriptId,
                                    key: k,
                                    value: undefined,
                                    remote: true
                                }).catch(() => { });
                            }
                        }
                    }
                });
                return null;
            }
    }
    return null;
}

export function setupGMListener() {
    chrome.runtime.onUserScriptMessage.addListener((message, _sender, sendResponse) => {
        if (!message || !message.type) {
            return;
        }

        // Handle GM API requests from Injected Scripts
        if (message.type && message.type.startsWith('GM_')) {
            handleGMRequest(message.type, message.data, _sender, message.scriptId, message.token)
                .then(result => {
                    sendResponse({ result });
                })
                .catch(err => {
                    console.error("Shieldmonkey: GM Request Failed", err);
                    sendResponse({ error: err.message });
                });
            return true;
        }
    });
}
