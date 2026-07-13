import { describe, expect, test } from 'vitest';
import { filterAndSortScripts } from '../../src/sandbox/options/scriptListModel';
import type { ScriptRecord } from '../../src/types/script';

const script = (overrides: Partial<ScriptRecord>): ScriptRecord => ({
    id: crypto.randomUUID(), name: 'Script', code: '// ==UserScript==\n// @match https://example.com/*\n// ==/UserScript==', enabled: true, ...overrides
});

describe('script list model', () => {
    const scripts = [
        script({ id: 'b', name: 'Beta', enabled: false, installDate: 10, updateDate: 20 }),
        script({ id: 'a', name: 'Alpha', sourceUrl: 'https://example.com/a.user.js', installDate: 30, updateDate: 40 })
    ];

    test('searches metadata and names', () => {
        expect(filterAndSortScripts(scripts, { query: 'example.com', status: 'all', source: 'all', sort: 'name' })).toHaveLength(2);
        expect(filterAndSortScripts(scripts, { query: 'alpha', status: 'all', source: 'all', sort: 'name' }).map(item => item.id)).toEqual(['a']);
    });

    test('filters state/source and sorts dates', () => {
        expect(filterAndSortScripts(scripts, { query: '', status: 'disabled', source: 'local', sort: 'name' }).map(item => item.id)).toEqual(['b']);
        expect(filterAndSortScripts(scripts, { query: '', status: 'all', source: 'all', sort: 'updated' }).map(item => item.id)).toEqual(['a', 'b']);
    });
});
