import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Pause, Trash2, FileUp, FolderUp, Plus, Terminal, RefreshCw } from 'lucide-react';
import { useApp } from '../context/useApp';
import { useModal } from '../context/useModal';
import ToggleSwitch from '../components/ToggleSwitch';
import { parseMetadata } from '../../utils/metadataParser';
import { importFromFile, importFromDirectory } from '../../utils/importManager';
import { useI18n } from '../../context/I18nContext';
import type { Script } from '../types';

const Scripts = () => {
    const { scripts, toggleScript, deleteScript, setScripts, saveScript } = useApp();
    const { t } = useI18n();
    const { showModal } = useModal();
    const navigate = useNavigate();
    const [selectedScriptIds, setSelectedScriptIds] = useState<Set<string>>(new Set());

    const handleNewScript = async () => {
        // We will just navigate to a new ID, but we won't save it yet.
        // The ScriptEditor handles "new" state if the ID is not found in context?
        // Actually ScriptEditor says `const isNew = !id;`. So we need to navigate to `/scripts/new`?
        // But the route is probably `/scripts/:id`.
        // If we navigate to a random ID that doesn't exist, ScriptEditor shows "Script Not Found".
        // We need a route for creating new scripts, e.g., `/scripts/new` or query param.
        // Let's assume the router handles `/scripts/new` as a special case or we add it.
        // Check Layout or router config? I can't see router config easily but I can try navigating to /scripts/new
        // If I change ScriptEditor to handle "new" as ID, that would work.
        // Previously ScriptEditor logic: `const isNew = !id;`... wait, useParams returns {} if no ID?
        // If route provides ID, it is not "new" by that logic unless ID is undefined.
        // Let's use a dedicated "new" path.
        navigate('/scripts/new');
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
        showModal('confirm', t('deleteScriptsTitle'), t('confirmDeleteMultiple', [String(selectedScriptIds.size)]), async () => {
            try {
                for (const id of selectedScriptIds) {
                    await deleteScript(id);
                }
                setScripts((prev: Script[]) => prev.filter((s: Script) => !selectedScriptIds.has(s.id)));
                setSelectedScriptIds(new Set());
                showModal('success', 'Deleted', t('deletedMultiple', [String(selectedScriptIds.size)]));
            } catch (e) {
                console.error("Failed to delete", e);
                showModal('error', t('deleteFailed'), (e as Error).message);
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
            showModal('success', t('importSuccessful'), t('importedScripts', [String(importedScripts.length)]));
        } catch (e) {
            showModal('error', t('importFailed'), (e as Error).message);
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
            showModal('success', t('importSuccessful'), t('importedScripts', [String(importedScripts.length)]));
        } catch (e) {
            showModal('error', t('importFailed'), (e as Error).message);
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
            chrome.runtime.sendMessage({ type: 'START_INSTALL_FLOW', url, referrer: script.referrerUrl });
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
        showModal('confirm', t('deleteScriptTitle'), t('deleteScriptConfirm', [script.name]), async () => {
            try {
                await deleteScript(script.id);
                showModal('success', 'Deleted', t('deleteSuccess', [script.name]));
            } catch (e) {
                console.error("Failed to delete", e);
                showModal('error', t('deleteFailed'), (e as Error).message);
            }
        });
    };

    return (
        <div className="content-scroll" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', padding: 0 }}>
            <div className="script-table-container" style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', maxWidth: '100%', margin: 0 }}>
                <div className="page-header" style={{ height: 'auto', minHeight: '40px', flexShrink: 0, padding: '32px 48px 24px 48px', marginBottom: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <h2 className="page-title">{t('myScripts', [String(scripts.length)])}</h2>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div className="header-actions">
                            <button className="btn-secondary" onClick={handleImportFile}><FileUp size={16} /> {t('importFile')}</button>
                            <button className="btn-secondary" onClick={handleImportFolder}><FolderUp size={16} /> {t('importFolder')}</button>
                            <button className="btn-primary" onClick={handleNewScript}><Plus size={16} /> {t('newScript')}</button>
                        </div>
                    </div>
                </div>

                {scripts.length === 0 ? (
                    <div className="empty-dashboard" style={{ textAlign: 'center', marginTop: '4rem', color: 'var(--text-secondary)', flex: 1, overflow: 'auto' }}>
                        <div className="empty-icon-wrapper" style={{ background: 'var(--surface-bg)', borderRadius: '50%', padding: '2rem', display: 'inline-block', marginBottom: '1rem' }}>
                            <Terminal size={48} />
                        </div>
                        <h3>{t('noScriptsFound')}</h3>
                        <p>{t('createScriptToStart')}</p>
                    </div>
                ) : (
                    <div style={{ overflow: 'auto', flex: 1, width: '100%', borderTop: '1px solid var(--border-color)', padding: '0 0 100px 0' }}>
                        <table className="script-table compact" style={{ minWidth: '800px' }}>
                            <thead>
                                <tr>
                                    <th style={{ width: '40px', textAlign: 'center' }}>
                                        <input type="checkbox" checked={scripts.length > 0 && selectedScriptIds.size === scripts.length} onChange={toggleSelectAll} style={{ cursor: 'pointer' }} />
                                    </th>
                                    <th style={{ width: '60px' }}>{t('enabledHeader')}</th>
                                    <th>{t('nameHeader')}</th>
                                    <th>{t('namespaceHeader')}</th>
                                    <th>{t('versionHeader')}</th>
                                    <th>{t('sourceHeader')}</th>
                                    <th>{t('installedHeader')}</th>
                                    <th className="col-actions">{t('actionsHeader')}</th>
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
                                                    <span style={{ fontWeight: 600, fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{script.name}</span>
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
                                                <div className="remote-label-container">
                                                    <span style={{
                                                        padding: '2px 8px',
                                                        borderRadius: '12px',
                                                        backgroundColor: (script.sourceUrl) ? 'rgba(59, 130, 246, 0.1)' : 'rgba(107, 114, 128, 0.1)',
                                                        color: (script.sourceUrl) ? '#60a5fa' : '#9ca3af',
                                                        border: `1px solid ${(script.sourceUrl) ? 'rgba(59, 130, 246, 0.2)' : 'rgba(107, 114, 128, 0.2)'}`,
                                                        fontWeight: 600,
                                                        fontSize: '0.75rem',
                                                        whiteSpace: 'nowrap'
                                                    }}>
                                                        {(script.sourceUrl) ? t('remoteLabel') : t('localLabel')}
                                                    </span>
                                                    {getUpdateUrl(script) && (
                                                        <button className="action-btn" onClick={(e) => { e.stopPropagation(); handleCheckUpdate(script); }} title={t('checkForUpdatesTooltip')} style={{ padding: '4px', marginLeft: 0 }}>
                                                            <RefreshCw size={14} />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                            <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                                {script.installDate ? new Date(script.installDate).toLocaleDateString() : '-'}
                                            </td>
                                            <td className="col-actions">
                                                <button className="action-btn delete" onClick={(e) => { e.stopPropagation(); handleDeleteScript(script); }} title={t('deleteTooltip')}>
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
                    <span style={{ fontSize: '0.9rem', fontWeight: 600, marginRight: '8px', color: 'var(--text-secondary)' }}>
                        {t('selectedCount', [String(selectedScriptIds.size)])}
                    </span>
                    <div style={{ width: '1px', height: '20px', background: 'var(--border-color)' }}></div>
                    <button className="btn-secondary" onClick={handleBulkEnable} style={{ padding: '6px 12px', fontSize: '0.9rem' }} title="Enable Selected">
                        <Play size={16} /> {t('enableSelected')}
                    </button>
                    <button className="btn-secondary" onClick={handleBulkDisable} style={{ padding: '6px 12px', fontSize: '0.9rem' }} title="Disable Selected">
                        <Pause size={16} /> {t('disableSelected')}
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
                        <span>{t('deleteSelected')}</span>
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
