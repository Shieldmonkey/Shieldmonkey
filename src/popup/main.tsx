import { initBridge } from '../host/bridge';
import type { SandboxReadyMessage } from '../sandbox/bridge/types';
import type { Theme } from '../types/script';

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

const root = document.getElementById('root')!;
const placeholder = document.getElementById('popup-placeholder')!;

function resolveTheme(theme: Theme | undefined): 'light' | 'dark' {
    if (theme === 'light' || theme === 'dark') return theme;
    return matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

async function mountPopup() {
    const { theme } = await chrome.storage.local.get('theme');
    document.documentElement.setAttribute('data-theme', resolveTheme(theme as Theme | undefined));

    const iframe = document.createElement('iframe');
    const hash = window.location.hash || '#/popup';
    iframe.title = 'Shieldmonkey';
    iframe.src = chrome.runtime.getURL('src/sandbox/index.html') + hash;
    iframe.style.position = 'absolute';
    iframe.style.inset = '0';
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = 'none';
    iframe.style.display = 'block';
    iframe.style.visibility = 'hidden';

    let ready = false;
    const handleReady = (event: MessageEvent) => {
        const message = event.data as SandboxReadyMessage | undefined;
        if (event.source !== iframe.contentWindow || message?.type !== 'SANDBOX_READY' || message.route !== 'popup') return;
        ready = true;
        window.clearTimeout(timeout);
        window.removeEventListener('message', handleReady);
        iframe.style.visibility = 'visible';
        placeholder.remove();
    };
    window.addEventListener('message', handleReady);

    const timeout = window.setTimeout(() => {
        if (ready) return;
        placeholder.dataset.error = 'true';
        placeholder.removeAttribute('aria-hidden');
        const message = document.createElement('p');
        message.setAttribute('role', 'alert');
        message.textContent = chrome.i18n.getMessage('popupLoadFailed') || 'Shieldmonkey could not open.';
        const retry = document.createElement('button');
        retry.type = 'button';
        retry.textContent = chrome.i18n.getMessage('retry') || 'Retry';
        retry.addEventListener('click', () => window.location.reload());
        placeholder.replaceChildren(message, retry);
    }, 3_000);

    root.appendChild(iframe);
    initBridge(iframe);
}

mountPopup().catch(() => {
    placeholder.dataset.error = 'true';
    placeholder.removeAttribute('aria-hidden');
    placeholder.textContent = chrome.i18n.getMessage('popupLoadFailed') || 'Shieldmonkey could not open.';
});
