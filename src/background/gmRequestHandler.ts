import type { Script } from './types';
import { UserscriptMessageType } from '../types/messages';


// GM API Handlers
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleGMRequest(type: UserscriptMessageType | string, data: any, _sender: chrome.runtime.MessageSender, scriptId?: string) {
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

    const permissions = new Set(script.grantedPermissions || []);
    const apiName = type;

    // Exceptions that don't need permission or are internal
    if (apiName !== UserscriptMessageType.GM_xhrAbort && apiName !== UserscriptMessageType.GM_closeTab && !permissions.has(apiName)) {
        // Also check dot notation if applicable e.g. GM.setValue
        const dotName = apiName.replace('_', '.');
        if (!permissions.has(dotName)) {
            console.warn(`Script ${script.name} attempted to use ${apiName} without permission.`);
            // For GM_closeTab, we might want to allow it implicitly if window.close() is called? 
            // But usually @grant window.close is good practice or @grant GM_closeTab.
            // Let's enforce permission for consistency if possible, or allow if standard.
            // But window.close mapped to GM_closeTab suggests we might want to allow it if @grant window.close is present?
            // The parser might not extract 'GM_closeTab' from '@grant window.close'.

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
                const menuId = `cmd_${scriptId}_${data.caption.replace(/[^a-zA-Z0-9]/g, '_')}`;
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
            }
            return null;
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
            handleGMRequest(message.type, message.data, _sender, message.scriptId)
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
