import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Terminal, Settings, HelpCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';

const Layout = () => {
    const { version } = chrome.runtime.getManifest();

    // Simple sidebar link component
    const SidebarLink = ({ to, icon: Icon, label }: { to: string; icon: any; label: string }) => (
        <NavLink
            to={to}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
            <Icon size={18} />
            <span>{label}</span>
        </NavLink>
    );

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
                <div style={{ marginTop: 'auto', padding: '16px', color: 'var(--text-secondary)', fontSize: '0.8rem', textAlign: 'center' }}>
                    v{version}
                </div>
            </aside>
            <main className="main-content">
                <Outlet />
            </main>
        </div>
    );
};

export default Layout;
