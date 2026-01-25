import { useState, useEffect } from 'react';
import { Save, FolderInput, Clock, Check, AlertCircle, RotateCcw, Sun, Moon, Monitor } from 'lucide-react';
import { useApp } from '../context/useApp';
import { useModal } from '../context/useModal';
import { saveDirectoryHandle, getDirectoryHandle } from '../../utils/backupStorage';
import { performBackup, performRestore } from '../../utils/backupManager';

const Settings = () => {
    const { theme, setTheme } = useApp();
    const { showModal } = useModal();

    // Local state for backup UI
    const [backupDirName, setBackupDirName] = useState<string | null>(null);
    const [lastBackupTime, setLastBackupTime] = useState<string | null>(null);
    const [isBackupLoading, setIsBackupLoading] = useState(false);
    const [backupStatus, setBackupStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [backupMessage, setBackupMessage] = useState<string>('');
    const [restoreStatus, setRestoreStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [restoreMessage, setRestoreMessage] = useState<string>('');
    const [autoBackup, setAutoBackup] = useState(false);
    const [backupFrequency, setBackupFrequency] = useState('daily');

    useEffect(() => {
        getDirectoryHandle().then(async (handle) => {
            if (handle) {
                setBackupDirName(handle.name);
            }
        });

        chrome.storage.local.get(['lastBackupTime', 'autoBackup', 'backupFrequency'], (res) => {
            if (res.lastBackupTime) setLastBackupTime(res.lastBackupTime as string);
            if (res.autoBackup !== undefined) setAutoBackup(!!res.autoBackup);
            if (res.backupFrequency) setBackupFrequency(res.backupFrequency as string);
        });
    }, []);

    const handleSelectBackupDir = async () => {
        try {
            setBackupStatus('idle');
            setBackupMessage('');
            setIsBackupLoading(true);
            const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
            await saveDirectoryHandle(handle);
            setBackupDirName(handle.name);
        } catch (e) {
            if ((e as Error).name !== 'AbortError') {
                console.error("Backup setup failed", e);
                setBackupStatus('error');
                setBackupMessage((e as Error).message);
            }
        } finally {
            setIsBackupLoading(false);
        }
    };

    const handleManualBackup = async () => {
        try {
            setBackupStatus('idle');
            setBackupMessage('');
            setIsBackupLoading(true);
            const count = await performBackup();
            const time = new Date().toISOString();
            setLastBackupTime(time);
            chrome.storage.local.set({ lastBackupTime: time });
            setBackupStatus('success');
            setBackupMessage(`Saved ${count} scripts`);
        } catch (e) {
            console.error("Backup failed", e);
            setBackupStatus('error');
            setBackupMessage((e as Error).message);
        } finally {
            setIsBackupLoading(false);
        }
    };

    const handleManualRestore = async () => {
        try {
            const handle = await window.showDirectoryPicker();
            showModal(
                'confirm',
                'Restore Scripts',
                `Restoring from "${handle.name}". This will merge/update existing scripts. Continue?`,
                async () => {
                    try {
                        setRestoreStatus('idle');
                        setRestoreMessage('');
                        setIsBackupLoading(true);

                        const count = await performRestore(handle);
                        await chrome.runtime.sendMessage({ type: 'RELOAD_SCRIPTS' });

                        setRestoreStatus('success');
                        setRestoreMessage(`Restored ${count} scripts`);
                        showModal('success', 'Restore Complete', `Successfully restored ${count} scripts.`);
                    } catch (e) {
                        console.error("Restore failed", e);
                        setRestoreStatus('error');
                        setRestoreMessage((e as Error).message);
                        showModal('error', 'Restore Failed', (e as Error).message);
                    } finally {
                        setIsBackupLoading(false);
                    }
                }
            );
        } catch (e) {
            if ((e as Error).name !== 'AbortError') {
                console.error("Restore failed", e);
                setRestoreStatus('error');
                setRestoreMessage((e as Error).message);
                showModal('error', 'Error', (e as Error).message);
            }
        }
    };

    const toggleAutoBackup = (checked: boolean) => {
        setAutoBackup(checked);
        chrome.storage.local.set({ autoBackup: checked });
    };

    const handleFrequencyChange = (val: string) => {
        setBackupFrequency(val);
        chrome.storage.local.set({ backupFrequency: val });
    };

    return (
        <div className="content-scroll">
            <div style={{ maxWidth: '900px', margin: '0 auto' }}>
                <h2 className="page-title" style={{ marginBottom: '20px' }}>Settings</h2>

                <div style={{ marginBottom: '32px' }}>
                    <h3 style={{ fontSize: '1rem', marginBottom: '16px', fontWeight: 500, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Appearance</h3>
                    <div className="settings-card" style={{ background: 'var(--surface-bg)', borderRadius: '12px', padding: '20px', border: '1px solid var(--border-color)', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {(['light', 'dark', 'system'] as const).map((t) => (
                            <button
                                key={t}
                                className={theme === t ? 'btn-primary' : 'btn-secondary'}
                                onClick={() => setTheme(t)}
                                style={{ textTransform: 'capitalize', display: 'flex', alignItems: 'center', gap: '8px' }}
                            >
                                {t === 'light' && <Sun size={16} />}
                                {t === 'dark' && <Moon size={16} />}
                                {t === 'system' && <Monitor size={16} />}
                                {t}
                            </button>
                        ))}
                    </div>
                </div>

                <div>
                    <h3 style={{ fontSize: '1rem', marginBottom: '16px', fontWeight: 500, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Backup & Restore</h3>
                    <div style={{ background: 'var(--surface-bg)', borderRadius: '12px', padding: '24px', border: '1px solid var(--border-color)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <h4 style={{ fontSize: '1rem', marginBottom: '8px', fontWeight: 500 }}>Backup Directory</h4>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{
                                        flex: 1,
                                        background: 'rgba(0,0,0,0.2)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '6px',
                                        padding: '8px 12px',
                                        fontSize: '0.9rem',
                                        color: backupDirName ? 'var(--text-primary)' : 'var(--text-secondary)',
                                        fontFamily: 'monospace'
                                    }}>
                                        {backupDirName || 'No directory selected'}
                                    </div>
                                    <button className="btn-secondary" onClick={handleSelectBackupDir} disabled={isBackupLoading} title="Select backup folder">
                                        <FolderInput size={18} />
                                        <span>Select</span>
                                    </button>
                                </div>
                            </div>

                            <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '8px 0' }} />

                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div>
                                    <h4 style={{ fontSize: '1rem', marginBottom: '4px', fontWeight: 500 }}>Automatic Backup</h4>
                                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                        Automatically save scripts to the selected directory.
                                    </p>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <label className="switch">
                                        <input type="checkbox" checked={autoBackup} onChange={(e) => toggleAutoBackup(e.target.checked)} disabled={!backupDirName} />
                                        <span className="slider"></span>
                                    </label>
                                    <select
                                        value={backupFrequency}
                                        onChange={(e) => handleFrequencyChange(e.target.value)}
                                        disabled={!autoBackup || !backupDirName}
                                        style={{
                                            background: 'var(--bg-color)',
                                            color: 'var(--text-primary)',
                                            border: '1px solid var(--border-color)',
                                            borderRadius: '6px',
                                            padding: '4px 8px',
                                            fontSize: '0.85rem'
                                        }}
                                    >
                                        <option value="hourly">Every Hour</option>
                                        <option value="daily">Daily</option>
                                        <option value="weekly">Weekly</option>
                                    </select>
                                </div>
                            </div>

                            {backupDirName && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px' }}>
                                    <button
                                        className="btn-primary"
                                        onClick={handleManualBackup}
                                        disabled={isBackupLoading}
                                        style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '8px' }}
                                    >
                                        <Save size={18} />
                                        <span>{isBackupLoading ? 'Working...' : 'Backup Now'}</span>
                                    </button>

                                    {backupStatus === 'success' && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#10b981', fontSize: '0.9rem' }}>
                                            <Check size={18} />
                                            <span>Done{backupMessage ? `: ${backupMessage}` : ''}</span>
                                        </div>
                                    )}
                                    {backupStatus === 'error' && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#ef4444', fontSize: '0.9rem' }}>
                                            <AlertCircle size={18} />
                                            <span>Error{backupMessage ? `: ${backupMessage}` : ''}</span>
                                        </div>
                                    )}
                                    {lastBackupTime && backupStatus !== 'success' && backupStatus !== 'error' && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                            <Clock size={14} />
                                            <span>Last: {new Date(lastBackupTime).toLocaleString()}</span>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid var(--border-color)' }}>
                                <h4 style={{ fontSize: '1rem', marginBottom: '12px', fontWeight: 500 }}>Restore</h4>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <button
                                        className="btn-secondary"
                                        onClick={handleManualRestore}
                                        disabled={isBackupLoading}
                                        style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '8px' }}
                                    >
                                        <RotateCcw size={18} />
                                        <span>Select Directory & Restore</span>
                                    </button>
                                    {restoreStatus === 'success' && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#10b981', fontSize: '0.9rem' }}>
                                            <Check size={18} />
                                            <span>Done{restoreMessage ? `: ${restoreMessage}` : ''}</span>
                                        </div>
                                    )}
                                    {restoreStatus === 'error' && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#ef4444', fontSize: '0.9rem' }}>
                                            <AlertCircle size={18} />
                                            <span>Error{restoreMessage ? `: ${restoreMessage}` : ''}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Settings;
