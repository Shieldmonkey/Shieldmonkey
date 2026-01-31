import { parseMetadata } from './metadataParser';
import { matchPattern } from './urlMatcher';

/**
 * Checks if a script should run on a specific URL based on its metadata (match, include, exclude).
 * Rules:
 * 1. If URL matches any @exclude rule, it returns false.
 * 2. If URL matches any @match or @include rule, it returns true.
 * 3. If no @match or @include are specified, it defaults to <all_urls> (returns true unless excluded).
 */
export function isScriptMatchingUrl(scriptCode: string, url: string): boolean {
    const metadata = parseMetadata(scriptCode);
    const includePatterns = [...metadata.match, ...metadata.include];
    const excludePatterns = metadata.exclude;

    // Check exclude first
    if (excludePatterns && excludePatterns.some(pattern => matchPattern(pattern, url))) {
        return false;
    }

    // Check include/match
    const effectivePatterns = includePatterns.length > 0 ? includePatterns : ["<all_urls>"];
    return effectivePatterns.some(pattern => matchPattern(pattern, url));
}
