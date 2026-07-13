import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileUp, FolderUp, Plus, Terminal, RefreshCw, Search, ShieldCheck, Trash2, Play, Pause } from 'lucide-react';
import { useApp } from '../context/useApp';
import { useModal } from '../context/useModal';
import ToggleSwitch from '../components/ToggleSwitch';
import { Badge, Button, EmptyState, InlineNotice } from '../components/ui';
import { parseMetadata } from '../../../utils/metadataParser';
import { importFromFileLegacy, importFromDirectoryLegacy } from '../../../utils/importManager';
import { useI18n } from '../../context/I18nContext';
import { bridge } from '../../bridge/client';
import type { Script } from '../types';
import { filterAndSortScripts, type ScriptSort, type ScriptSourceFilter, type ScriptStatusFilter } from '../scriptListModel';

function SelectAllCheckbox({ checked, indeterminate, onChange, label }: { checked: boolean; indeterminate: boolean; onChange: () => void; label: string }) {
    const ref = useRef<HTMLInputElement>(null);
    useEffect(() => { if (ref.current) ref.current.indeterminate = indeterminate; }, [indeterminate]);
    return <input ref={ref} type="checkbox" checked={checked} onChange={onChange} aria-label={label} />;
}

const dateLabel = (timestamp?: number) => timestamp ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(timestamp) : '—';

