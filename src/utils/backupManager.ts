import { getDirectoryHandle, verifyPermission } from './backupStorage';

interface Script {
    id: string;
    name: string;
    code: string;
    enabled?: boolean;
    lastSavedCode?: string;
    grantedPermissions?: string[];
    updateUrl?: string;
    downloadUrl?: string;
    sourceUrl?: string;
    namespace?: string;
    installDate?: number;
}

export async function performBackup(existingHandle?: FileSystemDirectoryHandle): Promise<number> {
    let handle = existingHandle;
    if (!handle) {
        handle = await getDirectoryHandle();
    }
    if (!handle) {
        throw new Error("No backup directory configured.");
    }

    // Check permission using verifyPermission which handles 'prompt' by requesting permission
    // This allows recovery if called from UI (User Gesture).
    // If called from background without gesture, it might throw "User activation required".
    try {
        const hasPerm = await verifyPermission(handle, true);
        if (!hasPerm) {
            throw new Error("Permission denied or not granted.");
        }
    } catch (e) {
        // Check for lack of user gesture (background case)
        const err = e as Error;
        const isInteractionError = err.name === 'SecurityError' ||
            err.message.includes('activation') ||
            err.message.includes('gesture');

        if (isInteractionError) {
            // In background, we can't prompt. Notify user.
            if (!existingHandle && chrome.notifications && chrome.runtime.id) {
                chrome.notifications.create({
                    type: 'basic',
                    iconUrl: '/icons/icon48.png',
                    title: 'Shieldmonkey Backup Issue',
                    message: 'Backup permission lost. Please click "Backup Now" in Settings to re-grant.',
                    priority: 2
                });
            }
            throw new Error("Permission is 'prompt' (requires user interaction). Please use 'Backup Now' in Settings.");
        }
        throw e;
    }

    const scripts = await new Promise<Script[]>((resolve) => {
        chrome.storage.local.get(['scripts'], (result) => {
            resolve((result.scripts as Script[]) || []);
        });
    });

    // Create or get 'scripts' directory
    const scriptsDirHandle = await handle.getDirectoryHandle('scripts', { create: true });

    // Helper: Collect existing files to check for renames
    const existingFiles: string[] = [];

    for await (const [name, entry] of scriptsDirHandle.entries()) {
        if (entry.kind === 'file' && name.endsWith('.user.js')) {
            existingFiles.push(name);
        }
    }

    for (const script of scripts) {
        // Sanitize name for filename
        const safeName = script.name.replace(/[^a-z0-9\-_]/gi, '_').replace(/_{2,}/g, '_');
        // Append ID to ensure uniqueness if names collide
        const idSuffix = `_${script.id.substring(0, 8)}.user.js`;
        const fileName = `${safeName}${idSuffix}`;

        // Check for old files with same ID suffix but different name prefix
        for (const existingName of existingFiles) {
            if (existingName.endsWith(idSuffix) && existingName !== fileName) {
                // Same ID, different name -> Delete old file
                try {
                    await scriptsDirHandle.removeEntry(existingName);
                } catch (e) {
                    console.warn("Failed to remove old backup file", existingName, e);
                }
            }
        }

        const fileHandle = await scriptsDirHandle.getFileHandle(fileName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(script.code);
        await writable.close();
    }

    // Write a full dump including metadata that might not be in the code (like enabled state, etc)
    // This helps in full restoration.
    const dumpHandle = await handle.getFileHandle('shieldmonkey_dump.json', { create: true });
    const dumpWritable = await dumpHandle.createWritable();
    await dumpWritable.write(JSON.stringify({
        timestamp: new Date().toISOString(),
        version: chrome.runtime.getManifest().version,
        scripts: scripts
    }, null, 2));
    await dumpWritable.close();

    return scripts.length;
}

export async function performRestore(existingHandle?: FileSystemDirectoryHandle): Promise<number> {
    let handle = existingHandle;
    if (!handle) {
        handle = await getDirectoryHandle();
    }
    if (!handle) {
        // Ask for handle if not found (UI flow should handle this, but internal check)
        throw new Error("No backup directory available.");
    }

    try {
        const dumpHandle = await handle.getFileHandle('shieldmonkey_dump.json', { create: false });
        const file = await dumpHandle.getFile();
        const text = await file.text();
        const data = JSON.parse(text);

        if (!data.scripts || !Array.isArray(data.scripts)) {
            throw new Error("Invalid backup format: No scripts array found.");
        }

        const restoreScripts = data.scripts as Script[];

        // Merge logic: Update existing by ID, add new ones.
        const currentData = await new Promise<{ scripts: Script[] }>((resolve) => {
            chrome.storage.local.get(['scripts'], (res) => resolve(res as { scripts: Script[] }));
        });
        const currentScripts = currentData.scripts || [];

        // Map current scripts for easy lookup
        const scriptMap = new Map<string, Script>();
        currentScripts.forEach(s => scriptMap.set(s.id, s));

        // Apply restore
        for (const script of restoreScripts) {
            // Overwrite existing or add new
            scriptMap.set(script.id, script);
        }

        const newScripts = Array.from(scriptMap.values());
        await chrome.storage.local.set({ scripts: newScripts });

        return restoreScripts.length;

    } catch (e) {
        if ((e as Error).name === 'NotFoundError') {
            throw new Error("Backup file (shieldmonkey_dump.json) not found in directory.");
        }
        throw e;
    }
}
