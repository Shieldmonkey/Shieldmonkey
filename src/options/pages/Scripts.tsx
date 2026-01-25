import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Pause, Trash2, FileUp, FolderUp, Plus, Terminal, Edit } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useModal } from '../context/ModalContext';
import ToggleSwitch from '../components/ToggleSwitch';
import { parseMetadata } from '../../utils/metadataParser';
import { importFromFile, importFromDirectory } from '../../utils/importManager';
import { Script } from '../types';

const Scripts = () => {
    const { scripts, toggleScript, deleteScript, setScripts, extensionEnabled, toggleExtension, saveScript } = useApp();
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
        setScripts(prev => [...prev, newScript]);
        // And actually save it to storage so it persists if we reload
        await saveScript(newScript);

        navigate(`/scripts/${newScriptId}`);
    };

    const handleBulkEnable = async () => {
        if (selectedScriptIds.size === 0) return;
        for (const id of selectedScriptIds) {
            const script = scripts.find(s => s.id === id);
            if (script) await toggleScript(script, true);
        }
    };

    const handleBulkDisable = async () => {
        if (selectedScriptIds.size === 0) return;
        for (const id of selectedScriptIds) {
            const script = scripts.find(s => s.id === id);
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
                setScripts(prev => prev.filter(s => !selectedScriptIds.has(s.id)));
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
            setSelectedScriptIds(new Set(scripts.map(s => s.id)));
        }
    };

    return (
        <div className="content-scroll">
            <div className="script-table-container">
                <div className="page-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <h2 className="page-title">My Scripts ({scripts.length})</h2>
                        {selectedScriptIds.size > 0 && (
                            <div style={{ display: 'flex', gap: '8px', marginLeft: '12px', paddingLeft: '12px', borderLeft: '1px solid var(--border-color)' }}>
                                <button className="btn-secondary" onClick={handleBulkEnable} style={{ padding: '4px 10px', fontSize: '0.8rem' }} title="Enable Selected">
                                    <Play size={14} /> Enable
                                </button>
                                <button className="btn-secondary" onClick={handleBulkDisable} style={{ padding: '4px 10px', fontSize: '0.8rem' }} title="Disable Selected">
                                    <Pause size={14} /> Disable
                                </button>
                                <button className="btn-danger action-btn delete" onClick={handleBulkDelete} style={{
                                    padding: '4px 12px',
                                    fontSize: '0.8rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    backgroundColor: '#fee2e2',
                                    color: '#ef4444',
                                    border: '1px solid #fecaca',
                                    borderRadius: '4px',
                                    cursor: 'pointer'
                                }}>
                                    <Trash2 size={14} />
                                    <span>Delete ({selectedScriptIds.size})</span>
                                </button>
                            </div>
                        )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: '8px' }}>
                            <span style={{ fontSize: '0.9rem', color: extensionEnabled ? 'var(--text-color)' : 'var(--text-secondary)' }}>
                                {extensionEnabled ? 'Extension Enabled' : 'Extension Disabled'}
                            </span>
                            <ToggleSwitch checked={extensionEnabled} onChange={toggleExtension} />
                        </div>
                        <div style={{ height: '24px', width: '1px', background: 'var(--border-color)' }}></div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button className="btn-secondary" onClick={handleImportFile}><FileUp size={16} /> Import File</button>
                            <button className="btn-secondary" onClick={handleImportFolder}><FolderUp size={16} /> Import Folder</button>
                            <button className="btn-primary" onClick={handleNewScript}><Plus size={16} /> New Script</button>
                        </div>
                    </div>
                </div>

                {scripts.length === 0 ? (
                    <div className="empty-dashboard" style={{ textAlign: 'center', marginTop: '4rem', color: 'var(--text-secondary)' }}>
                        <div className="empty-icon-wrapper" style={{ background: 'var(--surface-bg)', borderRadius: '50%', padding: '2rem', display: 'inline-block', marginBottom: '1rem' }}>
                            <Terminal size={48} />
                        </div>
                        <h3>No scripts found</h3>
                        <p>Create a new script to get started.</p>
                    </div>
                ) : (
                    <table className="script-table compact">
                        <thead>
                            <tr>
                                <th style={{ width: '40px', textAlign: 'center' }}>
                                    <input type="checkbox" checked={scripts.length > 0 && selectedScriptIds.size === scripts.length} onChange={toggleSelectAll} style={{ cursor: 'pointer' }} />
                                </th>
                                <th style={{ width: '60px' }}>Enabled</th>
                                <th>Name / Namespace</th>
                                <th>Version</th>
                                <th>Source</th>
                                <th>Installed</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {scripts.map(script => {
                                const metadata = parseMetadata(script.code);
                                const sourceUrl = script.updateUrl || script.downloadUrl || script.sourceUrl;

                                return (
                                    <tr key={script.id} className={selectedScriptIds.has(script.id) ? 'selected-row' : ''} style={selectedScriptIds.has(script.id) ? { backgroundColor: 'var(--hover-color, rgba(255,255,255,0.05))' } : {}}>
                                        <td style={{ textAlign: 'center' }}>
                                            <input type="checkbox" checked={selectedScriptIds.has(script.id)} onChange={() => toggleScriptSelection(script.id)} style={{ cursor: 'pointer' }} />
                                        </td>
                                        <td>
                                            <ToggleSwitch checked={!!script.enabled} onChange={() => toggleScript(script, !!script.enabled)} />
                                        </td>
                                        <td style={{ fontWeight: 500, cursor: 'pointer' }} onClick={() => navigate(`/scripts/${script.id}`)}>
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <span style={{ fontSize: '0.95rem' }}>{script.name}</span>
                                                {metadata.namespace && (
                                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }} className='truncate'>
                                                        {metadata.namespace}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td>
                                            {metadata.version ? (
                                                <span className="script-version">v{metadata.version}</span>
                                            ) : (
                                                <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>-</span>
                                            )}
                                        </td>
                                        <td>
                                            {sourceUrl ? (
                                                <a href={sourceUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.85rem' }} onClick={(e) => e.stopPropagation()}>
                                                    Link
                                                </a>
                                            ) : '-'}
                                        </td>
                                        <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                            {script.installDate ? new Date(script.installDate).toLocaleDateString() : '-'}
                                        </td>
                                        <td className="col-actions">
                                            <button className="action-btn" onClick={() => navigate(`/scripts/${script.id}`)} title="Edit">
                                                <Edit size={16} />
                                            </button>
                                            <button className="action-btn delete" onClick={(e) => { e.stopPropagation(); deleteScript(script.id); }} title="Delete">
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

export default Scripts;
