import { ExternalLink, Bug, Shield, User } from 'lucide-react';

const Help = () => {
    return (
        <div className="content-scroll">
            <div style={{ maxWidth: '900px', margin: '0 auto' }}>
                <h2 className="page-title" style={{ marginBottom: '20px' }}>Help & Support</h2>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
                    <div style={{ background: 'var(--surface-bg)', borderRadius: '12px', padding: '20px', border: '1px solid var(--border-color)' }}>
                        <h3 style={{ fontSize: '1rem', marginBottom: '12px', fontWeight: 500 }}>Links</h3>
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
                    <h3 style={{ fontSize: '1rem', marginBottom: '16px', fontWeight: 500 }}>About Shieldmonkey</h3>
                    <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, fontSize: '0.95rem', marginBottom: '16px' }}>
                        Shieldmonkey is a userscript manager built for Manifest V3, utilizing the new <code>chrome.userScripts</code> API for enhanced security and performance.
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
