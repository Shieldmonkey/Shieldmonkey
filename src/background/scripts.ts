import { parseMetadata } from '../utils/metadataParser';
import { getGMAPIScript } from '../utils/scriptGenerator';
import type { Script } from './types';
import { updateActiveTabBadge } from './badge';
import { triggerBackup } from './backup';
import {
    isUserScriptsAvailable,
    configureUserScriptsWorld,
    getUserScripts,
    unregisterUserScripts,
    registerUserScripts
} from '../utils/browserPolyfill';


export async function reloadAllScripts() {
    if (await isUserScriptsAvailable()) {
        try {
            await configureUserScriptsWorld({
                messaging: true,
            });

            const settings = await chrome.storage.local.get(['extensionEnabled', 'scripts']);
            const extensionEnabled = settings.extensionEnabled !== false;
            const savedScripts = (settings.scripts || []) as Script[];

            if (settings.extensionEnabled === undefined) {
                await chrome.storage.local.set({ extensionEnabled: true });
            }

            try {
                const existing = (await getUserScripts()) as chrome.userScripts.UserScript[];
                const ids = existing.map(s => s.id);
                if (ids.length > 0) {
                    await unregisterUserScripts({ ids });
                }
            } catch (e) {
                console.warn("Failed to unregister existing scripts", e);
            }

            if (extensionEnabled && savedScripts.length > 0) {
                for (const script of savedScripts) {
                    if (!script.enabled) continue;

                    try {
                        const metadata = parseMetadata(script.code);
                        const matches = [...metadata.match, ...metadata.include];
                        const excludes = metadata.exclude;
                        const runAt = metadata['run-at'] || 'document_end';
                        const granted = script.grantedPermissions || [];

                        await registerUserScripts([{
                            id: script.id,
                            matches: matches.length > 0 ? matches : ["<all_urls>"],
                            excludeMatches: excludes,
                            js: [{
                                code: getGMAPIScript({
                                    id: script.id,
                                    name: script.name,
                                    version: metadata.version || '1.0',
                                    permissions: granted,
                                    namespace: metadata.namespace,
                                    description: metadata.description
                                }) + "\n" + script.code
                            }],
                            runAt: runAt as 'document_start' | 'document_end' | 'document_idle',
                            world: 'USER_SCRIPT'
                        }]);
                    } catch (e) {
                        console.error(`Failed to register script ${script.name}:`, e);
                    }
                }
            }

        } catch (err) {
            console.error("Failed to initialize user scripts:", err);
        }
    } else {
        console.error("chrome.userScripts API is not available.");
    }

    await updateActiveTabBadge();
}

export async function handleToggleGlobal(enabled: boolean) {
    await chrome.storage.local.set({ extensionEnabled: enabled });
    await reloadAllScripts();
}

