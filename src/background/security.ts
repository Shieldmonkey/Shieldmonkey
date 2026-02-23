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
                    resourceTypes: ['main_frame', 'sub_frame'],
                    // Allow navigating to safe domains / external resources if needed, otherwise block ALL external frames/top-level nav
                    regexFilter: "^http",
                    // We don't want to block opening new tabs via external links 
                    excludedRequestDomains: [
                        "shieldmonkey.github.io",
                        "github.com",
                        "raw.githubusercontent.com" // for updates
                    ]
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
