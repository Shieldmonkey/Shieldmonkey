import type { Script } from './types';
import { parseMetadata } from '../../utils/metadataParser';

export type ScriptStatusFilter = 'all' | 'enabled' | 'disabled';
export type ScriptSourceFilter = 'all' | 'local' | 'remote';
export type ScriptSort = 'name' | 'updated' | 'installed';

export interface ScriptListFilters {
    query: string;
    status: ScriptStatusFilter;
    source: ScriptSourceFilter;
    sort: ScriptSort;
}

export function filterAndSortScripts(scripts: Script[], filters: ScriptListFilters): Script[] {
    const query = filters.query.trim().toLocaleLowerCase();
    return scripts.filter(script => {
        const metadata = parseMetadata(script.code);
        const searchable = [script.name, metadata.namespace, ...metadata.match, ...metadata.include].filter(Boolean).join(' ').toLocaleLowerCase();
        const matchesQuery = !query || searchable.includes(query);
        const matchesStatus = filters.status === 'all' || (filters.status === 'enabled' ? script.enabled !== false : script.enabled === false);
        const remote = Boolean(script.sourceUrl || metadata.updateURL || metadata.downloadURL || metadata.installURL);
        const matchesSource = filters.source === 'all' || (filters.source === 'remote' ? remote : !remote);
        return matchesQuery && matchesStatus && matchesSource;
    }).sort((a, b) => {
        if (filters.sort === 'updated') return (b.updateDate ?? 0) - (a.updateDate ?? 0);
        if (filters.sort === 'installed') return (b.installDate ?? 0) - (a.installDate ?? 0);
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });
}
