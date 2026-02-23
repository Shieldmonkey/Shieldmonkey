import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import './Install.css';
import { parseMetadata, type Metadata } from '../../../utils/metadataParser';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { vscodeDark, vscodeLight } from '@uiw/codemirror-theme-vscode';
import { useI18n } from '../../context/I18nContext';
import { useApp } from '../context/useApp';
import { bridge } from '../../bridge/client';
import { sanitizeToHttpUrl } from '../../../utils/urlValidator';
import { Info, X } from 'lucide-react';

// ... (Theme type and Script interface remain same)

const Install = () => {
    const [status, setStatus] = useState<'loading' | 'confirm' | 'installing' | 'success' | 'error'>('loading');
    const [scriptUrl, setScriptUrl] = useState<string | null>(null);
    const [referrerUrl, setReferrerUrl] = useState<string | null>(null);
    const [code, setCode] = useState<string>('');
    const [metadata, setMetadata] = useState<Metadata | null>(null);
    const [error, setError] = useState<string>('');

    // Mobile Sidebar State
    const [isMobileInfoOpen, setIsMobileInfoOpen] = useState(false);

    // Track if we have already initialized the install flow
    const initializedRef = useRef(false);

    // Use theme and scripts from context
    const { theme, scripts, saveScript } = useApp();
    const { t } = useI18n();

    // Theme logic handled by AppContext now

    // Theme logic for CodeMirror
    const cmTheme = (theme === 'light' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: light)').matches)) ? vscodeLight : vscodeDark;

    const loadScriptContent = useCallback(async (text: string) => {
        try {
            const meta = parseMetadata(text);
            setCode(text);
            setMetadata(meta);
            setStatus('confirm');
        } catch (e) {
            setStatus('error');
            setError((e as Error).message);
        }
    }, []);

    const existingScript = useMemo(() => {
        if (!metadata || !scripts) return null;
        return scripts.find((s) => {
            const sNamespace = s.namespace || '';
            const mNamespace = metadata.namespace || '';
            return s.name === metadata.name && sNamespace === mNamespace;
        }) || null;
    }, [metadata, scripts]);




    useEffect(() => {
        if (initializedRef.current) return;

        const initialize = async () => {
            // Check for content passed via data:text/html redirection (see background script)
            try {
                if (window.name) {
                    const data = JSON.parse(window.name);
                    if (data && data.type === 'SHIELDMONKEY_INSTALL_DATA' && data.source && data.url) {
                        initializedRef.current = true;
                        setScriptUrl(data.url);
                        if (data.referrer) setReferrerUrl(data.referrer);
                        loadScriptContent(data.source);
                        return;
                    }
                }
            } catch (e) {
                console.warn("Failed to parse window.name for script content", e);
            }

            // Check for installId (Passed via storage from Content Script)
            const searchParams = new URLSearchParams(window.location.search);
            const hash = window.location.hash;
            const hashSearchParams = new URLSearchParams(hash.split('?')[1]);

            const installId = searchParams.get('installId') || hashSearchParams.get('installId');
            const url = searchParams.get('url') || hashSearchParams.get('url');

            const referrer = searchParams.get('referrer') || hashSearchParams.get('referrer') || undefined;
            if (referrer) setReferrerUrl(referrer);

            if (installId) {
                try {
                    const pend = await bridge.call('GET_PENDING_INSTALL', { id: installId });

                    if (pend && pend.content) {
                        initializedRef.current = true;
                        setScriptUrl(pend.url);
                        if (pend.referrer) setReferrerUrl(pend.referrer);
                        loadScriptContent(pend.content);
                        // Cleanup
                        await bridge.call('CLEAR_PENDING_INSTALL', { id: installId });
                    } else {
                        setStatus('error');
                        setError(t('installErrorExpired'));
                    }
                } catch (e) {
                    console.error("Failed to check pending install", e);
                    setStatus('error');
                    setError((e as Error).message);
                }
                return;
            }

            if (!url) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                if ((import.meta as any).env.DEV) {
                    return;
                }
                setStatus('error');
                setError(t('installErrorNoUrl'));
                return;
            }

            setStatus('error');
            setError("Direct installation not permitted. Please use background script fetcher.");
        };

        initialize();

    }, [loadScriptContent, t, scripts, metadata]);

    const handleInstall = async () => {
        if (!metadata || !code) return;
        setStatus('installing');

        const id = existingScript ? existingScript.id : crypto.randomUUID();

        const script = {
            id,
            name: metadata.name,
            namespace: metadata.namespace,
            code: code,
            enabled: true,
            grantedPermissions: (metadata.grant || []).filter(p => p !== 'none'),
            sourceUrl: scriptUrl || undefined, // handle null
            referrerUrl: referrerUrl || undefined,
            installDate: !existingScript ? Date.now() : undefined,
            updateDate: Date.now()
        };

        try {
            await saveScript(script);
            setStatus('success');
            setTimeout(async () => {
                try {
                    await bridge.call('CLOSE_TAB');
                } catch (e) {
                    console.error("Failed to close tab", e);
                    window.close(); // Fallback
                }
            }, 2000);
        } catch (e) {
            setStatus('error');
            setError((e as Error).message);
        }
    };

    const handleCancel = async () => {
        try {
            await bridge.call('CLOSE_TAB');
        } catch (e) {
            console.error("Failed to close tab", e);
            window.close(); // Fallback
        }
    };

    if (status === 'loading') {
        return <div className="install-loading-container" style={{ textAlign: 'center' }}><h2>{t('installLoading')}</h2></div>;
    }

    if (status === 'error') {
        return (
            <div className="install-loading-container">
                <h2>{t('installErrorTitle')}</h2>
                <p style={{ color: '#ff6b6b' }}>{error}</p>
                <div className="actions">
                    <button className="btn-secondary" onClick={handleCancel}>{t('installBtnClose')}</button>
                </div>
            </div>
        );
    }

    if (status === 'success') {
        return (
            <div className="install-loading-container">
                <h2>{t('installSuccessTitle')}</h2>
                <p>{t('installSuccessMsg', [metadata?.name || 'Script'])}</p>
                <p style={{ color: 'var(--text-secondary)' }}>{t('installClosingMsg')}</p>
                <div className="actions">
                    <button className="btn-secondary" onClick={handleCancel}>{t('installBtnCloseNow')}</button>
                </div>
            </div>
        );
    }

    let existingVersion = 'Unknown';
    if (existingScript) {
        try {
            existingVersion = parseMetadata(existingScript.code).version || 'Unknown';
        } catch { /* ignore */ }
    }

    return (
        <div className="install-container">
            {/* Mobile Overlay */}
            {isMobileInfoOpen && (
                <div
                    className="install-sidebar-overlay"
                    onClick={() => setIsMobileInfoOpen(false)}
                />
            )}

            <header className="install-header">
                <div className="install-header-left">
                    <button
                        className="icon-btn mobile-info-toggle"
                        onClick={() => setIsMobileInfoOpen(true)}
                    >
                        <Info size={20} />
                    </button>
                    <img src="/icons/icon48.png" className="logo-img" alt="ShieldMonkey" style={{ width: '32px', height: '32px' }} />
                    <h1>{existingScript ? t('installHeaderUpdate') : t('installHeaderInstall')}</h1>
                    <div className="script-title-badge">
                        <span className="script-name">{metadata?.name}</span>
                        <span className="script-version">v{metadata?.version}</span>
                    </div>
                </div>

                <div className="install-header-center">
                    {/* View Toggle Removed for now as Diff view is not yet implemented in CodeMirror migration */}
                </div>

                <div className="install-header-actions">
                    <button className="btn-secondary" onClick={handleCancel}>{t('installBtnCancel')}</button>
                    <button className="btn-primary" onClick={handleInstall}>
                        {existingScript ? t('installBtnUpdate') : t('installBtnInstall')}
                    </button>
                </div>
            </header>

            <div className="install-content-split">
                <aside className={`install-info-sidebar ${isMobileInfoOpen ? 'open' : ''}`}>
                    <div className="mobile-sidebar-header">
                        <h3>{t('scriptInfo') || 'Script Info'}</h3>
                        <button className="icon-btn" onClick={() => setIsMobileInfoOpen(false)}>
                            <X size={20} />
                        </button>
                    </div>

                    <div className="install-info-section">
                        <h3>Metadata</h3>
                        <div className="install-meta-grid">
                            <div className="meta-label">{t('installMetaAuthor')}</div>
                            <div>{metadata?.author || '-'}</div>

                            <div className="meta-label">{t('installMetaDescription')}</div>
                            <div>{metadata?.description || '-'}</div>

                            {existingScript && (
                                <>
                                    <div className="meta-label">{t('installMetaCurrent')}</div>
                                    <div style={{ color: 'var(--text-secondary)' }}>v{existingVersion}</div>
                                </>
                            )}

                            <div className="meta-label">{t('installMetaSource')}</div>
                            <div style={{ wordBreak: 'break-all', fontSize: '0.85em' }}>
                                <a href={sanitizeToHttpUrl(scriptUrl || '')} target="_blank" rel="noreferrer">{scriptUrl}</a>
                            </div>
                        </div>
                    </div>

                    {(() => {
                        const effectivePermissions = (metadata?.grant || []).filter(p => p !== 'none');
                        if (effectivePermissions.length === 0) return null;

                        return (
                            <div className="install-info-section">
                                <h3>{t('installHeaderPermissions')}</h3>
                                <div className="chip-container">
                                    {effectivePermissions.map(p => (
                                        <span key={p} className="permission-chip">{p}</span>
                                    ))}
                                </div>
                            </div>
                        );
                    })()}

                    {metadata?.match && metadata.match.length > 0 && (
                        <div className="install-info-section">
                            <h3>{t('installHeaderMatches')}</h3>
                            <ul className="match-list">
                                {metadata.match.map(m => (
                                    <li key={m}>{m}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </aside>

                <main className="install-editor-main">
                    <CodeMirror
                        value={code}
                        height="100%"
                        theme={cmTheme}
                        extensions={[javascript({ jsx: true })]}
                        readOnly={true}
                        basicSetup={{
                            lineNumbers: true,
                            foldGutter: true,
                            highlightActiveLine: false, // Read only, maybe don't highlight
                            tabSize: 2,
                        }}
                        style={{
                            fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
                            height: '100%',
                            fontSize: '13px'
                        }}
                    />
                </main>
            </div>
        </div>
    );
};

export default Install;
