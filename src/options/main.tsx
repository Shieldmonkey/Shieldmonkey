import { initBridge } from '../host/bridge';

// Set body styles
document.body.style.margin = '0';
document.body.style.padding = '0';
document.body.style.width = '100vw';
document.body.style.height = '100dvh';
document.body.style.overflow = 'hidden';

// Create iframe
const iframe = document.createElement('iframe');
const legacyMatch = new URLSearchParams(window.location.search).get('match');
const hash = window.location.hash || '#/options/scripts';
const normalizedHash = legacyMatch && hash === '#/options/new'
    ? `#/options/new?match=${encodeURIComponent(legacyMatch)}`
    : hash;
iframe.src = chrome.runtime.getURL('src/sandbox/index.html') + normalizedHash;
iframe.style.width = '100%';
iframe.style.height = '100%';
iframe.style.border = 'none';
document.body.appendChild(iframe);
initBridge(iframe);

// Sync hash changes from Host to Iframe
window.addEventListener('hashchange', () => {
    // Only forward if it's different
    if (iframe.contentWindow) {
        iframe.contentWindow.postMessage({ type: 'NAVIGATE', path: window.location.hash }, '*');
    }
});

// Listen for hash updates from Iframe
window.addEventListener('message', (event) => {
    if (event.source !== iframe.contentWindow) return;
    if (event.data && event.data.type === 'URL_CHANGED' && event.data.hash) {
        // Prevent update loop: only alter location.hash if it is different
        // Actually modifying window.location.hash triggers hashchange, 
        // which sends NAVIGATE to iframe again.
        // We use history.replaceState to avoid the hashchange event and history pollution
        if (window.location.hash !== event.data.hash) {
            window.history.replaceState(null, '', event.data.hash);
        }
    }
});
