import { saveDirectoryHandle, getDirectoryHandle } from '../utils/backupStorage';
import { performBackup, performRestore } from '../utils/backupManager';
import type { Script } from '../sandbox/options/types';

export async function handleSelectBackupDir(): Promise<string> {
    try {
        const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
        await saveDirectoryHandle(handle);
        return handle.name;
    } catch (e: unknown) {
        if ((e as Error).name === 'AbortError') {
            throw new Error('Selection cancelled');
        }
        throw e;
    }
}

export async function handleGetBackupDirName(): Promise<string | null> {
    const handle = await getDirectoryHandle();
    return handle ? handle.name : null;
}

export async function handleRunBackup(scripts: Script[], version: string): Promise<number> {
    return await performBackup(undefined, scripts, version);
}

export async function handleRunRestore(scripts: Script[]): Promise<{ count: number; mergedScripts: Script[] }> {
    return await performRestore(undefined, scripts);
}
