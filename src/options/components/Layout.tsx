import { NavLink, Outlet } from 'react-router-dom';
import { Terminal, Settings, HelpCircle } from 'lucide-react';
import { useApp } from '../context/useApp';
import ToggleSwitch from './ToggleSwitch';
import { useI18n } from '../../context/I18nContext';

// Simple sidebar link component
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SidebarLink = ({ to, icon: Icon, label }: { to: string; icon: any; label: string }) => (
    <NavLink
        to={to}
        className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
    >
        <Icon size={18} />
        <span>{label}</span>
    </NavLink>
);

const Layout = () => {
    const { version } = chrome.runtime.getManifest();
    const { extensionEnabled, toggleExtension } = useApp();
    const { t } = useI18n();



    return (
        <div className="app-container">
            <aside className="sidebar">
                <div className="sidebar-header">
                    <img src="/icons/icon48.png" className="logo-img" alt={t('appName')} />
                    <h2>{t('appName')}</h2>
                </div>
                <nav className="nav-links">
                    <SidebarLink to="/scripts" icon={Terminal} label={t('navScripts')} />
                    <SidebarLink to="/settings" icon={Settings} label={t('navSettings')} />
                    <SidebarLink to="/help" icon={HelpCircle} label={t('navHelp')} />
                </nav>
                <div style={{ marginTop: 'auto', padding: '16px', borderTop: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                        <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 500 }}>{t('extensionLabel')}</span>
                        <ToggleSwitch checked={extensionEnabled} onChange={toggleExtension} />
                    </div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', textAlign: 'center' }}>
                        v{version}
                    </div>
                </div>
            </aside>
            <main className="main-content">
                <Outlet />
            </main>
        </div>
    );
};

export default Layout;
