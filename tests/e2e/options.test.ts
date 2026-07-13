import { test, expect } from 'vitest';
import { launchExtension, getExtensionUrl, clearAllScripts, TIMEOUT } from './test-utils';
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

test('Options page - Install, Save, and Delete User Script', async () => {
    await page.goto(getExtensionUrl(extensionId, '/src/options/index.html'));
    await clearAllScripts(page);

    // Title is on the host page
    const title = await page.title();
    expect(title).toMatch(/Shieldmonkey/i);

    const frame = page.frameLocator('iframe');

    const newScriptBtn = frame.getByRole('button', { name: /New Script/i, exact: false }).first();
    await newScriptBtn.waitFor({ state: 'visible' });
    await newScriptBtn.click();

    await page.waitForURL(/.*#\/options\/new/);
    expect(page.url()).toMatch(/.*#\/options\/new/);

    const editor = frame.locator('.cm-content').first();
    await editor.click();

    // CodeMirror inside iframe
    await editor.type(' // Edited by test');

    const saveBtn = frame.getByRole('button', { name: /Save/i });
    await expect.poll(async () => saveBtn.isEnabled()).toBe(true);
    await saveBtn.click();

    // After save, it should likely navigate to /options/scripts/:id
    await page.waitForTimeout(1000); // Wait for save and nav
    const currentUrl = page.url();
    const scriptIdMatch = currentUrl.match(/#\/options\/scripts\/(.+)/);
    const scriptId = scriptIdMatch ? scriptIdMatch[1] : null;
    expect(scriptId).toBeTruthy();

    const backBtn = frame.locator('[title="Back to Script List"]');
    await backBtn.waitFor({ state: 'visible' });
    await backBtn.click();

    const scriptRow = frame.getByRole('row').filter({ hasText: 'New Script' }).first();
    await expect.poll(async () => scriptRow.isVisible()).toBe(true);

    const toggleLabel = scriptRow.locator('label.switch');
    await toggleLabel.waitFor({ state: 'visible' });

    const checkbox = toggleLabel.locator('input[type="checkbox"]');
    expect(await checkbox.isChecked()).toBe(true);

    await toggleLabel.click();
    await page.waitForTimeout(TIMEOUT.SHORT);
    expect(await checkbox.isChecked()).toBe(false);

    await toggleLabel.click();
    await page.waitForTimeout(TIMEOUT.SHORT);
    expect(await checkbox.isChecked()).toBe(true);

    const deleteBtn = scriptRow.getByRole('button', { name: /Delete/i });
    await deleteBtn.click();

    const modal = frame.locator('.modal-content');
    await modal.waitFor({ state: 'visible' });

    const modalDeleteBtn = modal.getByRole('button', { name: /OK/i });
    await modalDeleteBtn.click();

    await expect.poll(async () => scriptRow.isVisible()).toBe(false);
});

test('New script carries the requested match URL into the editor', async () => {
    const target = 'https://example.com/private/*';
    await page.goto(`${getExtensionUrl(extensionId, '/src/options/index.html')}#/options/new?match=${encodeURIComponent(target)}`);
    const frame = page.frameLocator('iframe');
    const editor = frame.locator('.cm-content').first();
    await editor.waitFor({ state: 'visible' });
    await expect.poll(async () => editor.innerText()).toContain(`@match       ${target}`);
});

test('Script console filters scripts by name and state', async () => {
    await page.goto(getExtensionUrl(extensionId, '/src/options/index.html'));
    await page.evaluate(() => chrome.storage.local.set({ scripts: [
        { id: 'alpha', name: 'Alpha Audit', code: '// ==UserScript==\n// @name Alpha Audit\n// @match https://alpha.example/*\n// ==/UserScript==', enabled: true },
        { id: 'beta', name: 'Beta Tool', code: '// ==UserScript==\n// @name Beta Tool\n// @match https://beta.example/*\n// ==/UserScript==', enabled: false }
    ] }));
    await page.reload();
    const frame = page.frameLocator('iframe');
    const search = frame.getByPlaceholder(/Search scripts/i);
    await search.fill('Alpha');
    await expect.poll(() => frame.locator('.script-link').filter({ hasText: 'Alpha Audit' }).isVisible()).toBe(true);
    await expect.poll(() => frame.locator('.script-link').filter({ hasText: 'Beta Tool' }).isVisible()).toBe(false);
    await search.fill('');
    await frame.getByLabel(/Filter by execution status/i).selectOption('disabled');
    await expect.poll(() => frame.locator('.script-link').filter({ hasText: 'Beta Tool' }).isVisible()).toBe(true);
    await expect.poll(() => frame.locator('.script-link').filter({ hasText: 'Alpha Audit' }).isVisible()).toBe(false);
});
