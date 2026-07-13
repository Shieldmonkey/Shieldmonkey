import { test, expect } from 'vitest';
import { launchExtension, getExtensionUrl } from './test-utils';
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

test('Popup page opens successfully', async () => {
    await page.goto(getExtensionUrl(extensionId, '/src/popup/index.html'));

    const title = await page.title();
    expect(title).toBe('Shieldmonkey');

    // Wait for iframe
    await page.waitForSelector('iframe');
    const frame = page.frameLocator('iframe');

    // Check for AppContent div or similar that indicates React App loaded
    // .app-container or similar? Let's assume #root > div
    await frame.locator('#root').waitFor();
    const appElement = frame.locator('#root');
    expect(await appElement.isVisible()).toBe(true);
    expect(await page.locator('#popup-placeholder').count()).toBe(0);
    expect(await page.locator('iframe').evaluate(element => getComputedStyle(element).visibility)).toBe('visible');
    expect(await page.getByText(/Loading Shieldmonkey/i).count()).toBe(0);
    expect(await frame.getByText(/Loading Shieldmonkey/i).count()).toBe(0);
});

test('Popup reveals with the stored theme already applied', async () => {
    await page.goto(getExtensionUrl(extensionId, '/src/popup/index.html'));
    await page.evaluate(() => chrome.storage.local.set({ theme: 'light' }));
    await page.reload();
    await page.frameLocator('iframe').locator('.popup-console').waitFor();
    expect(await page.locator('html').getAttribute('data-theme')).toBe('light');
    expect(await page.frameLocator('iframe').locator('html').getAttribute('data-theme')).toBe('light');
    expect(await page.locator('#popup-placeholder').count()).toBe(0);
});

test('Popup shows a retry action when the sandbox cannot load', async () => {
    await page.goto(getExtensionUrl(extensionId, '/src/popup/index.html#/options/scripts'));
    const placeholder = page.locator('#popup-placeholder[data-error="true"]');
    await placeholder.waitFor({ timeout: 5_000 });
    await expect.poll(() => placeholder.getByRole('button', { name: /Retry|再試行/i }).isVisible()).toBe(true);
    expect(await page.locator('iframe').evaluate(element => getComputedStyle(element).visibility)).toBe('hidden');
});

test('Create new script opens options page with editor', async () => {
    await page.goto(getExtensionUrl(extensionId, '/src/popup/index.html'));

    const frame = page.frameLocator('iframe');

    // Click create new script button
    const btn = frame.locator('.new-script-btn');

    // Expect a new tab/page to open
    const pagePromise = browserContext.waitForEvent('page', page => page.url().includes(extensionId));
    await btn.click();
    const newPage = await pagePromise;
    await newPage.waitForLoadState();

    const url = newPage.url();
    expect(url).toContain('#/options/new'); // Updated from #/new to #/options/new

    // New page also has an iframe
    const newPageFrame = newPage.frameLocator('iframe');

    // Check if editor is loaded
    await newPageFrame.locator('.cm-editor').waitFor();

    // Check if "New Script" is in the name input
    const nameInput = newPageFrame.locator('.script-name-input');
    await nameInput.waitFor();
    expect(await nameInput.innerText()).toBe('New Script');

    // Check if default code is present
    const notFound = newPageFrame.locator('text=Script not found');
    expect(await notFound.isVisible()).toBe(false);
});

test('Popup does not eagerly load editor tooling', async () => {
    const loadedScripts: string[] = [];
    page.on('response', response => {
        if (response.request().resourceType() === 'script') loadedScripts.push(response.url());
    });
    await page.goto(getExtensionUrl(extensionId, '/src/popup/index.html'));
    const frame = page.frameLocator('iframe');
    await frame.locator('.popup-console').waitFor();
    expect(loadedScripts.some(url => /ScriptEditor|standalone|babel-|estree-|dark-/i.test(url))).toBe(false);
});
