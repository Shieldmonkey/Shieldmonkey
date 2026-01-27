import { test, expect } from 'vitest';
import { launchExtension, TIMEOUT, getExtensionUrl } from './test-utils';
import { BrowserContext, Page } from 'playwright';
import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import path from 'path';
import fs from 'fs';

let browserContext: BrowserContext;
let page: Page;
let extensionId: string;
let server: FastifyInstance;

const TEST_SERVER_PORT = 4321;

test.beforeAll(async () => {
    server = Fastify();

    server.get('/test.user.js', async (_request: FastifyRequest, reply: FastifyReply) => {
        const content = fs.readFileSync(
            path.join(process.cwd(), 'tests/fixtures/test.user.js'),
            'utf-8'
        );
        reply.type('application/javascript').send(content);
    });

    await server.listen({ port: TEST_SERVER_PORT });
});

test.afterAll(async () => {
    await server.close();
});

test.beforeEach(async () => {
    const context = await launchExtension();
    browserContext = context.browserContext;
    page = context.page;
    extensionId = context.extensionId;
});

test.afterEach(async () => {
    await browserContext.close();
});

test('Install from .user.js URL', async () => {
    const scriptUrl = `https://gist.github.com/toshs/2a9c3090277fc51c8c9d8a9d483cddc1/raw/4f59b6086120e421c3b6bf8493a7acab3ea449dc/test1.user.js`;

    try {
        await page.goto(scriptUrl);
    } catch {
        // Navigation is aborted by webNavigation.onBeforeRequest
    }

    page = await browserContext.newPage();
    await page.waitForTimeout(TIMEOUT.VERY_LONG);

    const installPage = browserContext.pages().find(p => p.url().includes('install'));
    if (!installPage) {
        throw new Error('Install page not found');
    }
    page = installPage;

    await page.waitForURL(/.*install.*/, { timeout: TIMEOUT.VERY_LONG });
    expect(page.url()).toMatch(/.*install.*/);

    const installBtn = page.getByRole('button', { name: /Install/i });
    await installBtn.waitFor({ state: 'visible' });
    await installBtn.click();

    await page.goto(getExtensionUrl(extensionId, '/src/options/index.html'));

    const rows = page.locator('table tbody tr');
    expect(await rows.count()).toBe(1);
});
