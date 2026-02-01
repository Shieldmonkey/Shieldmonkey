import { isUserScriptsAvailable } from '../utils/browserPolyfill';

// Check if userScripts permission is available, if not open help page
export async function checkUserScriptsPermission() {
    const available = await isUserScriptsAvailable();
    if (!available) {
        console.warn("userScripts API is not available (or permission missing). Prompting user.");
        const optionsUrl = chrome.runtime.getURL('/src/options/index.html');
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
