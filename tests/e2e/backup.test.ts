import { test, expect } from 'vitest';
import { launchExtension, getExtensionUrl, TIMEOUT } from './test-utils';
import { BrowserContext } from 'playwright';

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

function createMockFileSystemHandle() {
    return `
        const mockBackupData = {
            timestamp: new Date().toISOString(),
            version: '1.0',
            scripts: [{
                id: 'restored-script',
                name: 'Restored Script',
                code: '// restored',
                enabled: true
            }]
        };

        const mockHandle = {
            kind: 'directory',
            name: 'mock-backup-dir',
            getFileHandle: async (name, options) => ({
                kind: 'file',
                name: name,
                createWritable: async () => ({
                    write: async (content) => {
                        console.log('[MOCK] Writing to ' + name);
                        window._lastWrittenFile = { name, content };
                    },
                    close: async () => {}
                }),
                getFile: async () => new Blob([JSON.stringify(mockBackupData)], { type: 'application/json' })
            }),
            getDirectoryHandle: async (name, options) => ({
                kind: 'directory',
                name: name,
                entries: async function* () {},
                removeEntry: async () => {},
                getFileHandle: async (fileName, opts) => ({
                    kind: 'file',
                    name: fileName,
                    createWritable: async () => ({
                        write: async () => {},
                        close: async () => {}
                    }),
                    getFile: async () => new Blob([JSON.stringify(mockBackupData)], { type: 'application/json' })
                })
            }),
            queryPermission: async () => 'granted',
            requestPermission: async () => 'granted',
            values: async function* () {
                yield { kind: 'file', name: 'shieldmonkey_dump.json' };
            }
        };

        window.showDirectoryPicker = async () => {
            console.log('[MOCK] showDirectoryPicker called');
            return mockHandle;
        };

        window.__mockBackupDirectoryHandle = mockHandle;
    `;
}

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
