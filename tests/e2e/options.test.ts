import { test, expect } from 'vitest';
import { launchExtension, getExtensionUrl, clearAllScripts, TIMEOUT } from './test-utils';
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

test('Options page - Install, Save, and Delete User Script', async () => {
    await page.goto(getExtensionUrl(extensionId, '/src/options/index.html'));
    await clearAllScripts(page);

    const title = await page.title();
    expect(title).toMatch(/Shieldmonkey/i);

    const newScriptBtn = page.getByRole('button', { name: /New Script/i, exact: false });
    await newScriptBtn.waitFor({ state: 'visible' });
    await newScriptBtn.click();

    await page.waitForURL(/.*#\/scripts\/.+/);
    expect(page.url()).toMatch(/.*#\/scripts\/.+/);

    const editor = page.locator('.monaco-editor').first();
    await editor.click();

    await page.keyboard.press('End');
    await page.keyboard.type(' // Edited by test');

    const saveBtn = page.getByRole('button', { name: /Save/i });
    await expect.poll(async () => saveBtn.isEnabled()).toBe(true);
    await saveBtn.click();

    const currentUrl = page.url();
    const scriptIdMatch = currentUrl.match(/#\/scripts\/(.+)/);
    const scriptId = scriptIdMatch ? scriptIdMatch[1] : null;
    expect(scriptId).toBeTruthy();

    const backBtn = page.locator('[title="Back to Script List"]');
    await backBtn.waitFor({ state: 'visible' });
    await backBtn.click();

    const scriptRow = page.getByRole('row').filter({ hasText: 'New Script' }).first();
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

    const modal = page.locator('.modal-content');
    await modal.waitFor({ state: 'visible' });

    const modalDeleteBtn = modal.getByRole('button', { name: /OK/i });
    await modalDeleteBtn.click();

    await expect.poll(async () => scriptRow.isVisible()).toBe(false);
});
