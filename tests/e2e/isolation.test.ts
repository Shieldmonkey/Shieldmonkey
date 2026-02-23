import { test, expect } from 'vitest';
import { launchExtension, TIMEOUT, injectScriptToStorage } from './test-utils';
import type { BrowserContext } from 'playwright';
import path from 'path';

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

test('Userscript Isolation: Script A should not see variable from Script B', async () => {
    const scriptsDir = path.join(process.cwd(), 'tests/fixtures/userscripts');
    const scriptAPath = path.join(scriptsDir, 'isolation_test_A.user.js');
    const scriptBPath = path.join(scriptsDir, 'isolation_test_B.user.js');

    // We need an extension page to inject scripts
    const optionsPage = await browserContext.newPage();
    await optionsPage.goto(`chrome-extension://${extensionId}/src/options/index.html`);

    await injectScriptToStorage(optionsPage, scriptAPath);
    await injectScriptToStorage(optionsPage, scriptBPath);

    await optionsPage.close();

    // Open a page where both scripts run
    const testPage = await browserContext.newPage();

    // Capture logs to verify isolation
    const logs: string[] = [];
    testPage.on('console', msg => logs.push(msg.text()));

    // Using data: URL or any page that matches <all_urls>
    await testPage.goto('https://shieldmonkey.github.io/Shieldmonkey/');
    await testPage.waitForTimeout(TIMEOUT.LONG);

    // Verify Script A ran (check DOM marker)
    await testPage.locator('#test-a-marker').waitFor({ state: 'visible', timeout: 5000 });

    // Verify Script B ran (check DOM marker)
    await testPage.locator('#test-b-marker').waitFor({ state: 'visible', timeout: 5000 });

    // isolation_test_A sets window.SHIELD_TEST_A
    // isolation_test_B checks window.SHIELD_TEST_A and logs SUCCESS/FAIL

    const successLog = logs.find(l => l.includes('SUCCESS: I cannot see window.SHIELD_TEST_A'));
    const failLog = logs.find(l => l.includes('FAIL: I can see window.SHIELD_TEST_A'));

    if (!successLog && !failLog) {
        console.error('Missing expected logs. Captured:', logs);
    } else if (failLog) {
        console.error('Found FAIL log:', failLog);
        console.error('All Logs:', logs);
    }

    expect(failLog).toBeUndefined();
    expect(successLog).toBeDefined();
});

test('Origin Isolation: Script running on Origin A should not affect Origin B', async () => {
    // This test verifies that if we install a script that runs on all URLs (or specific ones),
    // modifications made on one origin do not leak to another via the browser's window object.
    // This is standard browser behavior, but we verify our injection doesn't break it.

    const scriptsDir = path.join(process.cwd(), 'tests/fixtures/userscripts');
    // We use isolation_test_A which sets window.SHIELD_TEST_A
    const scriptPath = path.join(scriptsDir, 'isolation_test_A.user.js');
    // We need an extension page to inject
    const optionsPage = await browserContext.newPage();
    await optionsPage.goto(`chrome-extension://${extensionId}/src/options/index.html`);
    await injectScriptToStorage(optionsPage, scriptPath);
    await optionsPage.close();

    const pageA = await browserContext.newPage();
    const pageB = await browserContext.newPage();

    // 1. Visit Origin A (shieldmonkey.github.io)
    await pageA.goto('https://shieldmonkey.github.io/Shieldmonkey/');

    // 2. Visit Origin B (example.com)
    await pageB.goto('https://example.com');

    // 3. Check if variable leaked to B (it shouldn't)

    const valB = await pageB.evaluate(() => (window as unknown as { SHIELD_TEST_A: unknown }).SHIELD_TEST_A);
    expect(valB).toBeUndefined();
});
