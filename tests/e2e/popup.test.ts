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

    await page.waitForSelector('#root');
    const appElement = page.locator('#root');
    expect(await appElement.isVisible()).toBe(true);
});

test('Create new script opens options page with editor', async () => {
    await page.goto(getExtensionUrl(extensionId, '/src/popup/index.html'));

    // Click create new script button
    // Using text based selector from translation key 'createNewScript' which is likely 'Create new script' or similar. 
    // Actually, looking at App.tsx, the button has text "{t('createNewScript')}". 
    // Let's assume English locale or check the element structure.
    // The button has class 'new-script-btn'.
    const btn = page.locator('.new-script-btn');
    await btn.click();

    // Expect a new tab/page to open
    const newPage = await browserContext.waitForEvent('page');
    await newPage.waitForLoadState();

    const url = newPage.url();
    expect(url).toContain('#/new'); // Or it might redirect to /scripts/:id immediately if we logic is fast? 
    // Wait, my logic says: setCode(template) -> handleSave -> navigate. 
    // So initially it should be at #/new.

    // Check if editor is loaded
    await newPage.waitForSelector('.monaco-editor');

    // Check if "New Script" is in the name input
    const nameInput = newPage.locator('.script-name-input');
    await nameInput.waitFor();
    expect(await nameInput.inputValue()).toBe('New Script');

    // Check if default code is present (partial match)
    // Monaco content is hard to read directly, but we can check if we are not in "Script Not Found" state.
    const notFound = newPage.locator('text=Script not found');
    expect(await notFound.isVisible()).toBe(false);
});
