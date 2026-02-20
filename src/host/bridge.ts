import { handleSelectBackupDir, handleGetBackupDirName, handleRunBackup, handleRunRestore } from './backupHandlers';
import { processScriptContent } from '../utils/importManager';

async function handleImportFile() {
    if (!('showOpenFilePicker' in window)) {
        throw new Error("File picker not supported in this browser");
    }
    try {
        const handles = await window.showOpenFilePicker({
            types: [{ description: 'User Scripts', accept: { 'text/javascript': ['.user.js', '.js'] } }],
            multiple: true
        });
        const scripts = [];
        for (const handle of handles) {
            const file = await handle.getFile();
            const text = await file.text();
            scripts.push(await processScriptContent(text));
        }
        return scripts;
    } catch (e: unknown) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((e as any).name === 'AbortError') return [];
        throw e;
    }
}

async function handleImportDirectory() {
    if (!('showDirectoryPicker' in window)) {
        throw new Error("Directory picker not supported in this browser");
    }
    try {
        const dirHandle = await window.showDirectoryPicker();
        const scripts = [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for await (const [name, entry] of (dirHandle as any).entries()) {
            if (entry.kind === 'file' && (name.endsWith('.user.js') || name.endsWith('.js'))) {
                const file = await (entry as FileSystemFileHandle).getFile();
                const text = await file.text();
                if (text.includes('==UserScript==')) {
                    scripts.push(await processScriptContent(text));
                }
            }
        }
        return scripts;
    } catch (e: unknown) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((e as any).name === 'AbortError') return [];
        throw e;
    }
}
async function triggerAutoBackup() {
    console.log("Bridge: triggerAutoBackup initiated");
    try {
        const { autoBackup, scripts } = await chrome.storage.local.get(['autoBackup', 'scripts']);
        if (autoBackup && Array.isArray(scripts)) {
            const version = chrome.runtime.getManifest().version;
            // Filter for valid objects
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const scriptsToBackup = (scripts as any[]).filter(s => typeof s === 'object');
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await handleRunBackup(scriptsToBackup as any[], version);
            // Update last backup time? Could do here or in handleRunBackup. 
            // background logic did it, maybe we should message background? 
            // Or sets directly to storage since we have permission.
            await chrome.storage.local.set({ lastBackupTime: new Date().toISOString() });
        }
    } catch (e) {
        console.error("Auto-backup failed in host:", e);
    }
}

