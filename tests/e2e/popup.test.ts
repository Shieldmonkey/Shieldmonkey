import { test, expect } from 'vitest';
import { launchExtension, getExtensionUrl } from './test-utils';
import { BrowserContext, Page } from 'playwright';

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
