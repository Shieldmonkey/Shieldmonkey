import { initBridge } from '../host/bridge';

// Initialize bridge
initBridge();

// Set body styles
document.body.style.margin = '0';
document.body.style.padding = '0';
document.body.style.width = '100vw';
document.body.style.height = '100dvh';
document.body.style.overflow = 'hidden';

// Create iframe
const iframe = document.createElement('iframe');
const hash = window.location.hash || '#/options';
iframe.src = chrome.runtime.getURL('src/sandbox/index.html') + hash;
iframe.style.width = '100%';
iframe.style.height = '100%';
iframe.style.border = 'none';
iframe.setAttribute('sandbox', 'allow-scripts allow-forms allow-popups allow-downloads allow-modals');
document.body.appendChild(iframe);

// Sync hash changes from Host to Iframe
window.addEventListener('hashchange', () => {
    // Only forward if it's different (avoid loops if we update it ourselves)
    // Actually, iframe handles its own routing. We just say "Navigate".
    if (iframe.contentWindow) {
        iframe.contentWindow.postMessage({ type: 'NAVIGATE', path: window.location.hash }, '*');
    }
});

// Listen for hash updates from Iframe
window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'URL_CHANGED' && event.data.hash) {
        if (window.location.hash !== event.data.hash) {
            // Use replaceState to avoid adding duplicate history entries when user clicks in iframe
            // But if we want back button support, we might want pushState?
            // If the iframe navigated, it's a new state.
            // Let's use history.replaceState so strict browser back/forward works on the host window history stack?
            // If user clicks a link in iframe -> Iframe URL changes -> We get URL_CHANGED.
            // If we use replaceState, we update the address bar but don't add to history.
            // Then back button goes to previous Host page. 
            // If we use pushState/hash assignment, we add to history. 
            // Then back button sets Host hash -> Host hashchange -> Iframe navigate.
            // This seems correct for history support.
            if (window.location.hash !== event.data.hash) {
                // Avoid triggering hashchange event loop?
                // Setting location.hash triggers hashchange.
                // We need a flag or check source.
                // But hashchange handler sends NAVIGATE to iframe.
                // If iframe is already at that hash, doing navigate again is usually fine (React Router ignores).
                window.location.hash = event.data.hash;
            }
        }
    }
});