export function initBridge() {
    window.addEventListener('message', async (event: MessageEvent) => {
        // Usage: <iframe src="src/sandbox/index.html">
        // If it's a normal iframe in an extension page, it shares the origin. 
        // If we want to strictly sandbox it, we might use the manifest "sandbox" key, which gives it a unique origin.

        const data = event.data;
        if (!data || !data.id || !data.type) return;

        const { id, type, payload } = data;
        let result: unknown = null;
        let error: string | undefined = undefined;

        try {
            switch (type) {
                case 'GET_SETTINGS': {
                    const keys = ['scripts', 'theme', 'extensionEnabled', 'locale', 'lastBackupTime', 'autoBackup'];
                    result = await chrome.storage.local.get(keys);
                    break;
                }
                case 'UPDATE_THEME':
                    await chrome.storage.local.set({ theme: payload });
                    break;
                case 'UPDATE_LOCALE':
                    await chrome.storage.local.set({ locale: payload });
                    break;
                case 'TOGGLE_GLOBAL':
                    await chrome.storage.local.set({ extensionEnabled: payload });
                    break;
                case 'UPDATE_BACKUP_SETTINGS':
                    await chrome.storage.local.set(payload);
                    break;
                case 'GET_APP_INFO':
                    result = { version: chrome.runtime.getManifest().version };
                    break;
                case 'UPDATE_SCRIPTS':
                    await chrome.storage.local.set({ scripts: payload });
                    break;
                case 'TOGGLE_SCRIPT':
                    // We need to forward this to background
                    await chrome.runtime.sendMessage({ type: 'TOGGLE_SCRIPT', scriptId: payload.scriptId, enabled: payload.enabled });
                    triggerAutoBackup();
                    break;
                case 'DELETE_SCRIPT':
                    await chrome.runtime.sendMessage({ type: 'DELETE_SCRIPT', scriptId: payload.scriptId });
                    triggerAutoBackup();
                    break;
                case 'SAVE_SCRIPT':
                    await chrome.runtime.sendMessage({ type: 'SAVE_SCRIPT', script: payload });
                    triggerAutoBackup();
                    break;
                case 'RELOAD_SCRIPTS':
                    await chrome.runtime.sendMessage({ type: 'RELOAD_SCRIPTS' });
                    break;
                case 'OPEN_DASHBOARD':
                    chrome.tabs.create({ url: chrome.runtime.getURL('src/options/index.html' + (payload?.path || '')), active: true });
                    // Close popup to ensure focus on the new tab, especially on mobile
                    window.close();
                    break;
                case 'OPEN_URL':
                    chrome.tabs.create({ url: payload });
                    break;
                case 'GET_CURRENT_TAB_URL': {
                    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                    result = tab?.url;
                    break;
                }
                case 'GET_I18N_MESSAGE':
                    // payload is { key, substitutions }
                    result = chrome.i18n.getMessage(payload.key, payload.substitutions);
                    break;
                case 'START_INSTALL_FLOW':
                    await chrome.runtime.sendMessage({ type: 'START_INSTALL_FLOW', url: payload.url, referrer: payload.referrer });
                    break;
                case 'FETCH_SCRIPT':
                    // Forward to background using runtime.sendMessage
                    result = await chrome.runtime.sendMessage({ type: 'FETCH_SCRIPT_CONTENT', url: payload.url, referrer: payload.referrer });
                    break;
                case 'GET_PENDING_INSTALL': {
                    const key = `pending_install_${payload.id}`;
                    const data = await chrome.storage.local.get(key);
                    result = data[key];
                    break;
                }
                case 'CLEAR_PENDING_INSTALL': {
                    const key = `pending_install_${payload.id}`;
                    await chrome.storage.local.remove(key);
                    break;
                }
                case 'SELECT_BACKUP_DIR':
                    result = await handleSelectBackupDir();
                    break;
                case 'GET_BACKUP_DIR_NAME':
                    result = await handleGetBackupDirName();
                    break;
                case 'RUN_BACKUP':
                    // payload: { scripts, version }
                    result = await handleRunBackup(payload.scripts, payload.version);
                    break;
                case 'RUN_RESTORE':
                    // payload: { scripts }
                    result = await handleRunRestore(payload.scripts);
                    break;
                case 'CHECK_USER_SCRIPTS_PERMISSION':
                    // Check if API exists and permission is granted
                    // In some browsers/configurations, API might be visible only after checking permissions?
                    // But generally, check permission first.
                    try {
                        const hasPermission = await chrome.permissions.contains({ permissions: ['userScripts'] });
                        // If we have permission, we hope the API is available. 
                        // If not available despite permission, likely platform not supported or needs restart.
                        // But returning false prompts the user to "Fix / Grant", which is correct flow.
                        // If API is available, we assume permission is implicitly okay (or we verify it).
                        if (chrome.userScripts) {
                            result = true;
                        } else {
                            // API missing. Is permission granted?
                            // If yes, returning false might be confusing if re-requesting doesn't fix it.
                            // But usually it means we need to grant it.
                            result = hasPermission && !!chrome.userScripts;

                            // Fallback: If hasPermission is true but API is missing, maybe return false to trigger help?
                            // Let's stick to safe check: both must be true-ish.
                            if (hasPermission && !chrome.userScripts) {
                                console.warn("Permission 'userScripts' is granted but API is undefined.");
                                result = false;
                            } else {
                                result = hasPermission;
                            }
                        }
                    } catch (e) {
                        console.error("Permission check failed", e);
                        result = false;
                    }
                    break;
                case 'REQUEST_USER_SCRIPTS_PERMISSION':
                    // Must be called from a user gesture (clicking the button in iframe -> postMessage -> here)
                    // postMessage handling usually counts as user gesture if immediate.
                    try {
                        result = await chrome.permissions.request({ permissions: ['userScripts'] });
                    } catch (e) {
                        console.error("Permission request failed", e);
                        result = false;
                    }
                    break;
                case 'OPEN_EXTENSION_SETTINGS': {
                    // We can check user agent here or just default to ID for desktops
                    // Simple check for mobile logic if needed, or just try getting ID
                    // If isMobile check is complex, we can just use chrome://extensions/ generally?
                    // But for specific extension settings on desktop, `?id=` is better.
                    const isMob = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
                    const extUrl = isMob ? 'chrome://extensions/' : `chrome://extensions/?id=${chrome.runtime.id}`;
                    chrome.tabs.create({ url: extUrl, active: true });
                    window.close();
                    break;
                }
                case 'CLOSE_TAB': {
                    // Close the current tab (host page)
                    try {
                        // For extension pages, getCurrent returns the tab
                        const currentTab = await chrome.tabs.getCurrent();
                        if (currentTab && currentTab.id) {
                            await chrome.tabs.remove(currentTab.id);
                        } else {
                            // Fallback for some contexts or if queried purely
                            const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
                            if (activeTab && activeTab.id) {
                                await chrome.tabs.remove(activeTab.id);
                            } else {
                                window.close();
                            }
                        }
                    } catch (e) {
                        console.error('Failed to close tab via bridge', e);
                        window.close();
                    }
                    break;
                }
                case 'IMPORT_FILE':
                    result = await handleImportFile();
                    break;
                case 'IMPORT_DIRECTORY':
                    result = await handleImportDirectory();
                    break;
                default:
                    error = `Unknown action type: ${type}`;
            }
        } catch (e: unknown) {
            error = (e as Error).message || 'Unknown error';
        }

        if (event.source && (event.source as WindowProxy).postMessage) {
            // Target origin must be '*' because the sandboxed iframe has a null origin
            (event.source as WindowProxy).postMessage({ id, result, error }, '*');
        }
    });

    // Forward storage changes
    chrome.storage.onChanged.addListener((changes, areaName) => {
        const iframe = document.querySelector('iframe');
        if (iframe && iframe.contentWindow) {
            iframe.contentWindow.postMessage({
                type: 'STORAGE_CHANGED',
                changes,
                areaName
            }, '*');
        }
    });
}
