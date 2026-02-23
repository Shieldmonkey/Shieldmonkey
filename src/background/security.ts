export async function setupSecurityRules() {
    try {
        const extensionUrl = chrome.runtime.getURL('');
        const extensionDomain = new URL(extensionUrl).hostname;

        const rules: chrome.declarativeNetRequest.Rule[] = [
            {
                id: 2,
                priority: 1,
                action: { type: 'block' },
                condition: {
                    initiatorDomains: [extensionDomain],
                    excludedRequestDomains: ['shieldmonkey.github.io', 'github.com'],
                    resourceTypes: ['main_frame', 'sub_frame'],
                    regexFilter: "^http"
                }
            }
        ];

        await chrome.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: [2],
            addRules: rules
        });
        console.log("DNR dynamic security rules configured");
    } catch (e) {
        console.error("Failed to setup DNR dynamic security rules", e);
    }
}
