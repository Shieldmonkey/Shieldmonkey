import { useEffect, useState, useCallback } from 'react';
import './index.css';
import { parseMetadata, type Metadata } from '../utils/metadataParser';
import Editor, { DiffEditor, loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import { configureMonaco } from '../options/monacoConfig';

// Configure Monaco loader
loader.config({ monaco });

// Import workers
import editorWorkerUrl from 'monaco-editor/esm/vs/editor/editor.worker?worker&url';
import jsonWorkerUrl from 'monaco-editor/esm/vs/language/json/json.worker?worker&url';
import cssWorkerUrl from 'monaco-editor/esm/vs/language/css/css.worker?worker&url';
import htmlWorkerUrl from 'monaco-editor/esm/vs/language/html/html.worker?worker&url';
import tsWorkerUrl from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker&url';

// Define MonacoEnvironment
self.MonacoEnvironment = {
    getWorkerUrl: function (_moduleId, label) {
        if (label === 'json') return chrome.runtime.getURL(jsonWorkerUrl);
        if (label === 'css' || label === 'scss' || label === 'less') return chrome.runtime.getURL(cssWorkerUrl);
        if (label === 'html' || label === 'handlebars' || label === 'razor') return chrome.runtime.getURL(htmlWorkerUrl);
        if (label === 'typescript' || label === 'javascript') return chrome.runtime.getURL(tsWorkerUrl);
        return chrome.runtime.getURL(editorWorkerUrl);
    }
};

type Theme = 'light' | 'dark' | 'system';

interface Script {
    id: string;
    name: string;
    namespace?: string;
    code: string;
    [key: string]: unknown;
}

const Install = () => {
    const [status, setStatus] = useState<'loading' | 'confirm' | 'installing' | 'success' | 'error'>('loading');
    const [scriptUrl, setScriptUrl] = useState<string | null>(null);
    const [code, setCode] = useState<string>('');
    const [metadata, setMetadata] = useState<Metadata | null>(null);
    const [existingScript, setExistingScript] = useState<Script | null>(null);
    const [error, setError] = useState<string>('');
    const [viewMode, setViewMode] = useState<'code' | 'diff'>('code');
    const [theme, setTheme] = useState<Theme>('dark');

    // Theme logic
    useEffect(() => {
        chrome.storage.local.get('theme', (data) => {
            const storedTheme = (data.theme as Theme) || 'dark';
            setTheme(storedTheme);
            if (storedTheme === 'system') {
                const isLight = window.matchMedia('(prefers-color-scheme: light)').matches;
                document.documentElement.setAttribute('data-theme', isLight ? 'light' : 'dark');
            } else {
                document.documentElement.setAttribute('data-theme', storedTheme);
            }
        });
    }, []);

    const effectiveEditorTheme = (theme === 'light' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: light)').matches)) ? 'light' : 'vs-dark';



    useEffect(() => {
        const disposable = configureMonaco(monaco);
        return () => disposable.dispose();
    }, []);

    const loadScriptContent = useCallback(async (text: string) => {
        try {
            const meta = parseMetadata(text);
            setCode(text);
            setMetadata(meta);

            const data = await chrome.storage.local.get('scripts');
            const scripts = (data.scripts as Script[]) || [];

            const existing = scripts.find((s) => {
                const sNamespace = s.namespace || '';
                const mNamespace = meta.namespace || '';
                return s.name === meta.name && sNamespace === mNamespace;
            });

            if (existing) {
                setExistingScript(existing);
                if (existing.code !== text) {
                    setViewMode('diff');
                }
            }

            setStatus('confirm');
        } catch (e) {
            setStatus('error');
            setError((e as Error).message);
        }
    }, []);

    const fetchScript = useCallback(async (url: string) => {
        try {
            // Use background fetching to bypass CSP
            const response = await chrome.runtime.sendMessage({ type: 'FETCH_SCRIPT_CONTENT', url });
            if (!response || !response.success) {
                throw new Error(response.error || 'Failed to fetch script content');
            }
            const text = response.text;
            loadScriptContent(text);
        } catch (e) {
            setStatus('error');
            setError((e as Error).message);
        }
    }, [loadScriptContent]);

    useEffect(() => {
        // Check for content passed via data:text/html redirection (see background script)
        try {
            if (window.name) {
                const data = JSON.parse(window.name);
                if (data && data.type === 'SHIELDMONKEY_INSTALL_DATA' && data.source && data.url) {
                    setScriptUrl(data.url);
                    loadScriptContent(data.source);
                    // Clear window.name to prevent reuse if reloaded manually? 
                    // Maybe better to keep it so reload works? 
                    // Let's keep it.
                    return;
                }
            }
        } catch (e) {
            console.warn("Failed to parse window.name for script content", e);
        }

        // Check for installId (Passed via storage from Content Script)
        const query = new URLSearchParams(window.location.search);
        const installId = query.get('installId');

        if (installId) {
            const key = `pending_install_${installId}`;
            chrome.storage.local.get(key, (data) => {
                const pend = data[key] as { url: string; content: string } | undefined;
                if (pend && pend.content) {
                    setScriptUrl(pend.url);
                    loadScriptContent(pend.content);
                    // Cleanup
                    chrome.storage.local.remove(key);
                } else {
                    setStatus('error');
                    setError('Expired or invalid installation session.');
                }
            });
            return;
        }

        // Fallback: Query param + Fetch
        const url = query.get('url');

        if (!url) {
            setStatus('error');
            setError('No URL provided');
            return;
        }

        setScriptUrl(url);
        fetchScript(url);
    }, [fetchScript, loadScriptContent]);

    const handleInstall = async () => {
        if (!metadata || !code) return;
        setStatus('installing');

        const id = existingScript ? existingScript.id : crypto.randomUUID();
        const updateURL = metadata.updateURL || metadata.downloadURL || scriptUrl;
        const downloadURL = metadata.downloadURL || updateURL || scriptUrl;

        const script = {
            id,
            name: metadata.name,
            namespace: metadata.namespace,
            code: code,
            enabled: true,
            grantedPermissions: (metadata.grant || []).filter(p => p !== 'none'),
            sourceUrl: scriptUrl,
            updateUrl: updateURL,
            downloadUrl: downloadURL
        };

        try {
            await chrome.runtime.sendMessage({ type: 'SAVE_SCRIPT', script });
            setStatus('success');
            setTimeout(() => {
                window.close();
            }, 2000);
        } catch (e) {
            setStatus('error');
            setError((e as Error).message);
        }
    };

    const handleCancel = () => {
        window.close();
    };

    if (status === 'loading') {
        return <div className="container" style={{ textAlign: 'center', paddingTop: '2rem' }}><h2>Loading script...</h2></div>;
    }

    if (status === 'error') {
        return (
            <div className="container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '2rem' }}>
                <h2>Error</h2>
                <p style={{ color: '#ff6b6b' }}>{error}</p>
                <div className="actions">
                    <button className="btn-secondary" onClick={handleCancel}>Close</button>
                    {scriptUrl && <button className="btn-primary" onClick={() => fetchScript(scriptUrl)}>Retry</button>}
                </div>
            </div>
        );
    }

    if (status === 'success') {
        return (
            <div className="container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '2rem' }}>
                <h2>Successfully Installed!</h2>
                <p>{metadata?.name} is now active.</p>
                <p style={{ color: 'var(--text-secondary)' }}>Closing window in 2 seconds...</p>
                <div className="actions">
                    <button className="btn-secondary" onClick={handleCancel}>Close Now</button>
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
        <div className="app-container">
            <header className="header">
                <div className="header-left">
                    <h1>{existingScript ? 'Update Script' : 'Install Script'}</h1>
                    <div className="script-title-badge">
                        <span className="script-name">{metadata?.name}</span>
                        <span className="script-version">v{metadata?.version}</span>
                    </div>
                </div>

                <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                    {existingScript && (
                        <div className="view-toggle" style={{ display: 'flex', background: 'var(--chip-bg)', borderRadius: '6px', padding: '2px' }}>
                            <button
                                className={viewMode === 'code' ? 'btn-primary' : ''}
                                style={{ background: viewMode === 'code' ? undefined : 'transparent', border: 'none', padding: '4px 12px', fontSize: '0.85rem', color: viewMode === 'code' ? undefined : 'var(--text-primary)' }}
                                onClick={() => setViewMode('code')}
                            >
                                Source
                            </button>
                            <button
                                className={viewMode === 'diff' ? 'btn-primary' : ''}
                                style={{ background: viewMode === 'diff' ? undefined : 'transparent', border: 'none', padding: '4px 12px', fontSize: '0.85rem', color: viewMode === 'diff' ? undefined : 'var(--text-primary)' }}
                                onClick={() => setViewMode('diff')}
                            >
                                Diff
                            </button>
                        </div>
                    )}
                </div>

                <div className="header-actions">
                    <button className="btn-secondary" onClick={handleCancel}>Cancel</button>
                    <button className="btn-primary" onClick={handleInstall}>
                        {existingScript ? 'Update' : 'Install'}
                    </button>
                </div>
            </header>

            <div className="content-split">
                <aside className="info-sidebar">
                    <div className="info-section">
                        <h3>Metadata</h3>
                        <div className="meta-grid">
                            <div className="meta-label">Author:</div>
                            <div>{metadata?.author || '-'}</div>

                            <div className="meta-label">Description:</div>
                            <div>{metadata?.description || '-'}</div>

                            {existingScript && (
                                <>
                                    <div className="meta-label">Current:</div>
                                    <div style={{ color: 'var(--text-secondary)' }}>v{existingVersion}</div>
                                </>
                            )}

                            <div className="meta-label">Source:</div>
                            <div style={{ wordBreak: 'break-all', fontSize: '0.85em' }}>
                                <a href={scriptUrl!} target="_blank" rel="noreferrer">{scriptUrl}</a>
                            </div>
                        </div>
                    </div>

                    {(() => {
                        const effectivePermissions = (metadata?.grant || []).filter(p => p !== 'none');
                        if (effectivePermissions.length === 0) return null;

                        return (
                            <div className="info-section">
                                <h3>Permissions</h3>
                                <div className="chip-container">
                                    {effectivePermissions.map(p => (
                                        <span key={p} className="permission-chip">{p}</span>
                                    ))}
                                </div>
                            </div>
                        );
                    })()}

                    {metadata?.match && metadata.match.length > 0 && (
                        <div className="info-section">
                            <h3>Matches</h3>
                            <ul className="match-list">
                                {metadata.match.map(m => (
                                    <li key={m}>{m}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </aside>

                <main className="editor-main">
                    {viewMode === 'diff' && existingScript ? (
                        <DiffEditor
                            height="100%"
                            language="javascript"
                            original={existingScript.code}
                            modified={code}
                            theme={effectiveEditorTheme}
                            options={{
                                readOnly: true,
                                originalEditable: false,
                                minimap: { enabled: true },
                                scrollBeyondLastLine: false,
                                fontSize: 13,
                                scrollbar: {
                                    alwaysConsumeMouseWheel: false,
                                },
                            }}
                        />
                    ) : (
                        <Editor
                            height="100%"
                            defaultLanguage="javascript"
                            value={code}
                            theme={effectiveEditorTheme}
                            options={{
                                readOnly: true,
                                minimap: { enabled: true },
                                scrollBeyondLastLine: false,
                                fontSize: 13,
                                scrollbar: {
                                    alwaysConsumeMouseWheel: false,
                                },
                                quickSuggestions: { other: true, comments: true, strings: true },
                                tabCompletion: 'on'
                            }}
                        />
                    )}
                </main>
            </div>
        </div>
    );
};

export default Install;
