import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Pause, Trash2, FileUp, FolderUp, Plus, Terminal, Edit, RefreshCw } from 'lucide-react';
import { useApp } from '../context/useApp';
import { useModal } from '../context/useModal';
import ToggleSwitch from '../components/ToggleSwitch';
import { parseMetadata } from '../../utils/metadataParser';
import { importFromFile, importFromDirectory } from '../../utils/importManager';
import type { Script } from '../types';

const Scripts = () => {
    const { scripts, toggleScript, deleteScript, setScripts, saveScript } = useApp();
    const { showModal } = useModal();
    const navigate = useNavigate();
    const [selectedScriptIds, setSelectedScriptIds] = useState<Set<string>>(new Set());

    const handleNewScript = async () => {
        const newScriptId = crypto.randomUUID();
        const newScript: Script = {
            id: newScriptId,
            name: 'New Script',
            code: `// ==UserScript==
// @name        New Script
// @match       <all_urls>
// ==/UserScript==

`,
            enabled: true,
            lastSavedCode: `// ==UserScript==
// @name        New Script
// @match       <all_urls>
// ==/UserScript==

`,
            grantedPermissions: [],
            installDate: Date.now()
        };
        // We need to add it to state first or save it?
        // Let's add it to state via context
        setScripts((prev: Script[]) => [...prev, newScript]);
        // And actually save it to storage so it persists if we reload
        await saveScript(newScript);

        navigate(`/scripts/${newScriptId}`);
    };

    const handleBulkEnable = async () => {
        if (selectedScriptIds.size === 0) return;
        for (const id of selectedScriptIds) {
            const script = scripts.find((s: Script) => s.id === id);
            if (script) await toggleScript(script, true);
        }
    };

    const handleBulkDisable = async () => {
        if (selectedScriptIds.size === 0) return;
        for (const id of selectedScriptIds) {
            const script = scripts.find((s: Script) => s.id === id);
            if (script) await toggleScript(script, false);
        }
    };

    const handleBulkDelete = async () => {
        if (selectedScriptIds.size === 0) return;
        showModal('confirm', 'Delete Scripts', `Are you sure you want to delete ${selectedScriptIds.size} scripts?`, async () => {
            try {
                for (const id of selectedScriptIds) {
                    await deleteScript(id);
                }
                setScripts((prev: Script[]) => prev.filter((s: Script) => !selectedScriptIds.has(s.id)));
                setSelectedScriptIds(new Set());
                showModal('success', 'Deleted', `Successfully deleted ${selectedScriptIds.size} scripts.`);
            } catch (e) {
                console.error("Failed to delete", e);
                showModal('error', 'Delete Failed', (e as Error).message);
            }
        });
    };

    const handleImportFile = async () => {
        try {
            const importedScripts = await importFromFile();
            if (importedScripts.length === 0) return;
            for (const script of importedScripts) {
                await saveScript(script);
            }
            await chrome.runtime.sendMessage({ type: 'RELOAD_SCRIPTS' });
            // Update context? reloadScripts() from context would happen automatically via listener
            showModal('success', 'Import Successful', `Imported ${importedScripts.length} scripts.`);
        } catch (e) {
            showModal('error', 'Import Failed', (e as Error).message);
        }
    };

    const handleImportFolder = async () => {
        try {
            const importedScripts = await importFromDirectory();
            if (importedScripts.length === 0) return;
            for (const script of importedScripts) {
                await saveScript(script);
            }
            await chrome.runtime.sendMessage({ type: 'RELOAD_SCRIPTS' });
            showModal('success', 'Import Successful', `Imported ${importedScripts.length} scripts.`);
        } catch (e) {
            showModal('error', 'Import Failed', (e as Error).message);
        }
    };

    const getUpdateUrl = (script: Script) => {
        // Prioritize metadata update URL, then fallback to script sourceUrl
        const metadata = parseMetadata(script.code);
        return metadata.updateURL || metadata.downloadURL || metadata.installURL || script.sourceUrl;
    };

    const handleCheckUpdate = (script: Script) => {
        const url = getUpdateUrl(script);
        if (url) {
            chrome.runtime.sendMessage({ type: 'START_INSTALL_FLOW', url });
        }
    };



    const toggleScriptSelection = (id: string) => {
        const next = new Set(selectedScriptIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedScriptIds(next);
    };

    const toggleSelectAll = () => {
        if (selectedScriptIds.size === scripts.length) {
            setSelectedScriptIds(new Set());
        } else {
            setSelectedScriptIds(new Set(scripts.map((s: Script) => s.id)));
        }
    };

    const handleDeleteScript = (script: Script) => {
        showModal('confirm', 'Delete Script', `Are you sure you want to delete "${script.name}"?`, async () => {
            try {
                await deleteScript(script.id);
                showModal('success', 'Deleted', `Script "${script.name}" deleted.`);
            } catch (e) {
                console.error("Failed to delete", e);
                showModal('error', 'Delete Failed', (e as Error).message);
            }
        });
    };

    return (
        <div className="content-scroll" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', padding: 0 }}>
            <div className="script-table-container" style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', maxWidth: '100%', margin: 0 }}>
                <div className="page-header" style={{ height: 'auto', minHeight: '40px', flexShrink: 0, padding: '32px 48px 24px 48px', marginBottom: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <h2 className="page-title">My Scripts ({scripts.length})</h2>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button className="btn-secondary" onClick={handleImportFile}><FileUp size={16} /> Import File</button>
                            <button className="btn-secondary" onClick={handleImportFolder}><FolderUp size={16} /> Import Folder</button>
                            <button className="btn-primary" onClick={handleNewScript}><Plus size={16} /> New Script</button>
                        </div>
                    </div>
                </div>

                {scripts.length === 0 ? (
                    <div className="empty-dashboard" style={{ textAlign: 'center', marginTop: '4rem', color: 'var(--text-secondary)', flex: 1, overflow: 'auto' }}>
                        <div className="empty-icon-wrapper" style={{ background: 'var(--surface-bg)', borderRadius: '50%', padding: '2rem', display: 'inline-block', marginBottom: '1rem' }}>
                            <Terminal size={48} />
                        </div>
                        <h3>No scripts found</h3>
                        <p>Create a new script to get started.</p>
                    </div>
                ) : (
                    <div style={{ overflow: 'auto', flex: 1, width: '100%', borderTop: '1px solid var(--border-color)', padding: '0 0 100px 0' }}>
                        <table className="script-table compact" style={{ minWidth: '800px' }}>
                            <thead>
                                <tr>
                                    <th style={{ width: '40px', textAlign: 'center' }}>
                                        <input type="checkbox" checked={scripts.length > 0 && selectedScriptIds.size === scripts.length} onChange={toggleSelectAll} style={{ cursor: 'pointer' }} />
                                    </th>
                                    <th style={{ width: '60px' }}>Enabled</th>
                                    <th>Name</th>
                                    <th>Namespace</th>
                                    <th>Version</th>
                                    <th>Source</th>
                                    <th>Installed</th>
                                    <th className="col-actions">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {scripts.map((script: Script) => {
                                    const metadata = parseMetadata(script.code);

                                    return (
                                        <tr key={script.id} className={selectedScriptIds.has(script.id) ? 'selected-row' : ''} style={selectedScriptIds.has(script.id) ? { backgroundColor: 'var(--hover-color, rgba(255,255,255,0.05))' } : {}}>
                                            <td style={{ textAlign: 'center' }}>
                                                <input type="checkbox" checked={selectedScriptIds.has(script.id)} onChange={() => toggleScriptSelection(script.id)} style={{ cursor: 'pointer' }} />
                                            </td>
                                            <td>
                                                <ToggleSwitch checked={!!script.enabled} onChange={() => toggleScript(script, !script.enabled)} />
                                            </td>
                                            <td style={{ cursor: 'pointer', maxWidth: '300px' }} onClick={() => navigate(`/scripts/${script.id}`)}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                                                    <span style={{ fontWeight: 500, fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{script.name}</span>
                                                </div>
                                            </td>
                                            <td style={{ maxWidth: '200px' }}>
                                                {metadata.namespace ? (
                                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>
                                                        {metadata.namespace}
                                                    </span>
                                                ) : <span style={{ color: 'var(--text-secondary)' }}>-</span>}
                                            </td>
                                            <td>
                                                {metadata.version ? (
                                                    <span className="script-version">v{metadata.version}</span>
                                                ) : (
                                                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>-</span>
                                                )}
                                            </td>
                                            <td>
                                                <span style={{
                                                    padding: '2px 8px',
                                                    borderRadius: '12px',
                                                    backgroundColor: (script.sourceUrl || script.updateUrl || script.downloadUrl) ? 'rgba(59, 130, 246, 0.1)' : 'rgba(107, 114, 128, 0.1)',
                                                    color: (script.sourceUrl || script.updateUrl || script.downloadUrl) ? '#60a5fa' : '#9ca3af',
                                                    border: `1px solid ${(script.sourceUrl || script.updateUrl || script.downloadUrl) ? 'rgba(59, 130, 246, 0.2)' : 'rgba(107, 114, 128, 0.2)'}`,
                                                    fontWeight: 500,
                                                    fontSize: '0.75rem',
                                                    whiteSpace: 'nowrap'
                                                }}>
                                                    {(script.sourceUrl || script.updateUrl || script.downloadUrl) ? 'Remote' : 'Local'}
                                                </span>
                                            </td>
                                            <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                                {script.installDate ? new Date(script.installDate).toLocaleDateString() : '-'}
                                            </td>
                                            <td className="col-actions">
                                                {getUpdateUrl(script) && (
                                                    <button className="action-btn" onClick={(e) => { e.stopPropagation(); handleCheckUpdate(script); }} title="Check for Updates">
                                                        <RefreshCw size={16} />
                                                    </button>
                                                )}
                                                <button className="action-btn" onClick={() => navigate(`/scripts/${script.id}`)} title="Edit">
                                                    <Edit size={16} />
                                                </button>
                                                <button className="action-btn delete" onClick={(e) => { e.stopPropagation(); handleDeleteScript(script); }} title="Delete">
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {selectedScriptIds.size > 0 && (
                <div style={{
                    position: 'fixed',
                    bottom: '24px',
                    right: '32px',
                    background: 'var(--surface-bg)',
                    border: '1px solid var(--border-color)',
                    padding: '12px 16px',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                    zIndex: 100,
                    animation: 'slideUp 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
                }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 500, marginRight: '8px', color: 'var(--text-secondary)' }}>
                        {selectedScriptIds.size} Selected
                    </span>
                    <div style={{ width: '1px', height: '20px', background: 'var(--border-color)' }}></div>
                    <button className="btn-secondary" onClick={handleBulkEnable} style={{ padding: '6px 12px', fontSize: '0.9rem' }} title="Enable Selected">
                        <Play size={16} /> Enable
                    </button>
                    <button className="btn-secondary" onClick={handleBulkDisable} style={{ padding: '6px 12px', fontSize: '0.9rem' }} title="Disable Selected">
                        <Pause size={16} /> Disable
                    </button>
                    <button className="btn-danger action-btn delete" onClick={handleBulkDelete} style={{
                        padding: '6px 12px',
                        fontSize: '0.9rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        backgroundColor: '#ef4444',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer'
                    }}>
                        <Trash2 size={16} />
                        <span>Delete</span>
                    </button>
                </div>
            )}

            <style>{`
                @keyframes slideUp {
                    from { transform: translateY(20px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
            `}</style>
        </div>
    );
};

export default Scripts;
