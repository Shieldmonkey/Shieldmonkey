import { test, expect } from 'vitest';
import { launchExtension, TIMEOUT, installScriptFromPath } from './test-utils';
import { BrowserContext, Page } from 'playwright';
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

test('API Permissions: Unauthorized GM_ calls should fail and Runtime access restricted', async () => {
    const scriptsDir = path.join(process.cwd(), 'tests/fixtures/userscripts');
    const scriptPath = path.join(scriptsDir, 'gm_permission_violation.user.js');

    await installScriptFromPath(page, extensionId, scriptPath);

    const testPage = await browserContext.newPage();
    const logs: string[] = [];
    testPage.on('console', msg => logs.push(msg.text()));

    await testPage.goto('https://shieldmonkey.github.io/Shieldmonkey/');
    // Wait for tests to run
    await testPage.waitForTimeout(TIMEOUT.LONG);

    // Check logs for specific outputs from gm_permission_violation.user.js

    // Test 1: GM_xmlhttpRequest should be undefined (PASS)
    const passUndefined = logs.find(l => l.includes('[PASS] GM_xmlhttpRequest is undefined'));
    expect(passUndefined).toBeDefined();

    // Test 2: Runtime Message Passing
    // The script attempts to send a message to background to execute GM_xmlhttpRequest
    // It should be denied or fail.

    const passDenied = logs.find(l => l.includes('[PASS] Background denied request') || l.includes('Runtime Error'));
    // Or if runtime is not available at all
    const passNoRuntime = logs.find(l => l.includes('chrome.runtime.sendMessage NOT available'));

    const failEscalation = logs.find(l => l.includes('[FAIL] ESCALATION SUCCESSFUL'));

    if (failEscalation) {
        console.error('Critical Security Failure: Script was able to escalate privileges!');
        console.error('Logs:', logs);
    }

    expect(failEscalation).toBeUndefined();
    expect(passDenied || passNoRuntime).toBeDefined();
});
