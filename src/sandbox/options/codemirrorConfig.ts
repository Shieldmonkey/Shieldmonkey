import { type CompletionContext, type CompletionResult, type CompletionSource } from '@codemirror/autocomplete';

// Define metadata keys for completion
const METADATA_KEYS = [
    'name', 'namespace', 'version', 'author', 'description',
    'homepage', 'homepageURL', 'website', 'source',
    'icon', 'iconURL', 'defaulticon', 'icon64', 'icon64URL',
    'updateURL', 'downloadURL', 'installURL', 'supportURL',
    'include', 'match', 'exclude', 'require', 'resource',
    'connect', 'grant', 'run-at', 'noframes', 'unwrap', 'nocompat'
];

const GRANT_VALUES = [
    'none', 'unsafeWindow', 'window.close', 'window.focus', 'window.onurlchange',
    'GM_setValue', 'GM_getValue', 'GM_deleteValue', 'GM_listValues',
    'GM_addValueChangeListener', 'GM_removeValueChangeListener',
    'GM_getResourceText', 'GM_getResourceURL', 'GM_addStyle',
    'GM_openInTab', 'GM_notification', 'GM_setClipboard', 'GM_xmlhttpRequest', 'GM_download', 'GM_log',
    'GM.setValue', 'GM.getValue', 'GM.deleteValue', 'GM.listValues',
    'GM.addValueChangeListener', 'GM.removeValueChangeListener',
    'GM.getResourceText', 'GM.getResourceURL', 'GM.addStyle',
    'GM.openInTab', 'GM.notification', 'GM.setClipboard', 'GM.xmlhttpRequest', 'GM.download', 'GM.info'
];

const RUN_AT_VALUES = [
    'document-start', 'document-body', 'document-end', 'document-idle', 'context-menu'
];

/**
 * Completion source for UserScript metadata block
 */
export const userScriptMetadataCompletion: CompletionSource = (context: CompletionContext): CompletionResult | null => {
    // Check if we are in a comment block (simplified check or use syntax tree)
    const line = context.state.doc.lineAt(context.pos);
    const textBefore = line.text.slice(0, context.pos - line.from);

    // Only trigger if line starts with //
    if (!/^\s*\/\/\s+/.test(textBefore)) {
        return null;
    }

    // Determine if we are typing a key: // @
    const keyMatch = textBefore.match(/\/\/\s+@(\w*)$/);
    if (keyMatch) {
        return {
            from: context.pos - keyMatch[1].length,
            options: METADATA_KEYS.map(key => ({
                label: key,
                type: 'keyword',
                detail: 'metadata',
                apply: key + ' '
            }))
        };
    }

    // Determine if we are typing a value for specific keys
    // e.g. // @grant GM_
    const valueMatch = textBefore.match(/\/\/\s+@(\w+)\s+(\S*)$/);
    if (valueMatch) {
        const key = valueMatch[1];
        const valuePrefix = valueMatch[2];

        if (key === 'grant') {
            return {
                from: context.pos - valuePrefix.length,
                options: GRANT_VALUES.map(val => ({
                    label: val,
                    type: 'constant'
                }))
            };
        }

        if (key === 'run-at') {
            return {
                from: context.pos - valuePrefix.length,
                options: RUN_AT_VALUES.map(val => ({
                    label: val,
                    type: 'constant'
                }))
            };
        }
    }

    return null;
};



