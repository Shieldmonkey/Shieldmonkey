import { describe, expect, test } from 'vitest';
import { isBridgeRequest } from '../../src/sandbox/bridge/types';

describe('bridge request validation', () => {
    test('accepts typed requests', () => {
        expect(isBridgeRequest({ id: '1', type: 'TOGGLE_SCRIPT', payload: { scriptId: 'script-1', enabled: true } })).toBe(true);
        expect(isBridgeRequest({ id: '2', type: 'OPEN_DASHBOARD', payload: { path: '/options/new', query: { match: 'https://example.com/' } } })).toBe(true);
        expect(isBridgeRequest({ id: '3', type: 'BULK_DELETE_SCRIPTS', payload: { scriptIds: ['a', 'b'] } })).toBe(true);
    });

    test('rejects malformed, unknown, and unsafe requests', () => {
        expect(isBridgeRequest({ id: '1', type: 'TOGGLE_SCRIPT', payload: { scriptId: '', enabled: true } })).toBe(false);
        expect(isBridgeRequest({ id: '2', type: 'OPEN_DASHBOARD', payload: { path: 'https://example.com/' } })).toBe(false);
        expect(isBridgeRequest({ id: '3', type: 'OPEN_URL', payload: 'javascript:alert(1)' })).toBe(false);
        expect(isBridgeRequest({ id: '4', type: 'UNKNOWN' })).toBe(false);
    });
});
