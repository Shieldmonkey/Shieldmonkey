import { parseMetadata } from '../utils/metadataParser';
import { matchPattern } from '../utils/urlMatcher';
import type { Script } from './types';

// Calculate and update badge for a tab
export async function updateBadge(tabId: number, url: string) {
    try {
        const data = await chrome.storage.local.get('scripts');
        const scripts = (data.scripts || []) as Script[];

        // Only allow supported schemes (whitelist)
        if (!url || !(url.startsWith('http:') || url.startsWith('https:') || url.startsWith('file:'))) {
            await chrome.action.setBadgeText({ tabId, text: '' });
            return;
        }

        const count = scripts.filter(script => {
            if (!script.enabled) return false;
            const metadata = parseMetadata(script.code);
            const patterns = [...metadata.match, ...metadata.include];
            const effectivePatterns = patterns.length > 0 ? patterns : ["<all_urls>"];
            return effectivePatterns.some((pattern: string) => matchPattern(pattern, url));
        }).length;

        if (count > 0) {
            await chrome.action.setBadgeText({ tabId, text: count.toString() });
            await chrome.action.setBadgeBackgroundColor({ tabId, color: '#10b981' });
        } else {
            await chrome.action.setBadgeText({ tabId, text: '' });
        }
    } catch (e) {
        console.error("Failed to update badge", e);
    }
}

// Helper to update active tab badge after script changes
export async function updateActiveTabBadge() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id && tab?.url) {
        updateBadge(tab.id, tab.url);
    }
}

export function setupBadgeListeners() {
    // Tab updates for badge
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
        // Helper handling for badge
        if (changeInfo.status === 'complete' && tab.url && tab.url !== 'about:blank') {
            updateBadge(tabId, tab.url);
        }
    });

    chrome.tabs.onActivated.addListener(async (activeInfo) => {
        try {
            const tab = await chrome.tabs.get(activeInfo.tabId);
            if (tab.url) {
                updateBadge(activeInfo.tabId, tab.url);
            }
        } catch (e) {
            console.error(e);
        }
    });
}
