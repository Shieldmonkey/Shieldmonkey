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

test('Extension loads and popup opens', async () => {
    expect(browserContext).toBeDefined();
    expect(extensionId).toBeTruthy();

    await page.goto(getExtensionUrl(extensionId, '/src/popup/index.html'));
    expect(await page.title()).toBe('Shieldmonkey');
});
