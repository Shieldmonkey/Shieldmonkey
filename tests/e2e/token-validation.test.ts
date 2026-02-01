import { test, expect } from 'vitest';
import { launchExtension, TIMEOUT, installScriptFromPath } from './test-utils';
import type { BrowserContext, Page } from 'playwright';
import path from 'path';

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

test('Token Validation: Script should lose access if token changes in background', async () => {
    const scriptsDir = path.join(process.cwd(), 'tests/fixtures/userscripts');
    const scriptPath = path.join(scriptsDir, 'token_validation.user.js');

    await installScriptFromPath(page, extensionId, scriptPath);

    const logs: string[] = [];

    // Debug helper
    page.on('console', msg => logs.push(`[ADMIN PAGE]: ${msg.text()}`));

    const testPage = await browserContext.newPage();
    testPage.on('console', msg => logs.push(msg.text()));

    await testPage.goto('https://shieldmonkey.github.io/Shieldmonkey/');
    await testPage.waitForTimeout(TIMEOUT.LONG);

    // 1. Verify initial success
    const initialPass = logs.find(l => l.includes('[PASS] Initial GM_setValue/getValue success'));
    expect(initialPass).toBeDefined();

    // 2. Invalidate token in background
    await page.evaluate(async () => {
        const data = await chrome.storage.local.get('scripts');
        const scripts = (data.scripts || []) as { name?: string; token?: string }[];
        const script = scripts.find((s) => s.name && s.name.includes("token_validation"));
        if (script) {
            script.token = "NEW_TOKEN_" + Date.now();
            await chrome.storage.local.set({ scripts });
            console.log("Token invalidated in storage");
        } else {
            console.log("Script not found in storage. Available scripts: " + scripts.map((s) => s.name).join(", "));
        }
    });

    // 3. Try GM call again from the test page
    await testPage.evaluate(() => {
        window.dispatchEvent(new CustomEvent('TryGMCall'));
    });

    await testPage.waitForTimeout(TIMEOUT.MEDIUM);

    // 4. Verify failure
    const expectedFail = logs.find(l => l.includes('[PASS] GM_setValue failed as expected'));
    const unexpectedSuccess = logs.find(l => l.includes('[UNEXPECTED] GM_setValue succeeded'));

    if (!expectedFail) {
        // Write logs to file for debugging
        const fs = await import('fs');
        fs.writeFileSync('test-logs.json', JSON.stringify(logs, null, 2));
    }

    expect(unexpectedSuccess).toBeUndefined();
    expect(expectedFail).toBeDefined();
});
