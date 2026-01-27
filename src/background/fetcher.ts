// Helper execution via bridge (Web Context) to bypass Extension CSP
async function fetchViaBridge(url: string, targetUrl: string): Promise<string> {
    // Open tab
    const tab = await chrome.tabs.create({ url, active: false });
    if (!tab.id) throw new Error("Failed to create bridge tab");

    // Wait for load
    await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Bridge tab execution timeout")), 15000);
        const listener = (tid: number, info: { status?: string }) => {
            if (tid === tab.id && info.status === 'complete') {
                clearTimeout(timeout);
                chrome.tabs.onUpdated.removeListener(listener);
                resolve();
            }
        };
        chrome.tabs.onUpdated.addListener(listener);
    });

    // Execute fetch in the page context
    const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: async (u: string) => {
            try {
                const res = await fetch(u);
                if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
                return await res.text();
            } catch (e) {
                throw new Error(e instanceof Error ? e.message : String(e));
            }
        },
        args: [targetUrl]
    });

    // Cleanup
    chrome.tabs.remove(tab.id);

    if (results && results[0] && results[0].result) {
        return results[0].result;
    }
    throw new Error("Failed to retrieve script content from bridge");
}

// Helper to fetch script content directly from background (used by Install page and others via Message)
export async function fetchScriptContent(url: string): Promise<string> {
    // Optimization: Skip direct fetch for http/https to avoid CSP errors (User Request)
    // Only try direct fetch for local/internal resources
    if (url.startsWith('chrome-extension:') || url.startsWith('file:') || url.startsWith('data:')) {
        try {
            const response = await fetch(url);
            if (response.ok) {
                return await response.text();
            }
        } catch {
            // Fallback to bridge if direct fetch fails (though bridge might also fail for local)
        }
    }

    const bridgeUrl = `https://shieldmonkey.github.io/bridge/install`;

    try {
        return await fetchViaBridge(bridgeUrl, url);
    } catch (e) {
        console.error("Bridge fetch failed", e);
        throw new Error(`Failed to fetch script: ${(e as Error).message}`);
    }
}
