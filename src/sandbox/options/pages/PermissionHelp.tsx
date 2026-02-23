
import { useState } from 'react';
import { useTranslation } from '../../context/I18nContext';
import { isFirefox } from '../../../utils/browserPolyfill';
import { bridge } from '../../bridge/client';

const PermissionHelp = () => {
    const { t } = useTranslation();
    const [granting, setGranting] = useState(false);

    // Firefox flow
    const isFirefoxBrowser = isFirefox();

    // Chrome specific logic
    const chromeVersion = (() => {
        const match = navigator.userAgent.match(/Chrome\/(\d+)/);
        return (match && match[1]) ? parseInt(match[1], 10) : 0;
    })();
    const isNewWay = chromeVersion >= 138;

    const openExtensionsPage = () => {
        bridge.call('OPEN_EXTENSION_SETTINGS');
    };

    const reloadExtension = () => {
        bridge.call('RELOAD_EXTENSION');
    };

    const handleGrantPermission = async () => {
        setGranting(true);
        const granted = await bridge.call('REQUEST_USER_SCRIPTS_PERMISSION');
        if (granted) {
            reloadExtension();
        } else {
            setGranting(false);
        }
    };

    return (
        <div style={{
            maxWidth: '600px',
            width: '90%',
            padding: '2rem',
            backgroundColor: 'var(--surface-bg, #252526)',
            color: 'var(--text-primary, #e6e6e6)',
            borderRadius: '12px',
            border: '1px solid var(--border-color, #333)',
            textAlign: 'center',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
        }}>
            <h1 style={{ marginBottom: '1rem', color: 'var(--accent-color, #22c55e)', fontSize: '1.8rem' }}>
                {t('permissionHelpTitle')}
            </h1>
            <p style={{ marginBottom: '1.5rem', color: 'var(--text-secondary, #999)', lineHeight: 1.6 }}>
                {t('permissionHelpDesc')}
            </p>

            <div style={{
                textAlign: 'left',
                backgroundColor: 'rgba(0,0,0,0.2)',
                padding: '1.5rem',
                borderRadius: '8px',
                marginBottom: '2rem',
                border: '1px solid var(--border-color, rgba(255,255,255,0.1))'
            }}>
                {isFirefoxBrowser ? (
                    <>
                        <p style={{ marginTop: 0, marginBottom: '1rem', color: 'var(--text-primary, #e6e6e6)', fontWeight: 600 }}>
                            {t('permissionFirefoxTitle')}
                        </p>
                        <p style={{ color: 'var(--text-secondary, #999)' }}>
                            {t('permissionFirefoxDesc')}
                        </p>
                    </>
                ) : isNewWay ? (
                    <>
                        <p style={{ marginTop: 0, marginBottom: '1rem', color: 'var(--text-primary, #e6e6e6)', fontWeight: 600 }}>
                            {t('permissionChromeNewTitle')}
                        </p>
                        <ol style={{ paddingLeft: '1.5rem', margin: 0, color: 'var(--text-primary, #e6e6e6)' }}>
                            <li style={{ marginBottom: '0.75rem' }}>{t('permissionChromeNewStep1')}</li>
                            <li>{t('permissionChromeNewStep2')}</li>
                        </ol>
                    </>
                ) : (
                    <>
                        <p style={{ marginTop: 0, marginBottom: '1rem', color: 'var(--text-primary, #e6e6e6)', fontWeight: 600 }}>
                            {t('permissionChromeInstruction')}
                        </p>
                        <ol style={{ paddingLeft: '1.5rem', margin: 0, color: 'var(--text-primary, #e6e6e6)' }}>
                            <li style={{ marginBottom: '0.75rem' }}>{t('permissionChromeNewStep1')}</li>
                            {chromeVersion > 0 && chromeVersion < 120 ? (
                                <li style={{ color: '#ff6b6b' }}>{t('permissionChromeWarning', chromeVersion.toString())}</li>
                            ) : (
                                <li>{t('permissionChromeOldStep2')}</li>
                            )}
                        </ol>
                        <p style={{ fontSize: '0.9em', marginTop: '1rem', color: 'var(--text-secondary, #999)' }}>
                            <em>{t('permissionChromeNote')}</em>
                        </p>
                    </>
                )}
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                {isFirefoxBrowser ? (
                    <button
                        className="btn-primary"
                        onClick={handleGrantPermission}
                        disabled={granting}
                        style={{ padding: '0.8rem 1.5rem' }}
                    >
                        {t('btnGrantPermission')}
                    </button>
                ) : (
                    <>
                        <button className="btn-secondary" onClick={openExtensionsPage} style={{ padding: '0.8rem 1.5rem' }}>
                            {t('btnOpenSettings')}
                        </button>
                        <button className="btn-primary" onClick={reloadExtension} style={{ padding: '0.8rem 1.5rem' }}>
                            {t('btnReloadExtension')}
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};

export default PermissionHelp;
