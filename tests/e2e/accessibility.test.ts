import { test, expect } from 'vitest';
import AxeBuilder from '@axe-core/playwright';
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

for (const route of ['/src/popup/index.html', '/src/options/index.html#/options/scripts', '/src/options/index.html#/options/settings']) {
    test(`has no serious accessibility violations: ${route}`, async () => {
        await page.goto(getExtensionUrl(extensionId, route));
        await page.locator('iframe').waitFor();
        const results = await new AxeBuilder({ page }).include(['iframe', '#root']).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
        const serious = results.violations.filter(violation => violation.impact === 'serious' || violation.impact === 'critical');
        expect(serious.map(({ id, help, nodes }) => ({ id, help, targets: nodes.map(node => node.target) }))).toEqual([]);
    });
}

test('script console has no serious accessibility violations in light theme', async () => {
    await page.goto(getExtensionUrl(extensionId, '/src/options/index.html#/options/scripts'));
    await page.evaluate(() => chrome.storage.local.set({ theme: 'light' }));
    await page.reload();
    await page.locator('iframe').waitFor();
    const results = await new AxeBuilder({ page }).include(['iframe', '#root']).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    const serious = results.violations.filter(violation => violation.impact === 'serious' || violation.impact === 'critical');
    expect(serious.map(({ id, help, nodes }) => ({ id, help, targets: nodes.map(node => node.target) }))).toEqual([]);
});
