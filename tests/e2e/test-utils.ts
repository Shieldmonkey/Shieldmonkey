import { BrowserContext, Page, chromium } from 'playwright';
import { readFileSync } from 'fs';
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

    // Create a new page just in case the page is not available
    const newPage = await browserContext.newPage();

    return { browserContext, page: newPage, extensionId };
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

export function createMockFileSystemHandle(initialData?: { name: string; content: string }[]) {
    // We need to serialize the data to pass it to the browser context
    const initialDataJson = JSON.stringify(initialData || []);

    return `
        const initialData = ${initialDataJson};
        const mockBackupData = {
            timestamp: new Date().toISOString(),
            version: '1.0',
            scripts: initialData.length > 0 ? initialData.map((d, i) => ({
                id: 'restored-script-' + i,
                name: d.name,
                code: d.content,
                enabled: true
            })) : [{
                id: 'restored-script',
                name: 'Restored Script',
                code: '// restored',
                enabled: true
            }]
        };

        const mockHandle = {
            kind: 'directory',
            name: 'mock-backup-dir',
            getFileHandle: async (name, options) => ({
                kind: 'file',
                name: name,
                createWritable: async () => ({
                    write: async (content) => {
                        console.log('[MOCK] Writing to ' + name);
                        window._lastWrittenFile = { name, content };
                    },
                    close: async () => {}
                }),
                getFile: async () => new Blob([JSON.stringify(mockBackupData)], { type: 'application/json' })
            }),
            getDirectoryHandle: async (name, options) => ({
                kind: 'directory',
                name: name,
                entries: async function* () {},
                removeEntry: async () => {},
                getFileHandle: async (fileName, opts) => ({
                    kind: 'file',
                    name: fileName,
                    createWritable: async () => ({
                        write: async () => {},
                        close: async () => {}
                    }),
                    getFile: async () => new Blob([JSON.stringify(mockBackupData)], { type: 'application/json' })
                })
            }),
            queryPermission: async () => 'granted',
            requestPermission: async () => 'granted',
            values: async function* () {
                yield { kind: 'file', name: 'shieldmonkey_dump.json' };
            }
        };

        window.showDirectoryPicker = async () => {
            console.log('[MOCK] showDirectoryPicker called');
            return mockHandle;
        };

        window.__mockBackupDirectoryHandle = mockHandle;
    `;
}

// Helper: Install script via mock backup restore
export async function installScriptFromPath(page: Page, extensionId: string, scriptPath: string) {
    const filename = path.basename(scriptPath);
    const content = readFileSync(scriptPath, 'utf-8');

    // 1. Setup mock handle with the script content
    await page.addInitScript(createMockFileSystemHandle([{ name: filename, content }]));

    // 2. Navigate to settings to trigger restore
    const settingsUrl = `chrome-extension://${extensionId}/src/options/index.html#/settings`;
    if (page.url() === settingsUrl) {
        await page.reload();
    } else {
        await page.goto(settingsUrl);
    }

    // Wait for page to fully initialize, especially important in CI environments
    await page.waitForTimeout(TIMEOUT.MEDIUM);

    // 3. Trigger restore
    const dropdownBtn = page.getByRole('button', { name: /Select$/i });
    await dropdownBtn.waitFor({ state: 'visible' });
    await dropdownBtn.click();

    const selectBtn = page.getByRole('button', { name: /Select Directory & Restore/i });
    await selectBtn.waitFor({ state: 'visible' });
    await selectBtn.click();

    // 4. Confirm modal
    const modal = page.locator('.modal-content');
    await modal.waitFor({ state: 'visible' });
    const confirmBtn = modal.getByRole('button', { name: /OK/i });
    await confirmBtn.click();

    // 5. Wait for restore...
    // Removed strict wait for hidden to prevent timeouts
    await page.waitForTimeout(1000);
}
