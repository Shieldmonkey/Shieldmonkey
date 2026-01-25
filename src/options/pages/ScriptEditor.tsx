import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import { ArrowLeft, Save, Trash2, Calendar } from 'lucide-react';
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
    // Note: If scripts are loading, this might be undefined initially.
    // The AppContext initializes effectively on mount.
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
        } else if (!scriptFromContext && scripts.length > 0 && id) {
            // ID not found in loaded scripts
            // navigate('/scripts'); // Or show error
        }
    }, [scriptFromContext, scripts, id]);

    // Handle updates from context (e.g. external save)
    // If we are dirty, we might have a conflict. For now, let's just respect local state if dirty?
    // The previous App.tsx logic was:
    // code: (isEditing && isDirty) ? existing.code : s.code
    // Here we have local `code` state. We only update it from props if we haven't touched it?
    // or if we just saved it.

    const isDirty = scriptFromContext ? code !== scriptFromContext.lastSavedCode : false;
    // Wait, scriptFromContext.lastSavedCode might be updated after save.
    // If we rely on scriptFromContext to determine "original", that works.

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

            // Updates to `scripts` context will eventually propagate back to scriptFromContext,
            // updating lastSavedCode, which will make isDirty false (if code matches).
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
    const editorTheme = theme === 'light' ? 'vs' : 'vs-dark'; // Simple mapping, or better custom themes if configured

    if (!scriptFromContext) {
        if (scripts.length === 0) return <div>Loading...</div>;
        return <div>Script not found</div>;
    }

    // Metadata for header info
    const metadata = parseMetadata(code);

    return (
        <div className="editor-container">
            <header className="editor-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button className="btn-secondary" onClick={() => navigate('/scripts', { replace: true })} title="Back to list" style={{ padding: '8px' }}>
                        <ArrowLeft size={16} />
                    </button>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <input
                            type="text"
                            className="script-name-input"
                            value={name}
                            onChange={(e) => setName(e.target.value)} // Visual only, name is parsed from metadata on save
                            readOnly
                            title="Name is defined in metadata block"
                            style={{ cursor: 'default' }}
                        />
                        {metadata.namespace && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginLeft: '12px', fontFamily: 'monospace' }}>
                                {metadata.namespace}
                            </span>
                        )}
                    </div>
                </div>
                <div className="editor-actions">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginRight: '16px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                        {metadata.version && <span>v{metadata.version}</span>}
                        {scriptFromContext.installDate && (
                            <span title="Installed/Created">
                                <Calendar size={14} style={{ display: 'inline', marginRight: '4px' }} />
                                {new Date(scriptFromContext.installDate).toLocaleDateString()}
                            </span>
                        )}
                    </div>

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
                    path={`script-${id}.js`} // Unique path for model
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

            <PermissionModal
                isOpen={permissionModalOpen}
                scriptName={scriptFromContext.name}
                permissions={requestedPermissions}
                onConfirm={handlePermissionConfirm}
                onCancel={handlePermissionCancel}
            />
        </div>
    );
};

export default ScriptEditor;
