
import { describe, it, expect } from 'vitest';
import { isScriptMatchingUrl } from '../../src/utils/scriptMatcher';

describe('isScriptMatchingUrl', () => {
    it('should match URL with @match', () => {
        const code = `
// ==UserScript==
// @name Test
// @match *://example.com/*
// ==/UserScript==
        `;
        expect(isScriptMatchingUrl(code, 'https://example.com/foo')).toBe(true);
        expect(isScriptMatchingUrl(code, 'https://google.com/')).toBe(false);
    });

    it('should match URL with @include', () => {
        const code = `
// ==UserScript==
// @name Test
// @include *://example.com/*
// ==/UserScript==
        `;
        expect(isScriptMatchingUrl(code, 'https://example.com/foo')).toBe(true);
    });

    it('should exclude URL with @exclude', () => {
        const code = `
// ==UserScript==
// @name Test
// @match *://example.com/*
// @exclude *://example.com/admin/*
// ==/UserScript==
        `;
        expect(isScriptMatchingUrl(code, 'https://example.com/foo')).toBe(true);
        // This is the bug fix verification:
        expect(isScriptMatchingUrl(code, 'https://example.com/admin/settings')).toBe(false);
    });

    it('should match all URLs if no match/include is provided', () => {
        const code = `
// ==UserScript==
// @name Test
// ==/UserScript==
        `;
        expect(isScriptMatchingUrl(code, 'https://example.com/')).toBe(true);
        expect(isScriptMatchingUrl(code, 'https://google.com/')).toBe(true);
    });

    it('should exclude URLs even if no match/include is provided', () => {
        const code = `
// ==UserScript==
// @name Test
// @exclude *://example.com/*
// ==/UserScript==
        `;
        expect(isScriptMatchingUrl(code, 'https://google.com/')).toBe(true);
        expect(isScriptMatchingUrl(code, 'https://example.com/foo')).toBe(false);
    });
});
