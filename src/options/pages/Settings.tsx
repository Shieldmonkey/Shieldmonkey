import { useState, useEffect, useRef } from 'react';
import { Save, FolderInput, Clock, Check, AlertCircle, RotateCcw, Sun, Moon, Monitor, Upload, Download } from 'lucide-react';
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

        chrome.storage.local.get(['lastBackupTime', 'autoBackup'], (res) => {
            if (res.lastBackupTime) setLastBackupTime(res.lastBackupTime as string);
            if (res.autoBackup !== undefined) setAutoBackup(!!res.autoBackup);
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
                let count = 0;
                try {
                    setRestoreStatus('idle');
                    setRestoreMessage('');
                    setIsBackupLoading(true);

                    count = await performRestoreLegacy(file);
                    try {
                        await chrome.runtime.sendMessage({ type: 'RELOAD_SCRIPTS' });
                    } catch (msgError) {
                        console.warn("Failed to notify background script of restore:", msgError);
                    }

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
                    let count = 0;
                    try {
                        setRestoreStatus('idle');
                        setRestoreMessage('');
                        setIsBackupLoading(true);

                        count = await performRestore(handle);
                        try {
                            await chrome.runtime.sendMessage({ type: 'RELOAD_SCRIPTS' });
                        } catch (msgError) {
                            console.warn("Failed to notify background script of restore:", msgError);
                        }

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

    return (
        <div className="content-scroll">
            <div style={{ maxWidth: '900px', margin: '0 auto' }}>
                <h2 className="page-title" style={{ marginBottom: '20px' }}>{t('pageTitleSettings')}</h2>

                {/* Status Section for Mobile (or general access) since sidebar hidden on mobile */}
                <div style={{ marginBottom: '32px' }}>
                    <h3 style={{ fontSize: '1rem', marginBottom: '16px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('extensionLabel')}</h3>
                    <div className="settings-card" style={{
                        background: 'var(--surface-bg)',
                        borderRadius: '12px',
                        padding: '24px',
                        border: extensionEnabled ? '1px solid var(--accent-color)' : '1px solid var(--border-color)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        boxShadow: extensionEnabled ? '0 0 0 1px var(--accent-color)' : 'none',
                        transition: 'all 0.2s ease'
                    }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '80%' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <span style={{
                                    fontWeight: 700,
                                    fontSize: '1.1rem',
                                    color: extensionEnabled ? 'var(--accent-color)' : 'var(--text-secondary)'
                                }}>
                                    {extensionEnabled ? (t('globalStatusActive') || 'Active') : (t('globalStatusPaused') || 'Paused')}
                                </span>
                                <span style={{
                                    fontSize: '0.75rem',
                                    padding: '2px 8px',
                                    borderRadius: '12px',
                                    background: 'var(--bg-color)',
                                    border: '1px solid var(--border-color)',
                                    color: 'var(--text-secondary)'
                                }}>
                                    v{chrome.runtime.getManifest().version}
                                </span>
                            </div>
                            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                {extensionEnabled ? (t('globalStatusDescActive') || 'User scripts are running normally.') : (t('globalStatusDescPaused') || 'Execution of all user scripts is suspended.')}
                            </p>
                        </div>

                        <label className="switch" style={{ transform: 'scale(1.2)', marginRight: '8px' }}>
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
                    {fsSupported ? (
                        /* CHROMIUM / FILE SYSTEM API SUPPORTED UI */
                        <>
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
                                                {backupDirName || t('noDirSelected')}
                                            </div>
                                            <button
                                                className="btn-secondary"
                                                onClick={handleSelectBackupDir}
                                                disabled={isBackupLoading}
                                                title="Select backup folder"
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
                                            <label className="switch">
                                                <input type="checkbox" checked={autoBackup} onChange={(e) => toggleAutoBackup(e.target.checked)} disabled={!backupDirName} />
                                                <span className="slider"></span>
                                            </label>
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
                        </>
                    ) : (
                        /* FIREFOX / LEGACY FALLBACK UI */
                        <>
                            <h3 style={{ fontSize: '1rem', marginBottom: '16px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('sectionExportImport') || 'Export / Import'}</h3>
                            <div style={{ background: 'var(--surface-bg)', borderRadius: '12px', padding: '0', border: '1px solid var(--border-color)', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)' }}>

                                {/* EXPORT */}
                                <div style={{ padding: '24px', borderBottom: '1px solid var(--border-color)' }}>
                                    <h4 style={{ fontSize: '1rem', marginBottom: '8px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <Download size={20} className="text-secondary" />
                                        {t('btnExport') || 'Export'}
                                    </h4>
                                    <p style={{ margin: '0 0 16px 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                        {t('exportDesc') || 'Save all your scripts to a single JSON file.'}
                                    </p>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <button
                                            className="btn-primary"
                                            onClick={handleManualBackup}
                                            disabled={isBackupLoading}
                                        >
                                            <Download size={18} />
                                            <span>{isBackupLoading ? t('btnWorking') : (t('btnExport') || 'Export')}</span>
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
                                    </div>
                                </div>

                                {/* IMPORT */}
                                <div style={{ padding: '24px' }}>
                                    <h4 style={{ fontSize: '1rem', marginBottom: '8px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <Upload size={20} className="text-secondary" />
                                        {t('btnImport') || 'Import'}
                                    </h4>
                                    <p style={{ margin: '0 0 16px 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                        {t('importDesc') || 'Restore scripts from a previously exported JSON file.'}
                                    </p>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <input
                                            type="file"
                                            accept=".json"
                                            ref={restoreInputRef}
                                            style={{ display: 'none' }}
                                            onChange={handleRestoreFileSelected}
                                        />
                                        <button
                                            className="btn-secondary"
                                            onClick={() => restoreInputRef.current?.click()}
                                            disabled={isBackupLoading}
                                        >
                                            <Upload size={18} />
                                            <span>{t('btnImport') || 'Import'}</span>
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
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Settings;