export async function handleSaveScript(script: Script) {
    if (!await isUserScriptsAvailable()) throw new Error("API unavailable");

    // 1. Update in Storage
    const data = await chrome.storage.local.get('scripts');
    const scripts: Script[] = Array.isArray(data.scripts) ? data.scripts : [];
    const index = scripts.findIndex((s) => s.id === script.id);
    const now = Date.now();

    if (index !== -1) {
        const existing = scripts[index];
        script.installDate = existing.installDate || now;
        script.updateDate = now;

        if (script.enabled === undefined) script.enabled = existing.enabled;

        if (!script.grantedPermissions) {
            script.grantedPermissions = existing.grantedPermissions || [];
        }

        if (!script.sourceUrl && existing.sourceUrl) script.sourceUrl = existing.sourceUrl;

        if (!script.referrerUrl && existing.referrerUrl) script.referrerUrl = existing.referrerUrl;

        scripts[index] = script;
    } else {
        // New script
        script.installDate = now;
        script.updateDate = now;
        if (script.enabled === undefined) script.enabled = true;
        if (!script.grantedPermissions) script.grantedPermissions = [];
        scripts.push(script);
    }

    await chrome.storage.local.set({ scripts });

    // 2. Parse metadata
    const metadata = parseMetadata(script.code);
    const matches = [...metadata.match, ...metadata.include];
    const excludes = metadata.exclude;
    const runAt = metadata['run-at'] || 'document_end';

    if (metadata.name) {
        script.name = metadata.name;
    }
    if (metadata.namespace) {
        script.namespace = metadata.namespace;
    }

    if (metadata.grant && Array.isArray(metadata.grant)) {
        script.grantedPermissions = metadata.grant;
    }

    // Enforce uniqueness of name + namespace pair
    let uniqueName = script.name;
    let counter = 1;
    while (true) {
        const conflict = scripts.find((s) =>
            s.id !== script.id &&
            s.name === uniqueName &&
            (s.namespace || '') === (script.namespace || '')
        );
        if (!conflict) break;
        uniqueName = `${script.name} (${counter})`;
        counter++;
    }
    script.name = uniqueName;

    const newIndex = index !== -1 ? index : scripts.length - 1;
    scripts[newIndex] = script;
    await chrome.storage.local.set({ scripts });

    // 3. Register with UserScripts API
    try {
        await unregisterUserScripts({ ids: [script.id] });
    } catch {
        // Ignore error
    }

    if (script.enabled) {
        await registerUserScripts([{
            id: script.id,
            matches: matches.length > 0 ? matches : ["<all_urls>"],
            excludeMatches: excludes,
            js: [{
                code: getGMAPIScript({
                    id: script.id,
                    name: script.name,
                    version: metadata.version || '1.0',
                    permissions: script.grantedPermissions || [],
                    namespace: metadata.namespace,
                    description: metadata.description
                }) + "\n" + script.code
            }],
            runAt: runAt as 'document_start' | 'document_end' | 'document_idle',
            world: 'USER_SCRIPT'
        }]);
    }

    await updateActiveTabBadge();
    triggerBackup();
}

export async function handleToggleScript(scriptId: string, enabled: boolean) {
    if (!await isUserScriptsAvailable()) return;

    const data = await chrome.storage.local.get('scripts');
    const scripts: Script[] = Array.isArray(data.scripts) ? data.scripts : [];
    const script = scripts.find((s) => s.id === scriptId);

    if (script) {
        script.enabled = enabled;
        await chrome.storage.local.set({ scripts });

        if (enabled) {
            const metadata = parseMetadata(script.code);
            const matches = [...metadata.match, ...metadata.include];
            const excludes = metadata.exclude;
            const granted = script.grantedPermissions || [];

            try {
                // Ensure clean state
                await unregisterUserScripts({ ids: [script.id] });
            } catch { /* ignore if not present */ }

            try {
                await registerUserScripts([{
                    id: script.id,
                    matches: matches.length > 0 ? matches : ["<all_urls>"],
                    excludeMatches: excludes,
                    js: [{
                        code: getGMAPIScript({
                            id: script.id,
                            name: script.name,
                            version: metadata.version || '1.0',
                            permissions: granted,
                            namespace: metadata.namespace,
                            description: metadata.description
                        }) + "\n" + script.code
                    }],
                    world: 'USER_SCRIPT'
                }]);
            } catch (e) {
                console.error(`Failed to re-register script ${script.id}:`, e);
            }
        } else {
            await unregisterUserScripts({ ids: [scriptId] });
        }
        await updateActiveTabBadge();
        triggerBackup();
    }
}

export async function handleDeleteScript(scriptId: string) {
    if (!await isUserScriptsAvailable()) return;

    const data = await chrome.storage.local.get('scripts');
    const scripts: Script[] = Array.isArray(data.scripts) ? data.scripts : [];
    const newScripts = scripts.filter((s) => s.id !== scriptId);
    await chrome.storage.local.set({ scripts: newScripts });

    await unregisterUserScripts({ ids: [scriptId] });
    await updateActiveTabBadge();
    triggerBackup();
}
