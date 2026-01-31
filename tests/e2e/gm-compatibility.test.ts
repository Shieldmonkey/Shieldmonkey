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
}, 60000);

test.afterEach(async () => {
    await browserContext.close();
});

test('GM API Compatibility: block restricted APIs and support window features', async () => {
    const scriptsDir = path.join(process.cwd(), 'tests/fixtures/userscripts');
    const scriptPath = path.join(scriptsDir, 'gm_compatibility_test.user.js');

    await installScriptFromPath(page, extensionId, scriptPath);

    const testPage = await browserContext.newPage();
    const logs: string[] = [];
    testPage.on('console', msg => logs.push(msg.text()));

    // Visit a page to run the script
    await testPage.goto('https://shieldmonkey.github.io/Shieldmonkey/');
    await testPage.waitForTimeout(TIMEOUT.LONG);

    // 1. GM_xmlhttpRequest should be blocked/unsupported
    const xhrBlocked = logs.find(l => l.includes('[PASS] GM_xmlhttpRequest blocked'));
    expect(xhrBlocked).toBeDefined();

    // 2. GM_setValue should work (or fail if permission missing, but
    // 3. Storage tests
    // Wait for logs to appear using poll
    await expect.poll(() => logs.find(l => l.includes('Storage') && l.includes('PASS'))).toBeDefined();

    // 3. window.onurlchange
    // Trigger URL change
    await testPage.evaluate(() => {
        history.pushState({}, '', '/test-url-change');
    });
    // Wait for event
    await testPage.waitForTimeout(1000);
    const urlChanged = logs.find(l => l.includes('[PASS] onurlchange fired'));
    expect(urlChanged).toBeDefined();

    // 3. Storage tests (Sync & Async)
    // Legacy async handling for test stability if needed, but we want to test sync now
    await testPage.evaluate(() => {
        window.postMessage('SET_STORAGE', '*');
    });

    // Wait for storage set
    await testPage.waitForTimeout(500);



    // 4. GM_addValueChangeListener test
    // Already in the fixture? We need to update fixture to test this explicitly.

    // 5. window.close (GM_closeTab)
    const initialPages = browserContext.pages().length;



    await testPage.evaluate(() => {
        window.postMessage('TRIGGER_CLOSE', '*');
    });

    // Wait for tab to close
    // Polling for page count checking
    await expect.poll(async () => browserContext.pages().length).toBeLessThan(initialPages);

    const finalPages = browserContext.pages().length;
    expect(finalPages).toBeLessThan(initialPages);
});
