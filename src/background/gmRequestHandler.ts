import type { Script } from './types';
import { UserscriptMessageType } from '../types/messages';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const aiSessions = new Map<string, any>();

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
    const isAIApi = apiName.startsWith('GM_ai_');

    // Exceptions that don't need permission or are internal
    if (apiName !== UserscriptMessageType.GM_xhrAbort && apiName !== UserscriptMessageType.GM_closeTab && !permissions.has(apiName)) {
        // Also check dot notation if applicable e.g. GM.setValue
        const dotName = apiName.replace('_', '.');
        if (!permissions.has(dotName)) {
            if (isAIApi) {
                if (!permissions.has('LanguageModel')) {
                    throw new Error(`Permission denied: LanguageModel is required for ${apiName}`);
                }
            } else if (apiName === 'GM_closeTab' && (permissions.has('window.close') || permissions.has('close'))) {
                // Allowed
            } else {
                console.warn(`Script ${script.name} attempted to use ${apiName} without permission.`);
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
        case UserscriptMessageType.GM_ai_capabilities:
            {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const LanguageModel = (self as any).LanguageModel;
                if (!LanguageModel) {
                    throw new Error("Prompt API (window.LanguageModel) is not available");
                }
                const availability = await LanguageModel.availability();
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                let params: any = {};
                try {
                    params = await LanguageModel.params();
                } catch {
                    // Ignore
                }
                return {
                    available: availability,
                    defaultTemperature: params.defaultTemperature,
                    defaultTopK: params.defaultTopK,
                    maxTopK: params.maxTopK
                };
            }
        case UserscriptMessageType.GM_ai_create:
            {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const LanguageModel = (self as any).LanguageModel;
                if (!LanguageModel) {
                    throw new Error("Prompt API (window.LanguageModel) is not available");
                }
                const session = await LanguageModel.create(data.options);
                const sessionId = `ai_sess_${Date.now()}_${Math.random().toString(36).substring(2)}`;
                aiSessions.set(sessionId, session);
                return { sessionId };
            }
        case UserscriptMessageType.GM_ai_prompt:
            {
                const session = aiSessions.get(data.sessionId);
                if (!session) {
                    throw new Error("AI Session not found or already destroyed");
                }
                const result = await session.prompt(data.text, data.options);
                return result;
            }
        case UserscriptMessageType.GM_ai_promptStreaming:
            {
                const session = aiSessions.get(data.sessionId);
                if (!session) {
                    throw new Error("AI Session not found or already destroyed");
                }
                const streamId = `ai_stream_${Date.now()}_${Math.random().toString(36).substring(2)}`;

                const stream = await session.promptStreaming(data.text, data.options);

                (async () => {
                    try {
                        const reader = stream.getReader ? stream.getReader() : null;
                        if (reader) {
                            while (true) {
                                const { done, value } = await reader.read();
                                if (done) break;
                                if (tabId) {
                                    chrome.tabs.sendMessage(tabId, {
                                        type: 'GM_AI_STREAM_CHUNK',
                                        streamId,
                                        chunk: value
                                    }, { frameId: _sender.frameId }).catch(() => { });
                                }
                            }
                        } else {
                            for await (const chunk of stream) {
                                if (tabId) {
                                    chrome.tabs.sendMessage(tabId, {
                                        type: 'GM_AI_STREAM_CHUNK',
                                        streamId,
                                        chunk
                                    }, { frameId: _sender.frameId }).catch(() => { });
                                }
                            }
                        }

                        if (tabId) {
                            chrome.tabs.sendMessage(tabId, {
                                type: 'GM_AI_STREAM_END',
                                streamId
                            }, { frameId: _sender.frameId }).catch(() => { });
                        }
                    } catch (e) {
                        if (tabId) {
                            chrome.tabs.sendMessage(tabId, {
                                type: 'GM_AI_STREAM_ERROR',
                                streamId,
                                error: (e as Error).message
                            }, { frameId: _sender.frameId }).catch(() => { });
                        }
                    }
                })();

                return { streamId };
            }
        case UserscriptMessageType.GM_ai_destroy:
            {
                const session = aiSessions.get(data.sessionId);
                if (session && typeof session.destroy === 'function') {
                    session.destroy();
                }
                aiSessions.delete(data.sessionId);
                return null;
            }
        case UserscriptMessageType.GM_ai_clone:
            {
                const session = aiSessions.get(data.sessionId);
                if (!session || typeof session.clone !== 'function') {
                    throw new Error("AI Session not found or cannot be cloned");
                }
                const newSession = await session.clone();
                const newSessionId = `ai_sess_${Date.now()}_${Math.random().toString(36).substring(2)}`;
                aiSessions.set(newSessionId, newSession);
                return { sessionId: newSessionId };
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