export default function Scripts() {
    const { scripts, loadStatus, operationError, clearOperationError, toggleScript, bulkSetScriptEnabled, bulkDeleteScripts, saveScript } = useApp();
    const { t } = useI18n();
    const { showModal } = useModal();
    const navigate = useNavigate();
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [query, setQuery] = useState('');
    const [status, setStatus] = useState<ScriptStatusFilter>('all');
    const [source, setSource] = useState<ScriptSourceFilter>('all');
    const [sort, setSort] = useState<ScriptSort>('name');
    const [busy, setBusy] = useState(false);
    const [isCompact, setIsCompact] = useState(() => window.innerWidth <= 900);

    useEffect(() => {
        const media = window.matchMedia('(max-width: 900px)');
        const update = () => setIsCompact(media.matches);
        media.addEventListener('change', update);
        return () => media.removeEventListener('change', update);
    }, []);

    const visibleScripts = useMemo(() => filterAndSortScripts(scripts, { query, status, source, sort }), [scripts, query, status, source, sort]);
    const visibleIds = visibleScripts.map(script => script.id);
    const selectedVisible = visibleIds.filter(id => selected.has(id));
    const allVisibleSelected = visibleIds.length > 0 && selectedVisible.length === visibleIds.length;

    const toggleSelection = (id: string) => setSelected(current => {
        const next = new Set(current);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
    });
    const toggleVisible = () => setSelected(current => {
        const next = new Set(current);
        if (allVisibleSelected) visibleIds.forEach(id => next.delete(id)); else visibleIds.forEach(id => next.add(id));
        return next;
    });

    const runBulkToggle = async (enabled: boolean) => {
        setBusy(true);
        try { await bulkSetScriptEnabled([...selected], enabled); setSelected(new Set()); } finally { setBusy(false); }
    };
    const confirmBulkDelete = () => showModal('confirm', t('deleteScriptsTitle'), t('confirmDeleteMultiple', [String(selected.size)]), async () => {
        setBusy(true);
        try { await bulkDeleteScripts([...selected]); setSelected(new Set()); } finally { setBusy(false); }
    }, t('deleteSelected'));

    const importScripts = async (directory: boolean) => {
        try {
            const imported = directory
                ? ('showDirectoryPicker' in window ? await bridge.call('IMPORT_DIRECTORY') : await importFromDirectoryLegacy())
                : ('showOpenFilePicker' in window ? await bridge.call('IMPORT_FILE') : await importFromFileLegacy());
            if (!imported.length) return;
            for (const script of imported) await saveScript(script);
            showModal('success', t('importSuccessful'), t('importedScripts', [String(imported.length)]));
        } catch (error) { showModal('error', t('importFailed'), (error as Error).message); }
    };

    const deleteOne = (script: Script) => showModal('confirm', t('deleteScriptTitle'), t('deleteScriptConfirm', [script.name]), () => bulkDeleteScripts([script.id]));

    if (loadStatus === 'loading') return <div className="page-state" role="status"><span className="ui-spinner" />{t('editorLoading')}</div>;
    if (loadStatus === 'error') return <div className="page-state"><InlineNotice tone="error">{operationError || 'Unable to load scripts.'}</InlineNotice></div>;

    return <section className="console-page scripts-page" aria-labelledby="scripts-title">
        <header className="console-page-header">
            <div><p className="eyebrow">{t('extensionLabel')}</p><h1 id="scripts-title">{t('myScripts', [String(scripts.length)])}</h1><p className="page-subtitle">{t('scriptsConsoleDescription')}</p></div>
            <div className="page-actions">
                <Button onClick={() => importScripts(false)}><FileUp size={16} />{t('importFile')}</Button>
                <Button onClick={() => importScripts(true)}><FolderUp size={16} />{t('importFolder')}</Button>
                <Button variant="primary" onClick={() => navigate('/options/new')}><Plus size={16} />{t('newScript')}</Button>
            </div>
        </header>

        {operationError && <InlineNotice tone="error" onDismiss={clearOperationError}>{operationError}</InlineNotice>}

        <div className="script-toolbar" role="search">
            <label className="search-field"><Search size={18} aria-hidden="true" /><span className="sr-only">{t('searchScripts')}</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder={t('searchScripts')} /></label>
            <label><span className="sr-only">{t('filterStatus')}</span><select value={status} onChange={event => setStatus(event.target.value as ScriptStatusFilter)}><option value="all">{t('filterAll')}</option><option value="enabled">{t('filterEnabled')}</option><option value="disabled">{t('filterDisabled')}</option></select></label>
            <label><span className="sr-only">{t('filterSource')}</span><select value={source} onChange={event => setSource(event.target.value as ScriptSourceFilter)}><option value="all">{t('filterAllSources')}</option><option value="local">{t('localLabel')}</option><option value="remote">{t('remoteLabel')}</option></select></label>
            <label><span className="sr-only">{t('sortScripts')}</span><select value={sort} onChange={event => setSort(event.target.value as ScriptSort)}><option value="name">{t('sortName')}</option><option value="updated">{t('sortUpdated')}</option><option value="installed">{t('sortInstalled')}</option></select></label>
            <span className="result-count" aria-live="polite">{t('resultCount', [String(visibleScripts.length)])}</span>
        </div>

        {scripts.length === 0 ? <EmptyState icon={<Terminal size={36} />} title={t('noScriptsFound')} description={t('createScriptToStart')} />
        : visibleScripts.length === 0 ? <EmptyState icon={<Search size={32} />} title={t('noResults')} description={t('adjustFilters')} />
        : <>{!isCompact ? <div className="script-table-shell">
                <table className="security-table">
                    <thead><tr>
                        <th><SelectAllCheckbox checked={allVisibleSelected} indeterminate={selectedVisible.length > 0 && !allVisibleSelected} onChange={toggleVisible} label={t('selectAllVisible')} /></th>
                        <th>{t('enabledHeader')}</th><th>{t('nameHeader')}</th><th>{t('coverageHeader')}</th><th>{t('permissionsHeader')}</th><th>{t('sourceHeader')}</th><th>{t('updatedHeader')}</th><th>{t('actionsHeader')}</th>
                    </tr></thead>
                    <tbody>{visibleScripts.map(script => {
                        const metadata = parseMetadata(script.code);
                        const matches = [...metadata.match, ...metadata.include];
                        const permissions = (metadata.grant || []).filter(item => item !== 'none');
                        const remote = Boolean(script.sourceUrl || metadata.updateURL || metadata.downloadURL || metadata.installURL);
                        return <tr key={script.id} data-selected={selected.has(script.id)}>
                            <td><input type="checkbox" checked={selected.has(script.id)} onChange={() => toggleSelection(script.id)} aria-label={t('selectScript', [script.name])} /></td>
                            <td><ToggleSwitch checked={script.enabled !== false} onChange={enabled => toggleScript(script, enabled)} ariaLabel={t('toggleScript', [script.name])} /></td>
                            <td><button className="script-link" onClick={() => navigate(`/options/scripts/${script.id}`)}><strong>{script.name}</strong><span>{metadata.namespace || 'local'}</span></button></td>
                            <td><Badge tone={matches.length ? 'info' : 'warning'}>{matches.length} URL</Badge></td>
                            <td><Badge tone={permissions.length ? 'warning' : 'success'}><ShieldCheck size={13} />{permissions.length}</Badge></td>
                            <td><Badge tone={remote ? 'info' : 'neutral'}>{remote ? t('remoteLabel') : t('localLabel')}</Badge></td>
                            <td>{dateLabel(script.updateDate || script.installDate)}</td>
                            <td><div className="row-actions">{remote && <button className="ui-icon-button" aria-label={t('checkForUpdatesTooltip')} onClick={() => bridge.call('START_UPDATE_FLOW', { scriptId: script.id })}><RefreshCw size={16} /></button>}<button className="ui-icon-button danger" aria-label={t('deleteScriptConfirm', [script.name])} onClick={() => deleteOne(script)}><Trash2 size={16} /></button></div></td>
                        </tr>;
                    })}</tbody>
                </table>
            </div> : <div className="script-card-list">{visibleScripts.map(script => {
                const metadata = parseMetadata(script.code); const matches = [...metadata.match, ...metadata.include]; const permissions = (metadata.grant || []).filter(item => item !== 'none');
                return <article className="script-card" key={script.id} data-selected={selected.has(script.id)}>
                    <div className="script-card-heading"><input type="checkbox" checked={selected.has(script.id)} onChange={() => toggleSelection(script.id)} aria-label={t('selectScript', [script.name])} /><button className="script-link" onClick={() => navigate(`/options/scripts/${script.id}`)}><strong>{script.name}</strong><span>{metadata.namespace || 'local'}</span></button><ToggleSwitch checked={script.enabled !== false} onChange={enabled => toggleScript(script, enabled)} ariaLabel={t('toggleScript', [script.name])} /></div>
                    <div className="script-card-meta"><Badge tone="info">{matches.length} URL</Badge><Badge tone={permissions.length ? 'warning' : 'success'}>{permissions.length} permissions</Badge><span>{dateLabel(script.updateDate || script.installDate)}</span></div>
                </article>;
            })}</div>}</>}

        {selected.size > 0 && <div className="bulk-action-bar" role="region" aria-label={t('bulkActions')}><strong>{t('selectedCount', [String(selected.size)])}</strong><Button disabled={busy} onClick={() => runBulkToggle(true)}><Play size={15} />{t('enableSelected')}</Button><Button disabled={busy} onClick={() => runBulkToggle(false)}><Pause size={15} />{t('disableSelected')}</Button><Button variant="danger" disabled={busy} onClick={confirmBulkDelete}><Trash2 size={15} />{t('deleteSelected')}</Button></div>}
    </section>;
}
