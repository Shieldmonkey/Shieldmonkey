import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import CodeMirror from '@uiw/react-codemirror';

import { javascript, scopeCompletionSource } from '@codemirror/lang-javascript';
import { userScriptMetadataCompletion } from '../codemirrorConfig';
import { vscodeDark, vscodeLight } from '@uiw/codemirror-theme-vscode';
import { ArrowLeft, Save, Trash2, Info, Shield, Globe, Link as LinkIcon, X, Loader, Check, FileJson } from 'lucide-react';
import * as prettier from "prettier/standalone";
import * as parserBabel from "prettier/plugins/babel";
import * as parserEstree from "prettier/plugins/estree";
import { useApp } from '../context/useApp';
import { useModal } from '../context/useModal';
import { parseMetadata } from '../../utils/metadataParser';
import { isValidHttpUrl } from '../../utils/urlValidator';
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
    const [isSaved, setIsSaved] = useState(false); // Success state

    // New script specific state
    const [newScriptId] = useState(() => crypto.randomUUID());

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
// @namespace   ShieldMonkey Scripts
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

            // Always sync granted permissions with metadata
            const grantedPermissions = needed;


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

            setIsSaved(true);
            setTimeout(() => {
                setIsSaved(false);
            }, 2000);

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

    const handleFormat = useCallback(async () => {
        try {
            const formatted = await prettier.format(code, {
                parser: "babel",
                plugins: [parserBabel, parserEstree],
                semi: true,
                singleQuote: true,
                tabWidth: 2,
                trailingComma: 'none'
            });
            setCode(formatted);
        } catch (e) {
            console.error("Format failed", e);
            // Optionally show toast/error
        }
    }, [code]);

    // Keyboard shortcut
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                handleSave();
            }
            // Format shortcut (Shift+Alt+F or Cmd+Shift+P -> Format... but let's just do Shift+Alt+F)
            if (e.shiftKey && e.altKey && (e.key === 'f' || e.key === 'F')) {
                e.preventDefault();
                handleFormat();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleSave, handleFormat]);

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

    // Theme handling for CodeMirror
    const { theme } = useApp();
    const cmTheme = theme === 'light' ? vscodeLight : vscodeDark;

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
                    style={{
                        cursor: 'pointer',
                        justifyContent: 'space-between',
                        paddingLeft: '24px',
                        paddingRight: '16px',
                        height: '60px',
                        display: 'flex',
                        alignItems: 'center',
                        boxSizing: 'border-box'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Info size={16} />
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

                            {isValidHttpUrl(referrerUrl) && (
                                <>
                                    <div style={{ color: 'var(--text-secondary)' }}>{t('editorLabelPage')}</div>
                                    <div style={{ wordBreak: 'break-all' }}>
                                        <a href={referrerUrl} target="_blank" rel="noopener noreferrer" title={referrerUrl} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <LinkIcon size={12} style={{ flexShrink: 0 }} />
                                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{formatDisplayUrl(referrerUrl!)}</span>
                                        </a>
                                    </div>
                                </>
                            )}

                            {isValidHttpUrl(sourceUrl) && (
                                <>
                                    <div style={{ color: 'var(--text-secondary)' }}>{t('editorLabelSource')}</div>
                                    <div style={{ wordBreak: 'break-all' }}>
                                        <a href={sourceUrl} target="_blank" rel="noopener noreferrer" title={sourceUrl} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <LinkIcon size={12} style={{ flexShrink: 0 }} />
                                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{formatDisplayUrl(sourceUrl!)}</span>
                                        </a>
                                    </div>
                                </>

                            )}

                            {isValidHttpUrl(metadata.updateURL) && (
                                <>
                                    <div style={{ color: 'var(--text-secondary)' }}>{t('editorLabelUpdate')}</div>
                                    <div style={{ wordBreak: 'break-all' }}>
                                        <a href={metadata.updateURL} target="_blank" rel="noopener noreferrer" title={metadata.updateURL} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <LinkIcon size={12} style={{ flexShrink: 0 }} />
                                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{formatDisplayUrl(metadata.updateURL!)}</span>
                                        </a>
                                    </div>
                                </>
                            )}

                            {isValidHttpUrl(metadata.downloadURL) && (
                                <>
                                    <div style={{ color: 'var(--text-secondary)' }}>{t('editorLabelDownload')}</div>
                                    <div style={{ wordBreak: 'break-all' }}>
                                        <a href={metadata.downloadURL} target="_blank" rel="noopener noreferrer" title={metadata.downloadURL} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <LinkIcon size={12} style={{ flexShrink: 0 }} />
                                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{formatDisplayUrl(metadata.downloadURL!)}</span>
                                        </a>
                                    </div>
                                </>
                            )}

                        </div>
                    </div>

                    {/* Delete Script Button */}
                    <div style={{ marginBottom: '32px' }}>
                        <button
                            className="btn-secondary"
                            onClick={handleDelete}
                            style={{
                                color: '#ef4444',
                                borderColor: 'var(--border-color)',
                                width: '100%',
                                justifyContent: 'center',
                                padding: '10px'
                            }}
                        >
                            <Trash2 size={16} />
                            <span>{t('editorBtnDelete') || "Delete Script"}</span>
                        </button>
                    </div>

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
                                        <span key={p} className="permission-chip">
                                            {p}
                                        </span>
                                    ))}
                                </div>
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
                            style={{ marginRight: '8px', padding: '6px' }}
                            onClick={handleBack}
                        >
                            <ArrowLeft size={18} />
                        </button>

                        {/* Mobile Info Toggle */}
                        <button
                            className="icon-btn mobile-toggle-btn"
                            style={{ marginRight: '12px', padding: '6px' }}
                            onClick={() => setIsMobileInfoOpen(true)}
                        >
                            <Info size={18} />
                        </button>
                    </div>

                    <div className="script-info-header" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1, minWidth: 0, paddingLeft: '16px' }}>
                        <div
                            className="script-name-input"
                            title={t('nameDefinedInMetadata')}
                            style={{
                                cursor: 'default',
                                marginLeft: 0,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                            }}
                        >
                            {name}
                        </div>
                        {metadata.namespace && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingLeft: '8px' }}>
                                {metadata.namespace}
                            </span>
                        )}
                    </div>


                    <div className="editor-actions">
                        {/* Manual Editor Toggle Removed - CodeMirror handles mobile natively */}

                        <button
                            className="btn-secondary"
                            onClick={handleFormat}
                            title="Format Code (Shift+Alt+F)"
                            style={{ marginRight: '8px', padding: '8px' }}
                        >
                            <FileJson size={16} />
                        </button>

                        <button
                            className="btn-primary"
                            onClick={handleSave}
                            disabled={isSaving || (!isDirty && !isSaved)}
                            style={{
                                minWidth: '90px',
                                justifyContent: 'center',
                                backgroundColor: isSaved ? 'var(--success-color, #10b981)' : undefined,
                                borderColor: isSaved ? 'var(--success-color, #10b981)' : undefined
                            }}
                        >
                            {isSaved ? <Check size={16} /> : isSaving ? <Loader size={16} className="icon-spin" /> : <Save size={16} />}
                            <span>{t('editorBtnSave')}</span>
                        </button>
                    </div>
                </header>

                <div className="monaco-wrapper" style={{ position: 'relative', height: '100%', overflow: 'hidden' }}>

                    {/* CodeMirror Editor */}
                    <div style={{ height: '100%', overflow: 'hidden', fontSize: '14px' }}>
                        <CodeMirror
                            value={code}
                            height="100%"
                            theme={cmTheme}
                            extensions={[
                                javascript({ jsx: true }),
                                javascript().language.data.of({
                                    autocomplete: userScriptMetadataCompletion
                                }),
                                javascript().language.data.of({
                                    autocomplete: scopeCompletionSource(globalThis)
                                })
                            ]}
                            onChange={(value) => {
                                setCode(value);
                                const metadata = parseMetadata(value);
                                if (metadata.name && metadata.name !== name) {
                                    setName(metadata.name);
                                }
                            }}
                            className="codemirror-wrapper"
                            basicSetup={{
                                lineNumbers: true,
                                foldGutter: true,
                                highlightActiveLine: true,
                                tabSize: 2,
                            }}
                            // indentWithTab={false} // Removed to restore default indentation behavior
                            style={{
                                fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
                                height: '100%'
                            }}
                        />
                    </div>
                </div>
            </main>
        </div >
    );
};

export default ScriptEditor;
