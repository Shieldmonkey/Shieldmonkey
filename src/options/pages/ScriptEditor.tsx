import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import { ArrowLeft, Save, Trash2, Info, Shield, Globe, Link as LinkIcon, X } from 'lucide-react';
import { useApp } from '../context/useApp';
import { useModal } from '../context/useModal';
import PermissionModal from '../PermissionModal';
import { parseMetadata } from '../../utils/metadataParser';
import { type Script } from '../types';
import { useI18n } from '../../context/I18nContext';

const ScriptEditor = () => {
    const { id } = useParams<{ id: string }>();
    const isNew = !id || id === 'new';
    const navigate = useNavigate();
    const { scripts, saveScript, deleteScript } = useApp();
    const { showModal: showGenericModal } = useModal();
    const { t } = useI18n();

    // Find script from context
    const scriptFromContext = scripts.find((s: Script) => s.id === id);

    // Initial state setup
    const [code, setCode] = useState<string>('');
    const [name, setName] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    // New script specific state
    const [newScriptId] = useState(() => crypto.randomUUID());

    // Permission Modal
    const [permissionModalOpen, setPermissionModalOpen] = useState(false);
    const [requestedPermissions, setRequestedPermissions] = useState<string[]>([]);
    const [pendingSaveResolved, setPendingSaveResolved] = useState<((allowed: boolean) => void) | null>(null);

    // Mobile Sidebar State
    const [isMobileInfoOpen, setIsMobileInfoOpen] = useState(false);

    // Track if we have initialized
    const initializedRef = useRef(false);

    useEffect(() => {
        if (!initializedRef.current) {
            if (isNew) {
                // Initialize new script
                const params = new URLSearchParams(window.location.search);
                const matchUrl = params.get('match') || 'http://*/*';

                const template = `// ==UserScript==
// @name        New Script
// @namespace   Violentmonkey Scripts
// @match       ${matchUrl}
// @grant       none
// @version     1.0
// @author      -
// @description 
// ==/UserScript==

(function() {
    'use strict';
    // Your code here...
})();
`;
                setCode(template);
                setName('New Script');
                initializedRef.current = true;
            } else if (scriptFromContext) {
                // Initialize existing script
                setCode(scriptFromContext.code);
                setName(scriptFromContext.name);
                initializedRef.current = true;
            }
        }
    }, [scriptFromContext, isNew]);

    // For existing scripts, if we change IDs (renaming? no), or just switching scripts
    useEffect(() => {
        if (!isNew && scriptFromContext && scriptFromContext.id !== id) {
            // ID changed in URL but we might need to reset if we haven't? 
            // Actually, the key prop on Route usually handles component reset, 
            // but here we obey the same component.
            setCode(scriptFromContext.code);
            setName(scriptFromContext.name);
        }
    }, [scriptFromContext, id, isNew]);


    const lastSavedCode = isNew ? '' : (scriptFromContext?.lastSavedCode || '');
    const isDirty = code !== lastSavedCode;

    const handleSave = useCallback(async () => {
        setIsSaving(true);
        try {
            const currentCode = code;
            const metadata = parseMetadata(currentCode);
            const requested = metadata.grant || [];
            const needed = requested.filter(p => p !== 'none');

            const currentGranted = new Set(isNew ? [] : (scriptFromContext?.grantedPermissions || []));
            const newPermissions = needed.filter(p => !currentGranted.has(p));

            let grantedPermissions = isNew ? [] : scriptFromContext?.grantedPermissions;

            if (newPermissions.length > 0) {
                const allowed = await new Promise<boolean>((resolve) => {
                    setRequestedPermissions(newPermissions);
                    setPendingSaveResolved(() => resolve);
                    setPermissionModalOpen(true);
                });

                if (!allowed) {
                    setIsSaving(false);
                    return;
                }
                grantedPermissions = Array.from(new Set([...(grantedPermissions || []), ...newPermissions]));
            }

            const updatedScript: Script = {
                id: isNew ? newScriptId : scriptFromContext!.id,
                name: metadata.name || (isNew ? 'New Script' : scriptFromContext!.name),
                namespace: metadata.namespace || (isNew ? undefined : scriptFromContext!.namespace),
                code: currentCode,
                enabled: isNew ? true : scriptFromContext!.enabled,
                grantedPermissions,
                installDate: isNew ? Date.now() : scriptFromContext!.installDate,
                updateDate: Date.now()
            };

            await saveScript(updatedScript);
            setName(updatedScript.name);

            if (isNew) {
                // Navigate to the edit URL for the new script so we are no longer in "new" mode
                // Replace: true so we don't go back to /new
                navigate(`/scripts/${updatedScript.id}`, { replace: true });
            }

        } catch (e) {
            console.error("Failed to save", e);
            showGenericModal('error', t('editorSaveFailed'), (e as Error).message);
        } finally {
            setIsSaving(false);
        }
    }, [code, scriptFromContext, saveScript, showGenericModal, t, isNew, newScriptId, navigate]);

    const handleDelete = () => {
        if (isNew) {
            navigate('/scripts');
            return;
        }
        if (!scriptFromContext) return;
        showGenericModal('confirm', t('editorConfirmDeleteTitle'), t('editorConfirmDeleteMsg'), async () => {
            await deleteScript(scriptFromContext.id);
            navigate('/scripts');
        });
    };

    const handlePermissionConfirm = () => {
        setPermissionModalOpen(false);
        if (pendingSaveResolved) pendingSaveResolved(true);
        setPendingSaveResolved(null);
    };

    const handlePermissionCancel = () => {
        setPermissionModalOpen(false);
        if (pendingSaveResolved) pendingSaveResolved(false);
        setPendingSaveResolved(null);
    };

    // Keyboard shortcut
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                handleSave();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleSave]);

    // Warn on unsaved changes
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (isDirty) {
                e.preventDefault();
                e.returnValue = '';
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [isDirty]);

    // Block navigation if dirty using a custom check since React Router v6 doesn't have usePrompt/useBlocker stable yet in all versions
    // But since we are using useNavigate() for our own buttons:
    const handleBack = () => {
        if (isDirty) {
            showGenericModal('confirm', t('unsavedChangesTitle') || 'Unsaved Changes', t('unsavedChangesMsg') || 'You have unsaved changes. Are you sure you want to leave?', () => {
                navigate('/scripts');
            });
        } else {
            navigate('/scripts');
        }
    };

    // Theme handling for Monaco
    const { theme } = useApp();
    const editorTheme = theme === 'light' ? 'vs' : 'vs-dark';

    if (!isNew && !scriptFromContext) {
        if (scripts.length === 0) return <div>{t('editorLoading')}</div>;
        return <div>{t('editorScriptNotFound')}</div>;
    }

    // Metadata for header/sidebar info
    const metadata = parseMetadata(code);
    const sourceUrl = scriptFromContext?.sourceUrl;
    const referrerUrl = scriptFromContext?.referrerUrl;

    // URL truncation helper
    const formatDisplayUrl = (urlStr: string) => {
        if (!urlStr) return '';
        try {
            if (urlStr.length <= 60) return urlStr;
            const url = new URL(urlStr);
            const origin = url.origin;
            const pathname = url.pathname;
            const filename = pathname.split('/').pop();

            if (pathname === '/' || !filename) {
                return `${origin}/...`;
            }
            return `${origin}/.../${filename}`;
        } catch {
            return urlStr.length > 60 ? `${urlStr.slice(0, 40)}...` : urlStr;
        }
    };

    return (
        <div className="app-container">
            {/* Mobile Overlay */}
            {isMobileInfoOpen && (
                <div
                    className="script-editor-sidebar-overlay"
                    onClick={() => setIsMobileInfoOpen(false)}
                />
            )}

            <aside className={`script-editor-sidebar ${isMobileInfoOpen ? 'open' : ''}`}>
                <div
                    className="sidebar-header"
                    style={{ cursor: 'pointer', justifyContent: 'space-between', paddingLeft: '24px', paddingRight: '16px' }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                            className="icon-btn"
                            onClick={() => navigate('/scripts')}
                            title={t('backToScripts')}
                            style={{ padding: '8px', marginLeft: '-8px' }}
                        >
                            <ArrowLeft size={20} />
                        </button>
                        <h2 style={{ fontSize: '1rem', color: 'var(--text-secondary)', margin: 0 }}>{t('scriptInfo')}</h2>
                    </div>
                    {/* Mobile Close Button */}
                    <button
                        className="icon-btn mobile-toggle-btn"
                        onClick={() => setIsMobileInfoOpen(false)}
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="content-scroll" style={{ padding: '0 24px 24px 24px' }}>

                    {/* Info Section */}
                    <div style={{ marginBottom: '32px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: 'var(--accent-color)' }}>
                            <Info size={16} />
                            <h3 style={{ margin: 0, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('editorHeaderInfo')}</h3>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '12px 16px', fontSize: '0.85rem' }}>
                            {/* Name & Namespace (Mobile: visible here) */}
                            <div style={{ color: 'var(--text-secondary)' }}>{t('editorLabelName')}</div>
                            <div style={{ wordBreak: 'break-all', fontWeight: 600 }}>{name}</div>

                            <div style={{ color: 'var(--text-secondary)' }}>{t('editorLabelNamespace')}</div>
                            <div style={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>{metadata.namespace || '-'}</div>

                            <div style={{ color: 'var(--text-secondary)' }}>{t('editorLabelVersion')}</div>
                            <div style={{ fontFamily: 'monospace' }}>{metadata.version || '-'}</div>

                            <div style={{ color: 'var(--text-secondary)' }}>{t('editorLabelAuthor')}</div>
                            <div>{metadata.author || '-'}</div>

                            <div style={{ color: 'var(--text-secondary)' }}>{t('editorLabelInstalled')}</div>
                            <div>{scriptFromContext?.installDate ? new Date(scriptFromContext.installDate).toLocaleDateString() : '-'}</div>

                            {referrerUrl && (
                                <>
                                    <div style={{ color: 'var(--text-secondary)' }}>{t('editorLabelPage')}</div>
                                    <div style={{ wordBreak: 'break-all' }}>
                                        <a href={referrerUrl} target="_blank" rel="noopener noreferrer" title={referrerUrl} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <LinkIcon size={12} style={{ flexShrink: 0 }} />
                                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{formatDisplayUrl(referrerUrl)}</span>
                                        </a>
                                    </div>
                                </>
                            )}

                            {sourceUrl && (
                                <>
                                    <div style={{ color: 'var(--text-secondary)' }}>{t('editorLabelSource')}</div>
                                    <div style={{ wordBreak: 'break-all' }}>
                                        <a href={sourceUrl} target="_blank" rel="noopener noreferrer" title={sourceUrl} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <LinkIcon size={12} style={{ flexShrink: 0 }} />
                                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{formatDisplayUrl(sourceUrl)}</span>
                                        </a>
                                    </div>
                                </>

                            )}

                            {(metadata.updateURL || scriptFromContext?.updateUrl) && (
                                <>
                                    <div style={{ color: 'var(--text-secondary)' }}>{t('editorLabelUpdate')}</div>
                                    <div style={{ wordBreak: 'break-all' }}>
                                        <a href={metadata.updateURL || scriptFromContext?.updateUrl} target="_blank" rel="noopener noreferrer" title={metadata.updateURL || scriptFromContext?.updateUrl} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <LinkIcon size={12} style={{ flexShrink: 0 }} />
                                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{formatDisplayUrl(metadata.updateURL || scriptFromContext?.updateUrl || '')}</span>
                                        </a>
                                    </div>
                                </>
                            )}

                            {(metadata.downloadURL || scriptFromContext?.downloadUrl) && (
                                <>
                                    <div style={{ color: 'var(--text-secondary)' }}>{t('editorLabelDownload')}</div>
                                    <div style={{ wordBreak: 'break-all' }}>
                                        <a href={metadata.downloadURL || scriptFromContext?.downloadUrl} target="_blank" rel="noopener noreferrer" title={metadata.downloadURL || scriptFromContext?.downloadUrl} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <LinkIcon size={12} style={{ flexShrink: 0 }} />
                                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{formatDisplayUrl(metadata.downloadURL || scriptFromContext?.downloadUrl || '')}</span>
                                        </a>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Permissions Section */}
                    {
                        (metadata.grant || []).filter(p => p !== 'none').length > 0 && (
                            <div style={{ marginBottom: '32px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: 'var(--accent-color)' }}>
                                    <Shield size={16} />
                                    <h3 style={{ margin: 0, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('editorHeaderPermissions')}</h3>
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                    {(metadata.grant || []).filter(p => p !== 'none').map(p => (
                                        <span key={p} style={{
                                            fontSize: '0.75rem',
                                            padding: '4px 8px',
                                            background: 'rgba(255,255,255,0.05)',
                                            borderRadius: '4px',
                                            color: 'var(--text-primary)',
                                            fontFamily: 'monospace'
                                        }}>
                                            {p}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )
                    }

                    {/* Matches Section */}
                    {
                        (metadata.match || []).length > 0 && (
                            <div style={{ marginBottom: '32px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: 'var(--accent-color)' }}>
                                    <Globe size={16} />
                                    <h3 style={{ margin: 0, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('editorHeaderMatches')}</h3>
                                </div>
                                <ul style={{
                                    listStyle: 'none',
                                    padding: 0,
                                    margin: 0,
                                    fontSize: '0.8rem',
                                    fontFamily: 'monospace',
                                    color: 'var(--text-secondary)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '8px'
                                }}>
                                    {metadata.match.map((m, i) => (
                                        <li key={i} style={{ wordBreak: 'break-all' }}>{m}</li>
                                    ))}
                                </ul>
                            </div>
                        )
                    }

                </div >
            </aside >

            <main className="main-content">
                <header className="editor-header">
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        {/* Mobile Back Button */}
                        <button
                            className="icon-btn mobile-toggle-btn"
                            style={{ marginRight: '8px' }}
                            onClick={handleBack}
                        >
                            <ArrowLeft size={20} />
                        </button>

                        {/* Mobile Info Toggle */}
                        <button
                            className="icon-btn mobile-toggle-btn"
                            style={{ marginRight: '12px' }}
                            onClick={() => setIsMobileInfoOpen(true)}
                        >
                            <Info size={20} />
                        </button>
                    </div>

                    <div className="script-info-header" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        <input
                            type="text"
                            className="script-name-input"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            readOnly
                            title={t('nameDefinedInMetadata')}
                            style={{ cursor: 'default', marginLeft: 0 }}
                        />
                        {metadata.namespace && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {metadata.namespace}
                            </span>
                        )}
                    </div>


                    <div className="editor-actions">
                        <button
                            className="btn-primary"
                            onClick={handleSave}
                            disabled={!isDirty || isSaving}
                        >
                            <Save size={16} />
                            <span>{isSaving ? t('editorBtnSaving') : t('editorBtnSave')}</span>
                        </button>
                        <button
                            className="btn-secondary"
                            onClick={handleDelete}
                            style={{ color: '#ef4444', borderColor: '#fee2e2' }}
                        >
                            <Trash2 size={16} />
                        </button>
                    </div>
                </header>

                <div className="monaco-wrapper">
                    <Editor
                        height="100%"
                        defaultLanguage="javascript"
                        path={`script-${id}.js`}
                        theme={editorTheme}
                        value={code}
                        onChange={(value) => {
                            setCode(value || '');
                            if (value) {
                                const metadata = parseMetadata(value);
                                if (metadata.name && metadata.name !== name) {
                                    setName(metadata.name);
                                }
                            }
                        }}
                        onMount={(editor, monaco) => {
                            // Detect if on Mac
                            const isMac = navigator.userAgent.includes('Mac');
                            if (isMac) {
                                // Add Emacs-style bindings for Mac
                                // Ctrl+P: Cursor Up
                                editor.addCommand(monaco.KeyMod.WinCtrl | monaco.KeyCode.KeyP, () => {
                                    editor.trigger('keyboard', 'cursorUp', null);
                                });
                                // Ctrl+N: Cursor Down
                                editor.addCommand(monaco.KeyMod.WinCtrl | monaco.KeyCode.KeyN, () => {
                                    editor.trigger('keyboard', 'cursorDown', null);
                                });
                                // Ctrl+F: Cursor Right (Default usually might be find, but we want cursor right for Emacs)
                                editor.addCommand(monaco.KeyMod.WinCtrl | monaco.KeyCode.KeyF, () => {
                                    editor.trigger('keyboard', 'cursorRight', null);
                                });
                                // Ctrl+B: Cursor Left
                                editor.addCommand(monaco.KeyMod.WinCtrl | monaco.KeyCode.KeyB, () => {
                                    editor.trigger('keyboard', 'cursorLeft', null);
                                });
                                // Ctrl+A: Cursor Home
                                editor.addCommand(monaco.KeyMod.WinCtrl | monaco.KeyCode.KeyA, () => {
                                    editor.trigger('keyboard', 'cursorHome', null);
                                });
                                // Ctrl+E: Cursor End
                                editor.addCommand(monaco.KeyMod.WinCtrl | monaco.KeyCode.KeyE, () => {
                                    editor.trigger('keyboard', 'cursorEnd', null);
                                });

                                // Ensure Cmd+F triggers Find (Monaco defaults usually handle this if OS detected, but we force it)
                                editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF, () => {
                                    editor.trigger('keyboard', 'actions.find', null);
                                });
                                // Ensure Cmd+Z triggers Undo
                                editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyZ, () => {
                                    editor.trigger('keyboard', 'undo', null);
                                });

                                // Unbind conflicting Ctrl commands if necessary?
                                // Monaco's addCommand with matching keychord usually overrides.
                            }
                        }}
                        options={{
                            minimap: { enabled: false },
                            fontSize: 14,
                            fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
                            fontLigatures: true,
                            wordWrap: 'on',
                            automaticLayout: true,
                            scrollBeyondLastLine: false,
                            padding: { top: 16, bottom: 16 }
                        }}
                    />
                </div>
            </main>

            <PermissionModal
                isOpen={permissionModalOpen}
                scriptName={scriptFromContext?.name || name}
                permissions={requestedPermissions}
                onConfirm={handlePermissionConfirm}
                onCancel={handlePermissionCancel}
            />
        </div >
    );
};

export default ScriptEditor;
