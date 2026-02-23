import { ExternalLink, Bug, Shield, User, Key, CheckCircle, AlertCircle, Globe } from 'lucide-react';
import { useState, useEffect } from 'react';
import { isFirefox } from '../../../utils/browserPolyfill';
import { useTranslation } from '../../context/I18nContext';
import { bridge } from '../../bridge/client';

const Help = () => {
    const { t } = useTranslation();
    const [hasPermission, setHasPermission] = useState<boolean | null>(null);
    const [appVersion, setAppVersion] = useState<string>('');
    const isFirefoxBrowser = isFirefox();

    useEffect(() => {
        let mounted = true;
        const check = async () => {
            // Check permission via bridge
            try {
                const has = await bridge.call('CHECK_USER_SCRIPTS_PERMISSION');
                if (mounted) setHasPermission(has);

                // Fetch version
                const info = await bridge.call('GET_APP_INFO');
                if (mounted && info && info.version) setAppVersion(info.version);
            } catch (e) {
                console.error("Failed to check permission or version", e);
            }
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
        try {
            const granted = await bridge.call('REQUEST_USER_SCRIPTS_PERMISSION');
            setHasPermission(granted);
            if (granted) {
                bridge.call('RELOAD_EXTENSION');
            }
        } catch (e) {
            console.error("Failed to request permission", e);
        }
    };

    const openExtensionsPage = async () => {
        if (isFirefoxBrowser) {
            console.warn('Firefox does not support opening about:addons via tabs.create');
            return;
        }

        try {
            await bridge.call('OPEN_EXTENSION_SETTINGS');
        } catch (e) {
            console.error("Failed to open extension settings", e);
        }
    };

    return (
        <div className="content-scroll">
            <div style={{ maxWidth: '900px', margin: '0 auto' }}>
                <h2 className="page-title" style={{ marginBottom: '20px' }}>{t('navHelp')}</h2>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>

                    {/* Permissions Section */}
                    <div id="permission-help" style={{ background: 'var(--surface-bg)', borderRadius: '12px', padding: '20px', border: '1px solid var(--border-color)' }}>
                        <h3 style={{ fontSize: '1rem', marginBottom: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Key size={18} />
                            <span>{t('installHeaderPermissions')}</span>
                        </h3>

                        {hasPermission !== null && (
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                padding: '16px',
                                background: hasPermission ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                border: `1px solid ${hasPermission ? 'var(--accent-color)' : '#ef4444'}`,
                                borderRadius: '8px',
                                marginBottom: '16px'
                            }}>
                                {hasPermission ? (
                                    <CheckCircle size={24} color="var(--accent-color)" />
                                ) : (
                                    <AlertCircle size={24} color="#ef4444" />
                                )}
                                <div>
                                    <div style={{ fontWeight: 600, color: hasPermission ? 'var(--accent-color)' : '#ef4444' }}>
                                        {hasPermission ? t('permissionStatusActive') : t('permissionMissing')}
                                    </div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                        {hasPermission ? t('permissionGrantedDesc') : t('permissionMissingDesc')}
                                    </div>
                                </div>
                            </div>
                        )}

                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '16px', lineHeight: 1.5 }}>
                            {t('permissionHelpDesc')}
                        </p>

                        {/* Button for Firefox */}
                        {isFirefoxBrowser && hasPermission === false && (
                            <button
                                onClick={handleRequestPermission}
                                className="btn-primary"
                                style={{ width: '100%', justifyContent: 'center' }}
                            >
                                {t('btnGrantPermission')}
                            </button>
                        )}

                        {/* Button for Chrome */}
                        {!isFirefoxBrowser && !hasPermission && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <button
                                    onClick={openExtensionsPage}
                                    className="btn-primary"
                                    style={{ width: '100%', justifyContent: 'center' }}
                                >
                                    {t('btnOpenSettings')}
                                </button>
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
                                    {t('permissionChromeNote')}
                                </p>
                            </div>
                        )}

                        {/* Status if already good (Chrome mainly, or Firefox fallback) */}
                        {!isFirefoxBrowser && hasPermission && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <button onClick={openExtensionsPage} className="btn-secondary" style={{ width: '100%', justifyContent: 'center' }}>
                                    {t('btnOpenSettings')}
                                </button>
                            </div>
                        )}
                        {isFirefoxBrowser && hasPermission && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', background: 'rgba(34, 197, 94, 0.1)', borderRadius: '8px' }}>
                                <CheckCircle size={20} color="var(--accent-color)" />
                                <span style={{ color: 'var(--accent-color)', fontWeight: 500 }}>{t('permissionStatusActive')}</span>
                            </div>
                        )}
                    </div>

                    <div style={{ background: 'var(--surface-bg)', borderRadius: '12px', padding: '20px', border: '1px solid var(--border-color)' }}>
                        <h3 style={{ fontSize: '1rem', marginBottom: '12px', fontWeight: 600 }}>{t('helpHeaderLinks')}</h3>
                        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <li>
                                <a href="https://shieldmonkey.github.io/" onClick={(e) => { e.preventDefault(); bridge.call('OPEN_URL', 'https://shieldmonkey.github.io/'); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-color)', textDecoration: 'none', fontSize: '0.95rem' }}>
                                    <Globe size={16} />
                                    <span>{t('linkWebsite')}</span>
                                </a>
                                <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{t('linkWebsiteDesc')}</p>
                            </li>
                            <li>
                                <a href="https://github.com/shieldmonkey/shieldmonkey" onClick={(e) => { e.preventDefault(); bridge.call('OPEN_URL', 'https://github.com/shieldmonkey/shieldmonkey'); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-color)', textDecoration: 'none', fontSize: '0.95rem' }}>
                                    <ExternalLink size={16} />
                                    <span>{t('linkGithubRepo')}</span>
                                </a>
                                <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{t('linkGithubRepoDesc')}</p>
                            </li>
                            <li>
                                <a href="https://github.com/shieldmonkey/shieldmonkey/issues" onClick={(e) => { e.preventDefault(); bridge.call('OPEN_URL', 'https://github.com/shieldmonkey/shieldmonkey/issues'); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-color)', textDecoration: 'none', fontSize: '0.95rem' }}>
                                    <Bug size={16} />
                                    <span>{t('linkReportIssue')}</span>
                                </a>
                                <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{t('linkReportIssueDesc')}</p>
                            </li>
                            <li>
                                <a href="https://github.com/shieldmonkey/shieldmonkey/security" onClick={(e) => { e.preventDefault(); bridge.call('OPEN_URL', 'https://github.com/shieldmonkey/shieldmonkey/security'); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-color)', textDecoration: 'none', fontSize: '0.95rem' }}>
                                    <Shield size={16} />
                                    <span>{t('linkReportVuln')}</span>
                                </a>
                                <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{t('linkReportVulnDesc')}</p>
                            </li>
                        </ul>
                    </div>
                </div>

                <div style={{ marginTop: '24px', padding: '24px', background: 'var(--surface-bg)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                    <h3 style={{ fontSize: '1rem', marginBottom: '16px', fontWeight: 600 }}>{t('helpHeaderAbout')}</h3>
                    <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, fontSize: '0.95rem', marginBottom: '16px' }}>
                        {t('appDescription')}
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                        <span>{t('helpVersionPrefix')} {appVersion}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span>{t('helpCreatedBy')}</span>
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

