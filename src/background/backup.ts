import { performBackup } from '../utils/backupManager';

export async function triggerBackup() {
    try {
        const res = await chrome.storage.local.get(['autoBackup']);
        if (res.autoBackup) {
            await performBackup();
            await chrome.storage.local.set({ lastBackupTime: new Date().toISOString() });
        }
    } catch (err) {
        console.error("Auto-backup failed:", err);
    }
}

