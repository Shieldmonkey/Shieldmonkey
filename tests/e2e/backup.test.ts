import { test, expect } from 'vitest';
import { launchExtension, getExtensionUrl, TIMEOUT } from './test-utils';
import type { BrowserContext } from 'playwright';

let browserContext: BrowserContext;
let extensionId: string;

test.beforeEach(async () => {
    const context = await launchExtension();
    browserContext = context.browserContext;
    extensionId = context.extensionId;
});

test.afterEach(async () => {
    await browserContext.close();
});

import { createMockFileSystemHandle } from './test-utils';

test('Backup and Restore Logic', async () => {
    const newPage = await browserContext.newPage();
    await newPage.addInitScript(createMockFileSystemHandle());
    await newPage.goto(getExtensionUrl(extensionId, '/src/options/index.html#/settings'));

    // Wait for page to fully initialize, especially on first run
    await newPage.waitForTimeout(TIMEOUT.MEDIUM);

    const selectBtn = newPage.getByRole('button', { name: /Select$/i });
    await selectBtn.waitFor({ state: 'visible' });
    await selectBtn.click();

    await expect.poll(async () => newPage.getByText('mock-backup-dir').isVisible(), { timeout: 10000 }).toBe(true);

    const backupBtn = newPage.getByRole('button', { name: /Backup Now/i });
    await backupBtn.click();

    await expect.poll(async () => newPage.getByText(/Saved \d+ scripts/).isVisible()).toBe(true);

    const restoreBtn = newPage.getByRole('button', { name: /Select Directory & Restore/i });
    await restoreBtn.click();

    const modal = newPage.locator('.modal-content');
    await modal.waitFor({ state: 'visible' });

    const confirmBtn = modal.getByRole('button', { name: /OK/i });
    await confirmBtn.click();

    await newPage.waitForTimeout(TIMEOUT.VERY_LONG);

    await newPage.goto(getExtensionUrl(extensionId, '/src/options/index.html#/scripts'));
    await expect.poll(async () => newPage.getByText('Restored Script').isVisible()).toBe(true);
});
