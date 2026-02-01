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

        if (message.type === MessageType.FETCH_SCRIPT_CONTENT) {
            const { url, referrer } = message;
            fetchScriptContent(url, referrer)
                .then(text => sendResponse({ success: true, text }))
                .catch((err: unknown) => sendResponse({ success: false, error: err instanceof Error ? err.message : String(err) }));
            return true; // Keep channel open
        }

        if (message.type === MessageType.OPEN_INSTALL_PAGE) {
            if (_sender.tab && _sender.tab.id) {
                chrome.tabs.update(_sender.tab.id, { url: message.url });
            }
            return true;
        }

        if (message.type === MessageType.START_INSTALL_FLOW) {
            const { url, referrer } = message;
            let installUrl = chrome.runtime.getURL('/src/options/index.html') + `#/install?url=${encodeURIComponent(url)}`;
            if (referrer) {
                installUrl += `&referrer=${encodeURIComponent(referrer)}`;
            }
            chrome.tabs.create({ url: installUrl });
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
                let installUrl = chrome.runtime.getURL(`/src/options/index.html#/install?installId=${installId}&url=${encodeURIComponent(url)}`);
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
            let installUrl = chrome.runtime.getURL(`/src/options/index.html#/install?url=${encodeURIComponent(url)}`);
            if (referrer) {
                installUrl += `&referrer=${encodeURIComponent(referrer)}`;
            }
            chrome.tabs.create({ url: installUrl });
            return;
        }
    });
}
