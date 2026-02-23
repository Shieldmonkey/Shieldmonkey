import { test, expect } from 'vitest';
import { launchExtension, getExtensionUrl, TIMEOUT } from './test-utils';
import type { BrowserContext, Page } from 'playwright';

let browserContext: BrowserContext;
let page: Page;
let extensionId: string;

test.beforeEach(async () => {
    const context = await launchExtension();
    browserContext = context.browserContext;
    page = context.page;
    extensionId = context.extensionId;
});

test.afterEach(async () => {
    await browserContext.close();
});

test('Help page - Links open in new tab via bridge OPEN_URL', async () => {
    // Navigate to the Help page
    await page.goto(getExtensionUrl(extensionId, '/src/options/index.html#/help'));

    // Wait for the iframe to load
    const frame = page.frameLocator('iframe');

    // Wait for the Github repo link to be visible inside the iframe
    // The Help page has an anchor targeting the repo link
    const repoLink = frame.getByRole('link', { name: /Github/i });
    await repoLink.waitFor({ state: 'visible', timeout: TIMEOUT.LONG });

    // Click the link, which should trigger bridge.call('OPEN_URL') instead of default link behavior
    // and open a new tab
    const [newPage] = await Promise.all([
        browserContext.waitForEvent('page'),
        repoLink.click()
    ]);

    // Check if the new page URL matches the github repo URL
    await newPage.waitForLoadState();
    const url = newPage.url();
    expect(url).toContain('github.com/shieldmonkey/shieldmonkey');

    await newPage.close();
});

test('Help page - Whitelist blocks unauthorized OPEN_URL via bridge', async () => {
    await page.goto(getExtensionUrl(extensionId, '/src/options/index.html#/help'));

    // Wait for iframe
    const frame = page.mainFrame().childFrames()[0];
    expect(frame).toBeTruthy();

    // Use page.evaluate to trigger an unauthorized OPEN_URL call
    // The bridge is exposed or we can dispatch the message manually to the host window
    let errorThrown = false;

    // Listen for console errors about blocked OPEN_URL
    const consolePromise = new Promise<void>((resolve) => {
        page.on('console', (msg) => {
            if (msg.type() === 'error' && msg.text().includes('Blocked unauthorized OPEN_URL request to: https://evil.com')) {
                errorThrown = true;
                resolve();
            }
        });
    });

    await page.evaluate(() => {
        // Send massage to host bridge directly to test the whitelist
        window.postMessage({ id: 'test-evil-url', type: 'OPEN_URL', payload: 'https://evil.com/' }, '*');
    });

    // Wait for the console log or timeout
    await Promise.race([
        consolePromise,
        new Promise(r => setTimeout(r, 2000))
    ]);

    expect(errorThrown).toBe(true);
});
