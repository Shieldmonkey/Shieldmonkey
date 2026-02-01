import { describe, it, expect } from 'vitest';
import { isValidHttpUrl, sanitizeToHttpUrl } from '../../src/utils/urlValidator';

describe('urlValidator', () => {
    describe('isValidHttpUrl', () => {
        it('should return true for http URLs', () => {
            expect(isValidHttpUrl('http://example.com')).toBe(true);
        });

        it('should return true for https URLs', () => {
            expect(isValidHttpUrl('https://example.com')).toBe(true);
        });

        it('should return false for file URLs', () => {
            expect(isValidHttpUrl('file:///etc/passwd')).toBe(false);
        });

        it('should return false for javascript URLs', () => {
            expect(isValidHttpUrl('javascript:alert(1)')).toBe(false);
        });

        it('should return false for invalid URLs', () => {
            expect(isValidHttpUrl('not a url')).toBe(false);
        });

        it('should return false for empty/null/undefined', () => {
            expect(isValidHttpUrl('')).toBe(false);
            expect(isValidHttpUrl(null)).toBe(false);
            expect(isValidHttpUrl(undefined)).toBe(false);
        });
    });

    describe('sanitizeToHttpUrl', () => {
        it('should return original URL if valid', () => {
            expect(sanitizeToHttpUrl('https://example.com')).toBe('https://example.com');
        });

        it('should return about:blank for invalid URLs', () => {
            expect(sanitizeToHttpUrl('ftp://example.com')).toBe('about:blank');
            expect(sanitizeToHttpUrl('javascript:void(0)')).toBe('about:blank');
        });
    });
});
