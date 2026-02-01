/**
 * Validates if a URL string uses http or https protocol.
 * @param urlStr The URL string to check.
 * @returns True if the URL is valid and uses http: or https: protocol, false otherwise.
 */
export const isValidHttpUrl = (urlStr: string | undefined | null): boolean => {
    if (!urlStr) return false;
    try {
        const url = new URL(urlStr);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
        return false;
    }
};

/**
 * Sanitizes a URL string. If valid http/https, returns the URL.
 * Otherwise returns 'about:blank'.
 * @param urlStr The URL string to sanitize.
 * @returns The original URL if valid, otherwise 'about:blank'.
 */
export const sanitizeToHttpUrl = (urlStr: string | undefined | null): string => {
    if (isValidHttpUrl(urlStr)) {
        return urlStr as string;
    }
    return 'about:blank';
};
