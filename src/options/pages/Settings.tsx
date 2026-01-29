import { useState, useEffect, useRef } from 'react';
import { Save, FolderInput, Clock, Check, AlertCircle, RotateCcw, Sun, Moon, Monitor } from 'lucide-react';
import { useApp } from '../context/useApp';
import { useModal } from '../context/useModal';
import { saveDirectoryHandle, getDirectoryHandle } from '../../utils/backupStorage';
import { performBackup, performRestore, performBackupLegacy, performRestoreLegacy } from '../../utils/backupManager';
import { useI18n } from '../../context/I18nContext';
import { isFileSystemSupported } from '../../utils/browserPolyfill';


const Settings = () => {
    const { theme, setTheme, extensionEnabled, toggleExtension } = useApp();
    const { t, locale, setLocale } = useI18n();
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
    const [fsSupported, setFsSupported] = useState(true);
    const restoreInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const supported = isFileSystemSupported();
        setFsSupported(supported);

        if (supported) {
            getDirectoryHandle().then(async (handle) => {
                if (handle) {
                    setBackupDirName(handle.name);
                }
            });
        }

        chrome.storage.local.get(['lastBackupTime', 'autoBackup', 'backupFrequency'], (res) => {
            if (res.lastBackupTime) setLastBackupTime(res.lastBackupTime as string);
            if (res.autoBackup !== undefined) setAutoBackup(!!res.autoBackup);
            if (res.backupFrequency) setBackupFrequency(res.backupFrequency as string);
        });
    }, []);

    const handleSelectBackupDir = async () => {
        if (!fsSupported) return;
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
            let count;
            if (fsSupported) {
                count = await performBackup();
            } else {
                count = await performBackupLegacy();
            }
            const time = new Date().toISOString();
            setLastBackupTime(time);
            chrome.storage.local.set({ lastBackupTime: time });
            setBackupStatus('success');
            setBackupMessage(t('savedScriptsMsg', [String(count)]));
        } catch (e) {
            console.error("Backup failed", e);
            setBackupStatus('error');
            setBackupMessage((e as Error).message);
        } finally {
            setIsBackupLoading(false);
        }
    };

    const handleRestoreFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        showModal(
            'confirm',
            t('confirmRestoreTitle'),
            t('confirmRestoreMsg', [file.name]),
            async () => {
                try {
                    setRestoreStatus('idle');
                    setRestoreMessage('');
                    setIsBackupLoading(true);

                    const count = await performRestoreLegacy(file);
                    await chrome.runtime.sendMessage({ type: 'RELOAD_SCRIPTS' });

                    setRestoreStatus('success');
                    setRestoreMessage(t('restoreSuccessMsg', [String(count)]));
                    showModal('success', t('restoreCompleteTitle'), t('restoreCompleteMsg', [String(count)]));
                } catch (err) {
                    console.error("Restore failed", err);
                    setRestoreStatus('error');
                    setRestoreMessage((err as Error).message);
                    showModal('error', t('restoreFailedTitle'), (err as Error).message);
                } finally {
                    setIsBackupLoading(false);
                    // Reset input
                    if (restoreInputRef.current) restoreInputRef.current.value = '';
                }
            }
        );
    };

    const handleManualRestore = async () => {
        if (!fsSupported) {
            restoreInputRef.current?.click();
            return;
        }

        try {
            const handle = await window.showDirectoryPicker();
            showModal(
                'confirm',
                t('confirmRestoreTitle'),
                t('confirmRestoreMsg', [handle.name]),
                async () => {
                    try {
                        setRestoreStatus('idle');
                        setRestoreMessage('');
                        setIsBackupLoading(true);

                        const count = await performRestore(handle);
                        await chrome.runtime.sendMessage({ type: 'RELOAD_SCRIPTS' });

                        setRestoreStatus('success');
                        setRestoreMessage(t('restoreSuccessMsg', [String(count)]));
                        showModal('success', t('restoreCompleteTitle'), t('restoreCompleteMsg', [String(count)]));
                    } catch (e) {
                        console.error("Restore failed", e);
                        setRestoreStatus('error');
                        setRestoreMessage((e as Error).message);
                        showModal('error', t('restoreFailedTitle'), (e as Error).message);
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
                <h2 className="page-title" style={{ marginBottom: '20px' }}>{t('pageTitleSettings')}</h2>

                {/* Status Section for Mobile (or general access) since sidebar hidden on mobile */}
                <div style={{ marginBottom: '32px' }}>
                    <h3 style={{ fontSize: '1rem', marginBottom: '16px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('extensionLabel') || 'Extension Status'}</h3>
                    <div className="settings-card" style={{ background: 'var(--surface-bg)', borderRadius: '12px', padding: '20px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <span style={{ fontWeight: 600 }}>{extensionEnabled ? t('enabled') || 'Enabled' : t('disabled') || 'Disabled'}</span>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>v{chrome.runtime.getManifest().version}</span>
                        </div>
                        {/* Toggle Switch Component - Reusing existing class based switch or importing ToggleSwitch if available */}
                        <label className="switch">
                            <input type="checkbox" checked={extensionEnabled} onChange={(e) => toggleExtension(e.target.checked)} />
                            <span className="slider"></span>
                        </label>
                    </div>
                </div>

                <div style={{ marginBottom: '32px' }}>
                    <h3 style={{ fontSize: '1rem', marginBottom: '16px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('sectionAppearance')}</h3>
                    <div className="settings-card" style={{ background: 'var(--surface-bg)', borderRadius: '12px', padding: '20px', border: '1px solid var(--border-color)', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {(['light', 'dark', 'system'] as const).map((text) => (
                            <button
                                key={text}
                                className={theme === text ? 'btn-primary' : 'btn-secondary'}
                                onClick={() => setTheme(text)}
                                style={{ textTransform: 'capitalize', display: 'flex', alignItems: 'center', gap: '8px' }}
                            >
                                {text === 'light' && <Sun size={16} />}
                                {text === 'dark' && <Moon size={16} />}
                                {text === 'system' && <Monitor size={16} />}
                                {t('theme' + text.charAt(0).toUpperCase() + text.slice(1))}
                            </button>
                        ))}
                    </div>
                </div>

                <div style={{ marginBottom: '32px' }}>
                    <h3 style={{ fontSize: '1rem', marginBottom: '16px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Language</h3>
                    <div className="settings-card" style={{ background: 'var(--surface-bg)', borderRadius: '12px', padding: '20px', border: '1px solid var(--border-color)', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <button
                            className={locale === 'en' ? 'btn-primary' : 'btn-secondary'}
                            onClick={() => setLocale('en')}
                            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                        >
                            English
                        </button>
                        <button
                            className={locale === 'ja' ? 'btn-primary' : 'btn-secondary'}
                            onClick={() => setLocale('ja')}
                            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                        >
                            日本語
                        </button>
                        <button
                            className={locale === 'system' ? 'btn-primary' : 'btn-secondary'}
                            onClick={() => setLocale('system')}
                            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                        >
                            <Monitor size={16} />
                            System
                        </button>
                    </div>
                </div>

                <div>
                    <h3 style={{ fontSize: '1rem', marginBottom: '16px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('sectionBackupRestore')}</h3>
                    <div style={{ background: 'var(--surface-bg)', borderRadius: '12px', padding: '24px', border: '1px solid var(--border-color)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <h4 style={{ fontSize: '1rem', marginBottom: '8px', fontWeight: 600 }}>{t('sectionBackupDir')}</h4>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{
                                        flex: 1,
                                        background: fsSupported ? 'rgba(0,0,0,0.2)' : 'var(--bg-color)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '6px',
                                        padding: '8px 12px',
                                        fontSize: '0.9rem',
                                        color: (backupDirName && fsSupported) ? 'var(--text-primary)' : 'var(--text-secondary)',
                                        fontFamily: 'monospace'
                                    }}>
                                        {!fsSupported
                                            ? "Directory backup not supported in this browser. Please use 'Backup Now' to download."
                                            : (backupDirName || t('noDirSelected'))}
                                    </div>
                                    <button
                                        className="btn-secondary"
                                        onClick={handleSelectBackupDir}
                                        disabled={isBackupLoading || !fsSupported}
                                        title={fsSupported ? "Select backup folder" : "Not available"}
                                        style={!fsSupported ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                                    >
                                        <FolderInput size={18} />
                                        <span>{t('btnSelect')}</span>
                                    </button>
                                </div>
                            </div>

                            <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '8px 0' }} />

                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div>
                                    <h4 style={{ fontSize: '1rem', marginBottom: '4px', fontWeight: 600 }}>{t('sectionAutoBackup')}</h4>
                                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                        {t('autoBackupDesc')}
                                    </p>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <label className="switch" style={!fsSupported ? { opacity: 0.5, pointerEvents: 'none' } : {}}>
                                        <input type="checkbox" checked={autoBackup} onChange={(e) => toggleAutoBackup(e.target.checked)} disabled={(!backupDirName && fsSupported) || !fsSupported} />
                                        <span className="slider"></span>
                                    </label>
                                    <select
                                        value={backupFrequency}
                                        onChange={(e) => handleFrequencyChange(e.target.value)}
                                        disabled={!autoBackup || (!backupDirName && fsSupported) || !fsSupported}
                                        style={{
                                            background: 'var(--bg-color)',
                                            color: 'var(--text-primary)',
                                            border: '1px solid var(--border-color)',
                                            borderRadius: '6px',
                                            padding: '4px 8px',
                                            fontSize: '0.85rem',
                                            opacity: (!autoBackup || !fsSupported) ? 0.5 : 1
                                        }}
                                    >
                                        <option value="hourly">{t('freqHourly')}</option>
                                        <option value="daily">{t('freqDaily')}</option>
                                        <option value="weekly">{t('freqWeekly')}</option>
                                    </select>
                                </div>
                            </div>

                            {/* Manual Backup Button - Always available (fallback or FS) */}
                            {(backupDirName || !fsSupported) && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px' }}>
                                    <button
                                        className="btn-primary"
                                        onClick={handleManualBackup}
                                        disabled={isBackupLoading}
                                        style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '8px' }}
                                    >
                                        <Save size={18} />
                                        <span>{isBackupLoading ? t('btnWorking') : t('btnBackupNow')}</span>
                                    </button>

                                    {backupStatus === 'success' && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#10b981', fontSize: '0.9rem' }}>
                                            <Check size={18} />
                                            <span>{t('backupDone')}{backupMessage ? `: ${backupMessage}` : ''}</span>
                                        </div>
                                    )}
                                    {backupStatus === 'error' && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#ef4444', fontSize: '0.9rem' }}>
                                            <AlertCircle size={18} />
                                            <span>{t('backupError')}{backupMessage ? `: ${backupMessage}` : ''}</span>
                                        </div>
                                    )}
                                    {lastBackupTime && backupStatus !== 'success' && backupStatus !== 'error' && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                            <Clock size={14} />
                                            <span>{t('lastBackupPrefix')}{new Date(lastBackupTime).toLocaleString()}</span>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid var(--border-color)' }}>
                                <h4 style={{ fontSize: '1rem', marginBottom: '12px', fontWeight: 600 }}>{t('sectionRestore')}</h4>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    {/* Uncontrolled input for legacy restore */}
                                    <input
                                        type="file"
                                        accept=".json"
                                        ref={restoreInputRef}
                                        style={{ display: 'none' }}
                                        onChange={handleRestoreFileSelected}
                                    />

                                    <button
                                        className="btn-secondary"
                                        onClick={handleManualRestore}
                                        disabled={isBackupLoading}
                                        style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '8px' }}
                                    >
                                        <RotateCcw size={18} />
                                        <span>{t('btnRestore')}</span>
                                    </button>
                                    {restoreStatus === 'success' && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#10b981', fontSize: '0.9rem' }}>
                                            <Check size={18} />
                                            <span>{t('backupDone')}{restoreMessage ? `: ${restoreMessage}` : ''}</span>
                                        </div>
                                    )}
                                    {restoreStatus === 'error' && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#ef4444', fontSize: '0.9rem' }}>
                                            <AlertCircle size={18} />
                                            <span>{t('backupError')}{restoreMessage ? `: ${restoreMessage}` : ''}</span>
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
