
/**
 * Type definitions for Greasemonkey/Tampermonkey APIs
 */
const GM_TYPES = `
declare var unsafeWindow: Window;

declare interface GM_info_Script {
    description: string;
    excludes: string[];
    includes: string[];
    matches: string[];
    name: string;
    namespace: string;
    resources: { [key: string]: { name: string, url: string, content: string, meta: string } };
    runAt: string;
    version: string;
    [key: string]: any; // Allow custom props
}

declare interface GM_info {
    script: GM_info_Script;
    scriptHandler: string;
    version: string;
    [key: string]: any;
}

declare var GM_info: GM_info;

/**
 * Adds the given style to the document and returns the injected style element.
 */
declare function GM_addStyle(css: string): HTMLStyleElement;

/**
 * Deletes 'name' from storage.
 */
declare function GM_deleteValue(name: string): void;

/**
 * List all names of the storage.
 */
declare function GM_listValues(): string[];

/**
 * Adds a change listener to the storage and returns the listener ID.
 * 'name' is the name of the observed variable.
 * The 'remote' argument of the callback function shows whether this value was modified from the instance of another tab (true) or within this script instance (false).
 * Therefore this functionality can be used by scripts of different browser tabs to communicate with each other.
 */
declare function GM_addValueChangeListener(name: string, function_callback: (name: string, old_value: any, new_value: any, remote: boolean) => any): number;

/**
 * Removes a change listener by its ID.
 */
declare function GM_removeValueChangeListener(listener_id: number): void;

/**
 * Sets the value of 'name' to the storage.
 */
declare function GM_setValue(name: string, value: any): void;

/**
 * Retrieves the value of 'name' from storage.
 */
declare function GM_getValue(name: string, defaultValue?: any): any;

/**
 * Writes the text to the log.
 */
declare function GM_log(message: string): void;

/**
 * Register a menu to be displayed at the Tampermonkey menu.
 * The 'accessKey' is an optional keyboard shortcut. (e.g. 's')
 */
declare function GM_registerMenuCommand(name: string, fn: () => void, accessKey?: string): number;

/**
 * Unregister a menu command that has been previously registered by GM_registerMenuCommand with the given menu command ID.
 */
declare function GM_unregisterMenuCommand(menuCmdId: number): void;

/**
 * Opens a new tab with this url.
 * The options object can contain the following properties:
 * - active: decides whether the new tab should be focused,
 * - insert: that inserts the new tab after the current one,
 * - setParent: makes the browser re-focus the current tab on close and
 * - incognito: makes the tab being opened inside a incognito mode/private mode window.
 * Otherwise the new tab is just appended.
 */
declare function GM_openInTab(url: string, options?: boolean | { active?: boolean, insert?: boolean, setParent?: boolean, incognito?: boolean }): { close: () => void, onclose?: () => void, closed: boolean };

/**
 * XMLHTTPRequest replacement.
 */
declare interface GM_xmlhttpRequest_details {
    method?: "GET" | "HEAD" | "POST" | "PUT" | "DELETE" | "PATCH" | "OPTIONS" | "TRACE" | "CONNECT";
    url: string;
    headers?: { [key: string]: string };
    data?: string | FormData | Blob | ArrayBuffer | Document | URLSearchParams; // simplified
    cookie?: string;
    binary?: boolean;
    nocache?: boolean;
    revalidate?: boolean;
    timeout?: number;
    context?: any;
    responseType?: "text" | "json" | "blob" | "arraybuffer" | "document" | "stream";
    overrideMimeType?: string;
    anonymous?: boolean;
    fetch?: boolean;
    username?: string;
    password?: string;
    onload?: (response: GM_xmlhttpRequest__response) => void;
    onloadstart?: (response: GM_xmlhttpRequest__response) => void;
    onprogress?: (response: GM_xmlhttpRequest__progress) => void;
    onreadystatechange?: (response: GM_xmlhttpRequest__response) => void;
    ontimeout?: (response: GM_xmlhttpRequest__response) => void;
    onabort?: (response: GM_xmlhttpRequest__response) => void;
    onerror?: (response: GM_xmlhttpRequest__response) => void;
}

declare interface GM_xmlhttpRequest__response {
    finalUrl: string;
    readyState: number;
    status: number;
    statusText: string;
    responseHeaders: string;
    response: any;
    responseText: string;
    responseXML: Document | null;
    context: any;
}

declare interface GM_xmlhttpRequest__progress extends GM_xmlhttpRequest__response {
    lengthComputable: boolean;
    loaded: number;
    total: number;
}

declare function GM_xmlhttpRequest(details: GM_xmlhttpRequest_details): { abort: () => void };

/**
 * Downloads a given URL to the local disk.
 */
declare function GM_download(details: { url: string, name: string, headers?: any, saveAs?: boolean, onload?: Function, onerror?: Function, onprogress?: Function, ontimeout?: Function }): { abort: () => void };
declare function GM_download(url: string, name: string): { abort: () => void };

/**
 * Get the content of a defined @resource.
 * If the 'isBase64' param is true, the content will be encoded as Base64.
 */
declare function GM_getResourceText(name: string): string;

/**
 * Get the base64 encoded URI of a defined @resource.
 */
declare function GM_getResourceURL(name: string): string;

/**
 * Shows a HTML5 Desktop notification and/or highlights the current tab.
 */
declare function GM_notification(details: { text: string, title?: string, image?: string, highlight?: boolean, silent?: boolean, timeout?: number, onclick?: Function, ondone?: Function }): void;
declare function GM_notification(text: string, title?: string, image?: string, onclick?: Function): void;

/**
 * Copies the data to the clipboard.
 * The parameter 'info' can be an object like "{ type: 'text', mimetype: 'text/plain' }" or just a string expressing the type ("text" or "html").
 */
declare function GM_setClipboard(data: string, info?: string | { type?: string, mimetype?: string }): void;

declare const GM: {
    info: GM_info;
    setValue(name: string, value: any): Promise<void>;
    getValue(name: string, defaultValue?: any): Promise<any>;
    deleteValue(name: string): Promise<void>;
    listValues(): Promise<string[]>;
    addValueChangeListener(name: string, function_callback: (name: string, old_value: any, new_value: any, remote: boolean) => any): number;
    removeValueChangeListener(listener_id: number): void;
    xmlhttpRequest(details: GM_xmlhttpRequest_details): { abort: () => void };
    setClipboard(data: string, info?: string | { type?: string, mimetype?: string }): void;
    notification(details: { text: string, title?: string, image?: string, highlight?: boolean, silent?: boolean, timeout?: number, onclick?: Function, ondone?: Function }): void;
    openInTab(url: string, options?: boolean | { active?: boolean, insert?: boolean, setParent?: boolean, incognito?: boolean }): { close: () => void, onclose?: () => void, closed: boolean };
    registerMenuCommand(name: string, fn: () => void, accessKey?: string): number;
    unregisterMenuCommand(menuCmdId: number): void;
};
`;

