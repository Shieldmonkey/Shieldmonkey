
export const matchPattern = (pattern: string, url: string): boolean => {
    if (pattern === '<all_urls>') return true;

    // Basic glob to regex conversion
    // Escape special regex characters except *
    let regexString = pattern
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*');

    // Allow matching domain patterns like *://google.com/*
    // Note: This is an oversimplification of Chrome's match patterns but suffices for many cases
    // Ideally we would parse scheme, host, path.

    // If pattern starts with *, it might match scheme. 
    // Standard chrome match pattern: scheme://host/path
    // *://*.google.com/foo*bar

    // Let's improve the * handling slightly for common cases
    // But strictly, this simple regex is "okay" for a basic check.

    // Ensure the whole string matches
    const regex = new RegExp(`^${regexString}$`);
    return regex.test(url);
};
