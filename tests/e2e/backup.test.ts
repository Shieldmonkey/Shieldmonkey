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

    const frame = newPage.frameLocator('iframe');

    const selectBtn = frame.getByRole('button', { name: /Select$/i });
    await selectBtn.waitFor({ state: 'visible' });
    await selectBtn.click();

    await expect.poll(async () => frame.getByText('mock-backup-dir').isVisible(), { timeout: 10000 }).toBe(true);

    const backupBtn = frame.getByRole('button', { name: /Backup Now/i });
    await backupBtn.click();

    await expect.poll(async () => frame.getByText(/Saved \d+ scripts/).isVisible()).toBe(true);

    const restoreBtn = frame.getByRole('button', { name: /Select Directory & Restore/i });
    await restoreBtn.click();

    const modal = frame.locator('.modal-content');
    await modal.waitFor({ state: 'visible' });

    const confirmBtn = modal.getByRole('button', { name: /OK/i });
    await confirmBtn.click();

    await newPage.waitForTimeout(TIMEOUT.VERY_LONG);

    await newPage.goto(getExtensionUrl(extensionId, '/src/options/index.html#/scripts'));

    // Scripts list is also in iframe
    const scriptsFrame = newPage.frameLocator('iframe');
    await expect.poll(async () => scriptsFrame.getByText('Restored Script').isVisible()).toBe(true);
});
