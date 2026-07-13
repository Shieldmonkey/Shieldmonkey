import { expect, test } from 'vitest';
import type { BrowserContext, Page } from 'playwright';
import { getExtensionUrl, launchExtension } from './test-utils';

let browserContext: BrowserContext;
let page: Page;
let extensionId: string;

test.beforeEach(async () => {
    const context = await launchExtension();
    browserContext = context.browserContext;
    page = context.page;
    extensionId = context.extensionId;
});

test.afterEach(async () => { await browserContext.close(); });

test('script console switches between cards and table at supported widths', async () => {
    await page.goto(getExtensionUrl(extensionId, '/src/options/index.html#/options/scripts'));
    await page.evaluate(() => chrome.storage.local.set({ scripts: [{
        id: 'responsive-script',
        name: 'Responsive Audit',
        code: '// ==UserScript==\n// @name Responsive Audit\n// @match https://example.com/*\n// ==/UserScript==',
        enabled: true,
    }] }));

    for (const viewport of [{ width: 360, height: 800 }, { width: 900, height: 900 }]) {
        await page.setViewportSize(viewport);
        await page.reload();
        const frame = page.frameLocator('iframe');
        await expect.poll(() => frame.locator('.script-card-list').isVisible()).toBe(true);
        expect(await frame.locator('.script-table-shell').count()).toBe(0);
    }

    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.reload();
    const frame = page.frameLocator('iframe');
    await expect.poll(() => frame.locator('.script-table-shell').isVisible()).toBe(true);
    expect(await frame.locator('.script-card-list').count()).toBe(0);
});
