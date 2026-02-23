import { MessageType } from '../types/messages';

// Detect navigation to .user.js files and redirect to loader page
export function setupNavigationListener() {
    chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
        // Detect and log unauthorized outgoing navigations from extension pages
        if (details.url.startsWith('http')) {
            try {
                const tab = await chrome.tabs.get(details.tabId);
                const isFromExtension = tab.url?.startsWith('chrome-extension://') || tab.url?.startsWith('moz-extension://');

                // Allow explicit known external URLs our extension might navigate to or open
                const allowedHosts = [
                    'shieldmonkey.github.io',
                    'github.com'
                ];

                let isAllowed = false;
                try {
                    const urlObj = new URL(details.url);
                    isAllowed = allowedHosts.some(host => urlObj.hostname === host || urlObj.hostname.endsWith('.' + host));
                } catch { /* Ignore URL parse errors */ }

                if (isFromExtension && !isAllowed) {
                    // This is an unauthorized navigation from an extension page context (e.g. malicious redirect in sandbox)
                    console.error(`[Security] Blocked unauthorized navigation from extension to: ${details.url}`);

                    if (details.frameId === 0) {
                        // If it's the main frame, maybe the extension is trying to navigate the whole tab away
                        // We attempt to fix it by navigating back or closing the tab, although DNR might block it first.
                        // Since DNR blocks it on the network layer, we just update the tab to its safe URL.
                        chrome.tabs.update(details.tabId, { url: tab.url }).catch(() => { });
                    } else {
                        // Subframe navigation: stop it
                        chrome.scripting.executeScript({
                            target: { tabId: details.tabId, frameIds: [details.frameId] },
                            func: () => window.stop()
                        }).catch(() => { });
                    }
                    // Stop further processing for this event
                    return;
                }
            } catch { /* ignore */ }
        }

        if (details.frameId === 0 && details.url && /^[^?#]+\.user\.js([?#].*)?$/i.test(details.url)) {
            let referrer = '';
            try {
                const tab = await chrome.tabs.get(details.tabId);
                if (tab.url && tab.url !== 'about:blank') {
                    referrer = tab.url;
                }
            } catch { /* ignore */ }

            chrome.scripting.executeScript({
                target: { tabId: details.tabId },
                func: async (scriptUrl: string, ref: string, msgTypes: typeof MessageType) => {
                    // Stop the pending navigation
                    window.stop();

                    try {
                        const response = await fetch(scriptUrl);
                        if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
                        const content = await response.text();

                        chrome.runtime.sendMessage({
                            type: msgTypes.INSTALL_SCRIPT_WITH_CONTENT,
                            url: scriptUrl, // download url
                            content: content,
                            referrer: ref // source page
                        });
                    } catch (err) {
                        chrome.runtime.sendMessage({
                            type: msgTypes.INSTALL_SCRIPT_FETCH_FAILED,
                            url: scriptUrl,
                            referrer: ref,
                            error: err instanceof Error ? err.message : String(err)
                        });
                    }
                },
                args: [details.url, referrer, MessageType]
            }).catch(() => {
                // Fallback: Redirect to install page if we can't inject script (e.g. chrome:// pages or restricted domains)
                const installUrl = chrome.runtime.getURL('src/options/index.html') + `#/install?url=${encodeURIComponent(details.url)}&referrer=${encodeURIComponent(referrer)}`;
                chrome.tabs.update(details.tabId, { url: installUrl });
            });
        }
    });

    // Detect History API changes (pushState/replaceState) and notify scripts
    chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
        chrome.tabs.sendMessage(details.tabId, {
            type: 'GM_URL_CHANGE',
            url: details.url
        }, { frameId: details.frameId }).catch(() => {
            // Ignore errors (e.g. no content script listening)
        });
    });
}
