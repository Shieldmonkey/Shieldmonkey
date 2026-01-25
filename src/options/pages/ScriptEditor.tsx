import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import { ArrowLeft, Save, Trash2, Info, Shield, Globe, Link as LinkIcon } from 'lucide-react';
import { useApp } from '../context/useApp';
import { useModal } from '../context/useModal';
import PermissionModal from '../PermissionModal';
import { parseMetadata } from '../../utils/metadataParser';
import { type Script } from '../types';

const ScriptEditor = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { scripts, saveScript, deleteScript } = useApp();
    const { showModal: showGenericModal } = useModal();

    // Find script from context
    const scriptFromContext = scripts.find((s: Script) => s.id === id);

    const [code, setCode] = useState<string>('');
    const [name, setName] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    // Permission Modal
    const [permissionModalOpen, setPermissionModalOpen] = useState(false);
    const [requestedPermissions, setRequestedPermissions] = useState<string[]>([]);
    const [pendingSaveResolved, setPendingSaveResolved] = useState<((allowed: boolean) => void) | null>(null);

    // Track if we have initialized from context
    const initializedRef = useRef(false);

    useEffect(() => {
        if (scriptFromContext && !initializedRef.current) {
            setCode(scriptFromContext.code);
            setName(scriptFromContext.name);
            initializedRef.current = true;
        }
    }, [scriptFromContext]);

    const isDirty = scriptFromContext ? code !== scriptFromContext.lastSavedCode : false;

    const handleSave = useCallback(async () => {
        if (!scriptFromContext) return;
        setIsSaving(true);
        try {
            const currentCode = code;
            const metadata = parseMetadata(currentCode);
            const requested = metadata.grant || [];
            const needed = requested.filter(p => p !== 'none');

            const currentGranted = new Set(scriptFromContext.grantedPermissions || []);
            const newPermissions = needed.filter(p => !currentGranted.has(p));

            let grantedPermissions = scriptFromContext.grantedPermissions;

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
                ...scriptFromContext,
                code: currentCode,
                name: metadata.name || scriptFromContext.name || 'New Script',
                namespace: metadata.namespace || scriptFromContext.namespace,
                grantedPermissions
            };

            await saveScript(updatedScript);
            setName(updatedScript.name);

        } catch (e) {
            console.error("Failed to save", e);
            showGenericModal('error', 'Save Failed', (e as Error).message);
        } finally {
            setIsSaving(false);
        }
    }, [code, scriptFromContext, saveScript, showGenericModal]);

    const handleDelete = () => {
        if (!scriptFromContext) return;
        showGenericModal('confirm', 'Delete Script', 'Are you sure you want to delete this script?', async () => {
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
            if ((e.metaKey || e.ctrlKey) && e.key === 's') {
                e.preventDefault();
                handleSave();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleSave]);

    // Theme handling for Monaco
    const { theme } = useApp();
    const editorTheme = theme === 'light' ? 'vs' : 'vs-dark';

    if (!scriptFromContext) {
        if (scripts.length === 0) return <div>Loading...</div>;
        return <div>Script not found</div>;
    }

    // Metadata for header/sidebar info
    const metadata = parseMetadata(code);
    const sourceUrl = scriptFromContext.sourceUrl;
    const referrerUrl = scriptFromContext.referrerUrl;

    return (
        <div className="app-container">
            <aside className="sidebar">
                <div
                    className="sidebar-header"
                    style={{ cursor: 'pointer', justifyContent: 'flex-start', paddingLeft: '24px' }}
                    onClick={() => navigate('/scripts')}
                    title="Back to Script List"
                >
                    <ArrowLeft size={20} style={{ color: 'var(--text-secondary)' }} />
                    <h2 style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginLeft: '8px' }}>Back</h2>
                </div>

                <div className="content-scroll" style={{ padding: '0 24px 24px 24px' }}>

                    {/* Info Section */}
                    <div style={{ marginBottom: '32px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: 'var(--accent-color)' }}>
                            <Info size={16} />
                            <h3 style={{ margin: 0, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Info</h3>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '12px 16px', fontSize: '0.85rem' }}>
                            <div style={{ color: 'var(--text-secondary)' }}>Version</div>
                            <div style={{ fontFamily: 'monospace' }}>{metadata.version || '-'}</div>

                            <div style={{ color: 'var(--text-secondary)' }}>Author</div>
                            <div>{metadata.author || '-'}</div>

                            <div style={{ color: 'var(--text-secondary)' }}>Installed</div>
                            <div>{scriptFromContext.installDate ? new Date(scriptFromContext.installDate).toLocaleDateString() : '-'}</div>

                            {referrerUrl && (
                                <>
                                    <div style={{ color: 'var(--text-secondary)' }}>Page</div>
                                    <div style={{ wordBreak: 'break-all' }}>
                                        <a href={referrerUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <LinkIcon size={12} style={{ flexShrink: 0 }} />
                                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{referrerUrl}</span>
                                        </a>
                                    </div>
                                </>
                            )}

                            {sourceUrl && (
                                <>
                                    <div style={{ color: 'var(--text-secondary)' }}>Source</div>
                                    <div style={{ wordBreak: 'break-all' }}>
                                        <a href={sourceUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <LinkIcon size={12} style={{ flexShrink: 0 }} />
                                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{sourceUrl}</span>
                                        </a>
                                    </div>
                                </>

                            )}

                            {(metadata.updateURL || scriptFromContext.updateUrl) && (
                                <>
                                    <div style={{ color: 'var(--text-secondary)' }}>Update</div>
                                    <div style={{ wordBreak: 'break-all' }}>
                                        <a href={metadata.updateURL || scriptFromContext.updateUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <LinkIcon size={12} style={{ flexShrink: 0 }} />
                                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{metadata.updateURL || scriptFromContext.updateUrl}</span>
                                        </a>
                                    </div>
                                </>
                            )}

                            {(metadata.downloadURL || scriptFromContext.downloadUrl) && (
                                <>
                                    <div style={{ color: 'var(--text-secondary)' }}>Download</div>
                                    <div style={{ wordBreak: 'break-all' }}>
                                        <a href={metadata.downloadURL || scriptFromContext.downloadUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <LinkIcon size={12} style={{ flexShrink: 0 }} />
                                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{metadata.downloadURL || scriptFromContext.downloadUrl}</span>
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
                                    <h3 style={{ margin: 0, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Permissions</h3>
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
                                    <h3 style={{ margin: 0, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Matches</h3>
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
                    <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        <input
                            type="text"
                            className="script-name-input"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            readOnly
                            title="Name is defined in metadata block"
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
                            <span>{isSaving ? 'Saving...' : 'Save'}</span>
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
                scriptName={scriptFromContext.name}
                permissions={requestedPermissions}
                onConfirm={handlePermissionConfirm}
                onCancel={handlePermissionCancel}
            />
        </div >
    );
};

export default ScriptEditor;
