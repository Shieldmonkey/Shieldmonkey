/**
 * Wrapper for chrome.i18n.getMessage to make it easier to use in the application
 */
export const t = (key: string, substitutions?: string | string[]): string => {
    return chrome.i18n.getMessage(key, substitutions) || key;
};
