import { useState, useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { bridge } from '../../bridge/client';
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
    const [version, setVersion] = useState<string>('...');
    const { extensionEnabled, toggleExtension } = useApp();
    const { t } = useI18n();

    useEffect(() => {
        bridge.call<{ version: string }>('GET_APP_INFO').then(info => {
            if (info && info.version) {
                setVersion(info.version);
            }
        }).catch(() => setVersion('0.0.0'));
    }, []);



    return (
        <div className="app-container">
            <aside className="sidebar">
                <div className="sidebar-header">
                    <img src="/icons/icon48.png" className="logo-img" alt={t('appName')} />
                    <h2>{t('appName')}</h2>
                </div>
                <nav className="nav-links">
                    <SidebarLink to="/options/scripts" icon={Terminal} label={t('navScripts')} />
                    <SidebarLink to="/options/settings" icon={Settings} label={t('navSettings')} />
                    <SidebarLink to="/options/help" icon={HelpCircle} label={t('navHelp')} />
                </nav>
                <div style={{ marginTop: 'auto', padding: '16px', borderTop: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                        <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 600 }}>{t('extensionLabel')}</span>
                        <ToggleSwitch checked={extensionEnabled} onChange={toggleExtension} />
                    </div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', textAlign: 'center' }}>
                        v{version}
                    </div>
                </div>
            </aside>

            {/* Mobile Bottom Navigation */}
            <nav className="bottom-nav">
                <SidebarLink to="/options/scripts" icon={Terminal} label={t('navScripts')} />
                <SidebarLink to="/options/settings" icon={Settings} label={t('navSettings')} />
                <SidebarLink to="/options/help" icon={HelpCircle} label={t('navHelp')} />
            </nav>

            <main className="main-content">
                <Outlet />
            </main>
        </div>
    );
};

export default Layout;
