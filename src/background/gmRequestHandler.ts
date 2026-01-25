import type { Script } from './types';
import { parseMetadata } from '../utils/metadataParser';

// GM API Handlers
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleGMRequest(type: string, data: any, _sender: chrome.runtime.MessageSender, scriptId?: string) {
    const origin = _sender.origin;

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

                const targetUrl = new URL(DETAILS.url);
                const targetDomain = targetUrl.hostname;

                // 1. Allow if matched by any @connect rule
                const isAllowed = connectRules.some(rule => {
                    if (rule === '*') return true;
                    if (rule === 'self') return targetUrl.origin === origin;
                    if (rule === 'localhost') return targetDomain === 'localhost' || targetDomain === '127.0.0.1';

                    // Normalize rule
                    if (rule.includes('*')) {
                        // simple glob conversion
                        const regex = new RegExp('^' + rule.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$');
                        return regex.test(targetDomain);
                    }

                    return targetDomain === rule || targetDomain.endsWith('.' + rule);
                });

                if (!isAllowed && connectRules.length > 0) {
                    throw new Error(`Permission denied: ${DETAILS.url} is not allowed by @connect.`);
                }

                if (connectRules.length === 0) {
                    // Fallback: Allow if same origin as the page
                    if (targetUrl.origin !== origin) {
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
