import { performBackup } from '../utils/backupManager';

export function setupBackupAlarm() {
    chrome.storage.local.get(['autoBackup', 'backupFrequency'], (res) => {
        const enabled = !!res.autoBackup;
        const frequency = res.backupFrequency || 'daily'; // default daily

        if (enabled) {
            let periodInMinutes = 60 * 24; // daily
            if (frequency === 'hourly') periodInMinutes = 60;
            if (frequency === 'weekly') periodInMinutes = 60 * 24 * 7;

            chrome.alarms.create('backup-alarm', { periodInMinutes });
        } else {
            chrome.alarms.clear('backup-alarm');
        }
    });
}

export function setupBackupListeners() {
    chrome.alarms.onAlarm.addListener((alarm) => {
        if (alarm.name === 'backup-alarm') {
            chrome.storage.local.get(['autoBackup'], (res) => {
                if (res.autoBackup) {
                    performBackup().then(() => {
                        chrome.storage.local.set({ lastBackupTime: new Date().toISOString() });
                    }).catch(err => {
                        console.error("Auto-backup failed:", err);
                    });
                }
            });
        }
    });

    // Update alarm when settings change
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local') {
            if (changes.autoBackup || changes.backupFrequency) {
                setupBackupAlarm();
            }
        }
    });
}
