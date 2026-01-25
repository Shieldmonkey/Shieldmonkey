import { NavLink, Outlet } from 'react-router-dom';
import { Terminal, Settings, HelpCircle } from 'lucide-react';
import { useApp } from '../context/useApp';
import ToggleSwitch from './ToggleSwitch';

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



    return (
        <div className="app-container">
            <aside className="sidebar">
                <div className="sidebar-header">
                    <img src="/icons/icon48.png" className="logo-img" alt="Shieldmonkey" />
                    <h2>Shieldmonkey</h2>
                </div>
                <nav className="nav-links">
                    <SidebarLink to="/scripts" icon={Terminal} label="Scripts" />
                    <SidebarLink to="/settings" icon={Settings} label="Settings" />
                    <SidebarLink to="/help" icon={HelpCircle} label="Help" />
                </nav>
                <div style={{ marginTop: 'auto', padding: '16px', borderTop: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                        <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 500 }}>Extension</span>
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
