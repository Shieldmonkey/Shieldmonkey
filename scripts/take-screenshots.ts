import { chromium } from 'playwright';
import { existsSync, mkdirSync, rmSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EXTENSION_PATH = path.join(__dirname, '../dist');
const SCREENSHOT_DIR = path.join(__dirname, '../screenshots');

// Chrome Web Store dimensions
const STORE_WIDTH = 1280;
const STORE_HEIGHT = 800;

async function runForTheme(theme: 'light' | 'dark') {
    const userDataDir = path.join(__dirname, `../test-user-data-screenshots-${theme}`);
    if (existsSync(userDataDir)) {
        rmSync(userDataDir, { recursive: true, force: true });
    }

    // Launch with extension
    const browserContext = await chromium.launchPersistentContext(userDataDir, {
        headless: false,
        locale: 'en-US',
        colorScheme: theme,
        args: [
            `--disable-extensions-except=${EXTENSION_PATH}`,
            `--load-extension=${EXTENSION_PATH}`,
            '--headless=new'
        ],
        viewport: { width: STORE_WIDTH, height: STORE_HEIGHT }
    });

    const page = await browserContext.newPage();

    // Give background worker time to initialize
    await new Promise(r => setTimeout(r, 1500));

    // Find extension ID
    let extensionId = '';
    const serviceWorkers = browserContext.serviceWorkers();
    if (serviceWorkers.length > 0) {
        const url = serviceWorkers[0].url();
        const match = url.match(/chrome-extension:\/\/([a-z0-9]+)/);
        if (match) extensionId = match[1];
    }

    if (!extensionId) {
        console.error(`[${theme}] Could not find extension ID. Ensure you have built the extension (npm run build) first.`);
        await browserContext.close();
        return;
    }

    console.log(`[${theme}] Extension ID: ${extensionId}`);

    // Create a mock script so the dashboard isn't empty
    await page.goto(`chrome-extension://${extensionId}/src/options/index.html`);
    await page.waitForTimeout(500);

    await page.evaluate((evalTheme) => {
        chrome.storage.local.set({
            theme: evalTheme,
            scripts: [{
                id: 'mock-script-1',
                name: 'Readability Enhancer',
                code: `// ==UserScript==
// @name         Readability Enhancer
// @namespace    http://shieldmonkey.io/
// @version      1.0
// @description  Improves readability of Wikipedia articles 
// @author       Shieldmonkey
// @match        *://*.wikipedia.org/*
// @grant        GM_addStyle
// ==/UserScript==

(function() {
    'use strict';
    // Increase line height and font size for better reading
    GM_addStyle(\`
        body {
            font-size: 18px !important;
            line-height: 1.8 !important;
        }
        #content {
            max-width: 800px;
            margin: 0 auto;
        }
    \`);
})();`,
                enabled: true,
                grantedPermissions: []
            }]
        });
    }, theme);

    // Add custom styles to hide scrollbars for cleaner screenshots
    const hideScrollbars = `
        ::-webkit-scrollbar {
            display: none;
        }
        * {
            -ms-overflow-style: none; /* IE and Edge */
            scrollbar-width: none; /* Firefox */
        }
    `;

    const injectStyles = async () => {
        await page.addStyleTag({ content: hideScrollbars });
    };

    // 1. Dashboard screenshot
    await page.goto(`chrome-extension://${extensionId}/src/options/index.html#/options/scripts`);
    await injectStyles();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${theme}-01-dashboard.png`) });
    console.log(`Saved ${theme}-01-dashboard.png`);

    // 2. Editor screenshot
    await page.goto(`chrome-extension://${extensionId}/src/options/index.html#/options/scripts/mock-script-1`);
    await injectStyles();
    // Wait for the CodeMirror editor to initialize
    await page.waitForSelector('.cm-editor', { timeout: 5000 }).catch(() => { });
    await page.waitForTimeout(1500); // Extra time for syntax highlighting to render
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${theme}-02-editor.png`) });
    console.log(`Saved ${theme}-02-editor.png`);

    // 3. Settings screenshot
    await page.goto(`chrome-extension://${extensionId}/src/options/index.html#/options/settings`);
    await injectStyles();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${theme}-03-settings.png`) });
    console.log(`Saved ${theme}-03-settings.png`);

    // 4. Popup screenshot
    // Increase viewport width from 350 to 450 to prevent clipping
    await page.goto(`chrome-extension://${extensionId}/src/popup/index.html`);
    await injectStyles();
    await page.setViewportSize({ width: 450, height: 600 });
    await page.waitForTimeout(1000);

    // Save raw popup
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${theme}-04-popup-raw.png`) });
    console.log(`Saved ${theme}-04-popup-raw.png`);

    await browserContext.close();

    // Cleanup
    if (existsSync(userDataDir)) {
        try {
            rmSync(userDataDir, { recursive: true, force: true });
        } catch (e) {
            console.error(`Failed to cleanup temp profile for ${theme}:`, e);
        }
    }
}

async function run() {
    if (!existsSync(SCREENSHOT_DIR)) {
        mkdirSync(SCREENSHOT_DIR);
    }

    await runForTheme('dark');
    await runForTheme('light');

    console.log('Done! Screenshots are in the', SCREENSHOT_DIR, 'directory.');
}

run().catch(console.error);
