import { initBridge } from '../host/bridge';

// Initialize bridge
initBridge();

// Set body styles
document.body.style.margin = '0';
document.body.style.padding = '0';
// Extension popup needs explicit dimensions on desktop, but full width/height on mobile
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
if (isMobile) {
    document.body.style.width = '100%';
    document.body.style.height = '100dvh';
} else {
    document.body.style.width = '420px';
    document.body.style.height = '600px';
}
document.body.style.overflow = 'hidden';

// Create iframe
const iframe = document.createElement('iframe');
const hash = window.location.hash || '#/popup';
iframe.src = chrome.runtime.getURL('src/sandbox/index.html') + hash;
iframe.style.width = '100%';
iframe.style.height = '100%';
iframe.style.border = 'none';
iframe.setAttribute('sandbox', 'allow-scripts allow-forms allow-popups allow-downloads allow-modals');
iframe.style.display = 'block'; // Prevent inline vertical-align scrollbar
document.body.appendChild(iframe);
