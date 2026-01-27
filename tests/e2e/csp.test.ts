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

test('CSP blocks fetch in background', async () => {
    let serviceWorker = browserContext.serviceWorkers()[0];
    if (!serviceWorker) {
        await new Promise(resolve => setTimeout(resolve, TIMEOUT.MEDIUM));
        serviceWorker = browserContext.serviceWorkers()[0];
    }

    expect(serviceWorker).toBeDefined();

    const result = await serviceWorker.evaluate(async () => {
        try {
            await fetch('https://www.google.com', { method: 'HEAD' });
            return 'success';
        } catch (e) {
            return (e as Error).toString();
        }
    });

    console.log('Fetch result:', result);
    expect(result).toMatch(/TypeError: Failed to fetch|NetworkError/);
});

test('CSP blocks fetch in Options page', async () => {
    const page = await browserContext.newPage();
    await page.goto(getExtensionUrl(extensionId, '/src/options/index.html'));

    const result = await page.evaluate(async () => {
        try {
            await fetch('https://www.google.com');
            return 'success';
        } catch (e) {
            return (e as Error).message;
        }
    });

    console.log('Options Fetch result:', result);
    expect(result).toBe('Failed to fetch');
});

test('CSP blocks external image in Options page', async () => {
    const page = await browserContext.newPage();
    await page.goto(getExtensionUrl(extensionId, '/src/options/index.html'));

    const errorEvent = await page.evaluate(() => {
        return new Promise((resolve) => {
            const img = document.createElement('img');
            img.src = 'https://www.google.com/images/branding/googlelogo/2x/googlelogo_color_272x92dp.png';
            img.onload = () => resolve('loaded');
            img.onerror = () => resolve('error');
            document.body.appendChild(img);
        });
    });

    expect(errorEvent).toBe('error');
});
