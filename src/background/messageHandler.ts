import { handleSaveScript, handleToggleScript, handleToggleGlobal, handleDeleteScript, reloadAllScripts } from './scripts';
import { fetchScriptContent } from './fetcher';
import { MessageType } from '../types/messages';

// Listen for messages from the Options page (Dashboard)
export function setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
        if (message.type === MessageType.SAVE_SCRIPT) {
            const { script } = message;
            handleSaveScript(script).then(() => sendResponse({ success: true })).catch((err: unknown) => sendResponse({ success: false, error: err instanceof Error ? err.message : String(err) }));
            return true;
        }

        if (message.type === MessageType.TOGGLE_SCRIPT) {
            const { scriptId, enabled } = message;
            handleToggleScript(scriptId, enabled).then(() => sendResponse({ success: true })).catch((err: unknown) => sendResponse({ success: false, error: err instanceof Error ? err.message : String(err) }));
            return true;
        }

        if (message.type === MessageType.TOGGLE_GLOBAL) {
            const { enabled } = message;
            handleToggleGlobal(enabled).then(() => sendResponse({ success: true })).catch((err: unknown) => sendResponse({ success: false, error: err instanceof Error ? err.message : String(err) }));
            return true;
        }

        if (message.type === MessageType.DELETE_SCRIPT) {
            const { scriptId } = message;
            handleDeleteScript(scriptId).then(() => sendResponse({ success: true })).catch((err: unknown) => sendResponse({ success: false, error: err instanceof Error ? err.message : String(err) }));
            return true;
        }

        if (message.type === MessageType.START_UPDATE_FLOW) {
            const { scriptId } = message;
            chrome.storage.local.get(['scripts']).then(data => {
                const script = ((data.scripts as { id: string, updateUrl?: string, downloadUrl?: string, sourceUrl?: string, code?: string, referrerUrl?: string }[]) || []).find(s => s.id === scriptId);
                if (script) {
                    let updateUrl = script.updateUrl || script.downloadUrl || script.sourceUrl;

                    if (!updateUrl && script.code) {
                        const code = script.code;
                        const extractMeta = (key: string) => {
                            const match = code.match(new RegExp(`//\\s*@${key}\\s+(.+)`));
                            return match ? match[1].trim() : null;
                        };
                        updateUrl = (extractMeta('updateURL') || extractMeta('downloadURL') || extractMeta('installURL') || extractMeta('source')) ?? undefined;
                    }

                    if (updateUrl) {
                        fetchScriptContent(updateUrl, script.referrerUrl)
                            .then(content => {
                                const installId = crypto.randomUUID();
                                const key = `pending_install_${installId}`;
                                chrome.storage.local.set({ [key]: { url: updateUrl, content, referrer: script.referrerUrl } }).then(() => {
                                    const installPage = chrome.runtime.getURL(`/src/options/index.html#/options/install?installId=${installId}&url=${encodeURIComponent(updateUrl!)}`);
                                    chrome.tabs.create({ url: installPage });
                                    sendResponse({ success: true });
                                });
                            })
                            .catch(err => {
                                console.error('Failed to fetch script update in background', err);
                                const installPage = chrome.runtime.getURL(`/src/options/index.html#/options/install?url=${encodeURIComponent(updateUrl!)}`);
                                chrome.tabs.create({ url: installPage });
                                sendResponse({ success: false, error: String(err) });
                            });
                    } else {
                        console.warn('No update URL found for script', scriptId);
                        sendResponse({ success: false, error: 'No update URL found' });
                    }
                } else {
                    console.warn('Script not found for update', scriptId);
                    sendResponse({ success: false, error: 'Script not found' });
                }
            });
            return true;
        }

        if (message.type === MessageType.RELOAD_SCRIPTS) {
            reloadAllScripts().then(() => sendResponse({ success: true }));
            return true;
        }

        // Handle messages from Content Script (INSTALL_SCRIPT_WITH_CONTENT)
        if (message.type === MessageType.INSTALL_SCRIPT_WITH_CONTENT) {
            const { url, content, referrer } = message;
            const installId = crypto.randomUUID();
            const key = `pending_install_${installId}`;

            // Store content temporarily
            chrome.storage.local.set({ [key]: { url, content, referrer } }).then(() => {
                let installUrl = chrome.runtime.getURL(`/src/options/index.html#/options/install?installId=${installId}&url=${encodeURIComponent(url)}`);
                if (referrer) {
                    installUrl += `&referrer=${encodeURIComponent(referrer)}`;
                }
                chrome.tabs.create({ url: installUrl });
            });
            return; // No response needed
        }

        if (message.type === MessageType.INSTALL_SCRIPT_FETCH_FAILED) {
            const { url, error, referrer } = message;
            console.warn(`Content script failed to fetch ${url}: ${error}. Falling back to background fetch.`);

            // Fallback: Open install page with URL only, let it request background fetch
            // Pass referrer
            let installUrl = chrome.runtime.getURL(`/src/options/index.html#/options/install?url=${encodeURIComponent(url)}`);
            if (referrer) {
                installUrl += `&referrer=${encodeURIComponent(referrer)}`;
            }
            chrome.tabs.create({ url: installUrl });
            return;
        }
    });
}
