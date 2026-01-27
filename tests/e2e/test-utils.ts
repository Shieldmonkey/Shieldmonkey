import { BrowserContext, Page, chromium } from 'playwright';
import path from 'path';

// Constants
export const EXTENSION_PATH = path.join(process.cwd(), 'dist');
export const USER_DATA_DIR = path.join(process.cwd(), 'test-user-data-dir');
export const TIMEOUT = {
    SHORT: 300,
    MEDIUM: 1000,
    LONG: 2000,
    VERY_LONG: 3000,
} as const;

// Types
export interface ExtensionContext {
    browserContext: BrowserContext;
    page: Page;
    extensionId: string;
}

export interface MockScript {
    id: string;
    name: string;
    code: string;
    enabled: boolean;
}

// Main extension launcher
export async function launchExtension(): Promise<ExtensionContext> {
    const browserContext = await chromium.launchPersistentContext(USER_DATA_DIR, {
        headless: false, // Use --headless=new in args instead
        locale: 'en',
        args: [
            `--disable-extensions-except=${EXTENSION_PATH}`,
            `--load-extension=${EXTENSION_PATH}`,
            '--headless=new', // New headless mode for Chromium
        ],
    });

    const page = await browserContext.newPage();

    page.on('console', msg => console.log(`[PAGE CONSOLE] ${msg.text()}`));
    page.on('pageerror', exception => console.log(`[PAGE ERROR] ${exception}`));

    // Wait for service worker to be ready
    await waitForServiceWorker(browserContext);

    const extensionId = await getExtensionId(browserContext);
    console.log(`Extension ID: ${extensionId}`);

    await enableUserScriptsIfNeeded(browserContext, extensionId);

    return { browserContext, page, extensionId };
}

// Helper: Wait for service worker to be available
async function waitForServiceWorker(browserContext: BrowserContext): Promise<void> {
    const maxAttempts = 30;
    const delayMs = 500;

    for (let i = 0; i < maxAttempts; i++) {
        const serviceWorkers = browserContext.serviceWorkers();
        if (serviceWorkers.length > 0) {
            return;
        }
        await new Promise(resolve => setTimeout(resolve, delayMs));
    }

    throw new Error('Service worker did not start within expected time');
}

// Helper: Get extension ID from service workers
async function getExtensionId(browserContext: BrowserContext): Promise<string> {
    const serviceWorkers = browserContext.serviceWorkers();
    if (serviceWorkers.length === 0) {
        throw new Error('No service workers found');
    }

    const url = serviceWorkers[0].url();
    const match = url.match(/chrome-extension:\/\/([a-z0-9]+)/);
    if (!match) {
        throw new Error(`Could not extract extension ID from URL: ${url}`);
    }

    return match[1];
}

// Helper: Check if User Scripts API is enabled
async function isUserScriptsEnabled(browserContext: BrowserContext): Promise<boolean> {
    const serviceWorkers = browserContext.serviceWorkers();
    if (serviceWorkers.length === 0) return false;

    return await serviceWorkers[0].evaluate(async () => {
        try {
            if (typeof chrome.userScripts === 'undefined') return false;
            await chrome.userScripts.getScripts({});
            return true;
        } catch {
            return false;
        }
    });
}

// Helper: Enable User Scripts API if needed
async function enableUserScriptsIfNeeded(
    browserContext: BrowserContext,
    extensionId: string
): Promise<void> {
    if (await isUserScriptsEnabled(browserContext)) {
        return;
    }

    const settingPage = await browserContext.newPage();
    await settingPage.goto(`chrome://extensions?id=${extensionId}`);

    const toggleRow = settingPage.locator('#allow-user-scripts');
    const toggleButton = toggleRow.locator('cr-toggle');

    if ((await toggleButton.getAttribute('aria-pressed')) === 'false') {
        await toggleButton.click();
    }
}

// Helper: Navigate to extension page
export function getExtensionUrl(extensionId: string, path: string): string {
    return `chrome-extension://${extensionId}${path}`;
}

// Helper: Clear all scripts
export async function clearAllScripts(page: Page): Promise<void> {
    await page.evaluate(() => chrome.storage.local.set({ scripts: [] }));
}
