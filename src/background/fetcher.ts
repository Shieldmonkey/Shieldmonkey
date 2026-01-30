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
                const text = await res.text();
                return { success: true, data: text };
            } catch (e) {
                return { success: false, error: e instanceof Error ? e.message : String(e) };
            }
        },
        args: [targetUrl]
    });

    // Cleanup
    chrome.tabs.remove(tab.id);

    // Process results
    if (results && results[0] && results[0].result) {
        const res = results[0].result as { success: boolean, data?: string, error?: string };
        if (res.success && typeof res.data === 'string') {
            return res.data;
        } else {
            throw new Error(res.error || "Unknown bridge fetch error");
        }
    }

    throw new Error("Failed to retrieve script content from bridge (empty result)");
}

const pendingFetches = new Map<string, Promise<string>>();

// Helper to fetch script content directly from background (used by Install page and others via Message)
export async function fetchScriptContent(url: string, referrer?: string): Promise<string> {
    // Check for pending requests to avoid multiple tabs
    if (pendingFetches.has(url)) {
        return pendingFetches.get(url)!;
    }

    const fetchPromise = (async () => {
        // Optimization: Skip bridge for local resources where CSP allows fetch
        // This includes extensions resources, data URIs, etc.
        if (url.startsWith('chrome-extension:') || url.startsWith('file:') || url.startsWith('data:') || url.startsWith('moz-extension:')) {
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
            console.error("Default bridge fetch failed:", e);

            // Retry with referrer if available
            if (referrer) {
                console.log(`Retrying fetch via referrer bridge: ${referrer}`);
                try {
                    return await fetchViaBridge(referrer, url);
                } catch (retryErr) {
                    console.error("Referrer bridge fetch also failed:", retryErr);
                }
            }

            throw new Error(`Failed to fetch script: ${(e as Error).message}`);
        }
    })();

    pendingFetches.set(url, fetchPromise);

    try {
        return await fetchPromise;
    } finally {
        pendingFetches.delete(url);
    }
}