/**
 * Configures Monaco Editor with GM types and Metadata completion
 */
export const configureMonaco = (monaco: any) => {
    // 1. Add GM Types
    const libDisposable = monaco.languages.typescript.javascriptDefaults.addExtraLib(GM_TYPES, 'ts:filename/gm.d.ts');

    // 2. Set Compiler Options to allow JS
    monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
        target: monaco.languages.typescript.ScriptTarget.ESNext,
        allowNonTsExtensions: true,
        allowJs: true,
        checkJs: true
    });

    // 3. Register Metadata Completion Provider
    const completionDisposable = monaco.languages.registerCompletionItemProvider('javascript', {
        triggerCharacters: ['@', " "],
        provideCompletionItems: (model: any, position: any) => {
            const textUntilPosition = model.getValueInRange({
                startLineNumber: 1,
                startColumn: 1,
                endLineNumber: position.lineNumber,
                endColumn: position.column
            });

            const currentLine = model.getLineContent(position.lineNumber);
            const inHeader = textUntilPosition.includes('==UserScript==') && !textUntilPosition.includes('==/UserScript==');

            if (!inHeader) {
                return { suggestions: [] };
            }

            // Regex to check if we are in a metadata line
            const headerRegex = /^(\s*\/\/\s*@)(\w*)([\s\S]*)$/;
            const match = currentLine.match(headerRegex);

            if (!match) return { suggestions: [] };

            // Check text BEFORE cursor to determine context
            const textBeforeCursor = currentLine.substring(0, position.column - 1);

            // 1. Check if we are typing the key (e.g. "// @g" or "// @")
            // Matches "// @" optionally followed by word chars, but NO whitespace after
            if (/^\s*\/\/\s*@\w*$/.test(textBeforeCursor)) {
                const keys = [
                    'name', 'namespace', 'version', 'author', 'description',
                    'homepage', 'homepageURL', 'website', 'source',
                    'icon', 'iconURL', 'defaulticon', 'icon64', 'icon64URL',
                    'updateURL', 'downloadURL', 'installURL', 'supportURL',
                    'include', 'match', 'exclude', 'require', 'resource',
                    'connect', 'grant', 'run-at', 'noframes', 'unwrap', 'nocompat'
                ];

                const word = model.getWordUntilPosition(position);
                const range = {
                    startLineNumber: position.lineNumber,
                    endLineNumber: position.lineNumber,
                    startColumn: word.startColumn,
                    endColumn: word.endColumn
                };

                return {
                    suggestions: keys.map(k => ({
                        label: k,
                        kind: monaco.languages.CompletionItemKind.Keyword,
                        insertText: k,
                        range: range,
                        documentation: `Metadata key: @${k}`
                    }))
                };
            }

            // 2. Check if we are typing a value for a specific key
            // Matches "// @key " (at least one space)
            const keyMatch = textBeforeCursor.match(/^\s*\/\/\s*@([\w-]+)\s+/);
            if (keyMatch) {
                const key = keyMatch[1];
                const word = model.getWordUntilPosition(position);
                const range = {
                    startLineNumber: position.lineNumber,
                    endLineNumber: position.lineNumber,
                    startColumn: word.startColumn,
                    endColumn: word.endColumn
                };

                if (key === 'grant') {
                    const grants = [
                        'none', 'unsafeWindow', 'window.close', 'window.focus', 'window.onurlchange',
                        'GM_setValue', 'GM_getValue', 'GM_deleteValue', 'GM_listValues',
                        'GM_addValueChangeListener', 'GM_removeValueChangeListener',
                        'GM_getResourceText', 'GM_getResourceURL', 'GM_addStyle',
                        'GM_openInTab', 'GM_registerMenuCommand', 'GM_unregisterMenuCommand',
                        'GM_notification', 'GM_setClipboard', 'GM_xmlhttpRequest', 'GM_download', 'GM_log',
                        'GM.setValue', 'GM.getValue', 'GM.deleteValue', 'GM.listValues',
                        'GM.addValueChangeListener', 'GM.removeValueChangeListener',
                        'GM.getResourceText', 'GM.getResourceURL', 'GM.addStyle',
                        'GM.openInTab', 'GM.registerMenuCommand', 'GM.unregisterMenuCommand',
                        'GM.notification', 'GM.setClipboard', 'GM.xmlhttpRequest', 'GM.download', 'GM.info'
                    ];

                    return {
                        suggestions: grants.map((g, index) => ({
                            label: g,
                            kind: monaco.languages.CompletionItemKind.Value,
                            insertText: g,
                            // Ensure order is preserved by padding index with zeros
                            sortText: index.toString().padStart(3, '0'),
                            range: range
                        }))
                    };
                } else if (key === 'run-at') {
                    const runAts = ['document-start', 'document-body', 'document-end', 'document-idle', 'context-menu'];
                    return {
                        suggestions: runAts.map(r => ({
                            label: r,
                            kind: monaco.languages.CompletionItemKind.EnumMember,
                            insertText: r,
                            range: range
                        }))
                    };
                }
            }

            return { suggestions: [] };
        }
    });

    return {
        dispose: () => {
            libDisposable.dispose();
            completionDisposable.dispose();
        }
    };
};
