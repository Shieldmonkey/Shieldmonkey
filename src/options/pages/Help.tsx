import { ExternalLink, Bug, Shield, User, Key } from 'lucide-react';
import { useState, useEffect } from 'react';
import { isUserScriptsAvailable, requestPermission, isFirefox } from '../../utils/browserPolyfill';
import { useTranslation } from '../../context/I18nContext';

const Help = () => {
    const { t } = useTranslation();
    const [hasPermission, setHasPermission] = useState<boolean | null>(null);
    const isFirefoxBrowser = isFirefox();

    useEffect(() => {
        let mounted = true;
        const check = async () => {
            const has = await isUserScriptsAvailable();
            if (mounted) setHasPermission(has);
        };
        check();

        // Handle hash navigation
        if (window.location.hash === '#permission-help') {
            const el = document.getElementById('permission-help');
            if (el) el.scrollIntoView({ behavior: 'smooth' });
        }

        return () => { mounted = false; };
    }, []);

    const handleRequestPermission = async () => {
        const granted = await requestPermission(['userScripts']);
        setHasPermission(granted);
        if (granted) {
            // Reload extension to ensure scripts are registered if needed
            chrome.runtime.reload();
        }
    };

    const openExtensionsPage = () => {
        const url = `chrome://extensions/?id=${chrome.runtime.id}`;
        if (chrome.tabs) {
            chrome.tabs.create({ url });
        } else {
            window.open(url, '_blank');
        }
    };

    return (
        <div className="content-scroll">
            <div style={{ maxWidth: '900px', margin: '0 auto' }}>
                <h2 className="page-title" style={{ marginBottom: '20px' }}>{t('navHelp')}</h2>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>

                    {/* Permissions Section */}
                    <div id="permission-help" style={{ background: 'var(--surface-bg)', borderRadius: '12px', padding: '20px', border: '1px solid var(--border-color)' }}>
                        <h3 style={{ fontSize: '1rem', marginBottom: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Key size={18} />
                            <span>{t('installHeaderPermissions')}</span>
                        </h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '16px' }}>
                            {t('appDescription')}
                            <br />
                            {hasPermission === false && <span style={{ color: 'var(--error-color)' }}> {t('permissionMissing')}</span>}
                            {hasPermission === true && <span style={{ color: 'var(--success-color)' }}> {t('permissionStatusActive')}</span>}
                        </p>

                        {/* Button for Firefox */}
                        {isFirefoxBrowser && hasPermission === false && (
                            <button
                                onClick={handleRequestPermission}
                                style={{
                                    padding: '8px 16px',
                                    borderRadius: '6px',
                                    border: 'none',
                                    background: 'var(--accent-color)',
                                    color: 'white',
                                    cursor: 'pointer',
                                    fontSize: '0.9rem',
                                    fontWeight: 600
                                }}
                            >
                                {t('btnGrantPermission')}
                            </button>
                        )}

                        {/* Button for Chrome */}
                        {!isFirefoxBrowser && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <button
                                    onClick={openExtensionsPage}
                                    style={{
                                        padding: '8px 16px',
                                        borderRadius: '6px',
                                        border: '1px solid var(--border-color)',
                                        background: 'var(--surface-bg-hover)',
                                        color: 'var(--text-primary)',
                                        cursor: 'pointer',
                                        fontSize: '0.9rem',
                                        fontWeight: 600,
                                        width: 'fit-content'
                                    }}
                                >
                                    {t('btnOpenSettings')}
                                </button>
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
                                    {t('permissionChromeNote')}
                                </p>
                            </div>
                        )}

                        {isFirefoxBrowser && hasPermission === true && (
                            <button
                                disabled
                                style={{
                                    padding: '8px 16px',
                                    borderRadius: '6px',
                                    border: '1px solid var(--border-color)',
                                    background: 'transparent',
                                    color: 'var(--text-secondary)',
                                    cursor: 'not-allowed',
                                    fontSize: '0.9rem'
                                }}
                            >
                                {t('permissionGranted')}
                            </button>
                        )}
                    </div>

                    <div style={{ background: 'var(--surface-bg)', borderRadius: '12px', padding: '20px', border: '1px solid var(--border-color)' }}>
                        <h3 style={{ fontSize: '1rem', marginBottom: '12px', fontWeight: 600 }}>Links</h3>
                        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <li>
                                <a href="https://github.com/shieldmonkey/shieldmonkey" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-color)', textDecoration: 'none', fontSize: '0.95rem' }}>
                                    <ExternalLink size={16} />
                                    <span>GitHub Repository</span>
                                </a>
                                <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>View source code & documentation.</p>
                            </li>
                            <li>
                                <a href="https://github.com/shieldmonkey/shieldmonkey/issues" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-color)', textDecoration: 'none', fontSize: '0.95rem' }}>
                                    <Bug size={16} />
                                    <span>Report an Issue</span>
                                </a>
                                <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Found a bug? Let us know!</p>
                            </li>
                            <li>
                                <a href="https://github.com/shieldmonkey/shieldmonkey/security" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-color)', textDecoration: 'none', fontSize: '0.95rem' }}>
                                    <Shield size={16} />
                                    <span>Report Vulnerability</span>
                                </a>
                                <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Security issues & advisories.</p>
                            </li>
                        </ul>
                    </div>
                </div>

                <div style={{ marginTop: '24px', padding: '24px', background: 'var(--surface-bg)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                    <h3 style={{ fontSize: '1rem', marginBottom: '16px', fontWeight: 600 }}>About Shieldmonkey</h3>
                    <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, fontSize: '0.95rem', marginBottom: '16px' }}>
                        {t('appDescription')}
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                        <span>Version {chrome.runtime.getManifest().version}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span>Created by:</span>
                            <a href="https://github.com/toshs" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--accent-color)', textDecoration: 'none' }}>
                                <User size={14} />
                                <span>toshs</span>
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Help;

