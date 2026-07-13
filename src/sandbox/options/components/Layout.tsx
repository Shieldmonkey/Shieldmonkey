import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { CircleHelp, Settings, ShieldCheck, Terminal } from 'lucide-react';
import { bridge } from '../../bridge/client';
import { useApp } from '../context/useApp';
import ToggleSwitch from './ToggleSwitch';
import { InlineNotice } from './ui';
import { useI18n } from '../../context/I18nContext';

const links = [
    { to: '/options/scripts', icon: Terminal, key: 'navScripts' },
    { to: '/options/settings', icon: Settings, key: 'navSettings' },
    { to: '/options/help', icon: CircleHelp, key: 'navHelp' }
] as const;

export default function Layout() {
    const [version, setVersion] = useState('…');
    const { extensionEnabled, toggleExtension, operationError, clearOperationError } = useApp();
    const { t } = useI18n();
    useEffect(() => { bridge.call('GET_APP_INFO').then(info => setVersion(info.version)).catch(() => setVersion('0.0.0')); }, []);

    return <div className="security-shell">
        <aside className="security-sidebar">
            <div className="brand-lockup"><img src="/icons/icon48.png" alt="" /><div><strong>{t('appName')}</strong><span>{t('utilityLabel')}</span></div></div>
            <nav className="security-nav" aria-label="Main navigation">{links.map(({ to, icon: Icon, key }) => <NavLink key={to} to={to} className={({ isActive }) => isActive ? 'active' : ''}><Icon size={18} /><span>{t(key)}</span></NavLink>)}</nav>
            <div className="sidebar-status"><div><span className={`status-dot ${extensionEnabled ? 'active' : ''}`} /><div><strong>{extensionEnabled ? t('globalStatusActive') : t('globalStatusPaused')}</strong><span>v{version}</span></div></div><ToggleSwitch checked={extensionEnabled} onChange={toggleExtension} ariaLabel={t('extensionLabel')} /></div>
        </aside>
        <div className="security-workspace">
            <header className="mobile-console-header"><div className="brand-lockup"><img src="/icons/icon48.png" alt="" /><strong>{t('appName')}</strong></div><span className={`status-pill ${extensionEnabled ? 'active' : ''}`}><ShieldCheck size={14} />{extensionEnabled ? t('globalStatusActive') : t('globalStatusPaused')}</span></header>
            {!extensionEnabled && <div className="global-paused-banner" role="status">{t('globalPausedBanner')}</div>}
            {operationError && <div className="shell-notice"><InlineNotice tone="error" onDismiss={clearOperationError}>{operationError}</InlineNotice></div>}
            <main className="security-content"><Outlet /></main>
        </div>
        <nav className="mobile-bottom-nav" aria-label="Main navigation">{links.map(({ to, icon: Icon, key }) => <NavLink key={to} to={to} className={({ isActive }) => isActive ? 'active' : ''}><Icon size={19} /><span>{t(key)}</span></NavLink>)}</nav>
    </div>;
}
