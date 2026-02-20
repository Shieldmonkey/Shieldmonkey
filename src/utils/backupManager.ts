import { getDirectoryHandle, verifyPermission } from './backupStorage';

export interface Script {
    id: string;
    name: string;
    code: string;
    enabled?: boolean;
    lastSavedCode?: string;
    grantedPermissions?: string[];
    sourceUrl?: string;
    referrerUrl?: string;
    namespace?: string;
    installDate?: number;
}

export async function performBackup(existingHandle: FileSystemDirectoryHandle | undefined, scripts: Script[], version: string): Promise<number> {
    let handle = existingHandle;
    if (!handle) {
        handle = await getDirectoryHandle();
    }
    if (!handle) {
        throw new Error("No backup directory configured.");
    }

    const hasPerm = await verifyPermission(handle, true);
    if (!hasPerm) {
        throw new Error("Permission denied. User interaction required.");
    }

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
    const dumpHandle = await handle.getFileHandle('shieldmonkey_dump.json', { create: true });
    const dumpWritable = await dumpHandle.createWritable();
    await dumpWritable.write(JSON.stringify({
        timestamp: new Date().toISOString(),
        version: version,
        scripts: scripts
    }, null, 2));
    await dumpWritable.close();

    return scripts.length;
}

export async function performBackupLegacy(scripts: Script[], version: string): Promise<number> {
    const data = JSON.stringify({
        timestamp: new Date().toISOString(),
        version: version,
        scripts: scripts
    }, null, 2);

    const filename = `shieldmonkey_backup_${new Date().toISOString().slice(0, 10)}.json`;

    try {
        // Use the bridge to handle the actual download since we are in a sandbox
        const { bridge } = await import('../sandbox/bridge/client');
        await bridge.call('DOWNLOAD_JSON', { data, filename });
    } catch (e) {
        // Fallback for non-sandboxed or testing environments if bridge is not available
        console.warn("Bridge download failed, falling back to anchor click", e);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    return scripts.length;
}

export async function performRestoreLegacy(file: File, currentScripts: Script[]): Promise<{ count: number, mergedScripts: Script[] }> {
    const text = await file.text();
    let data;
    try {
        data = JSON.parse(text);
    } catch {
        throw new Error("Invalid backup file format.");
    }

    if (!data.scripts || !Array.isArray(data.scripts)) {
        throw new Error("Invalid backup format: No scripts array found.");
    }

    const restoreScripts = data.scripts as Script[];

    const scriptMap = new Map<string, Script>();
    currentScripts.forEach(s => scriptMap.set(s.id, s));

    for (const script of restoreScripts) {
        scriptMap.set(script.id, script);
    }

    const newScripts = Array.from(scriptMap.values());
    return { count: restoreScripts.length, mergedScripts: newScripts };
}

export async function performRestore(existingHandle: FileSystemDirectoryHandle | undefined, currentScripts: Script[]): Promise<{ count: number, mergedScripts: Script[] }> {
    let handle = existingHandle;
    if (!handle) {
        handle = await getDirectoryHandle();
    }
    if (!handle) {
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

        // Map current scripts for easy lookup
        const scriptMap = new Map<string, Script>();
        currentScripts.forEach(s => scriptMap.set(s.id, s));

        // Apply restore
        for (const script of restoreScripts) {
            // Overwrite existing or add new
            scriptMap.set(script.id, script);
        }

        const newScripts = Array.from(scriptMap.values());
        return { count: restoreScripts.length, mergedScripts: newScripts };

    } catch (e) {
        if ((e as Error).name === 'NotFoundError') {
            throw new Error("Backup file (shieldmonkey_dump.json) not found in directory.");
        }
        throw e;
    }
}
