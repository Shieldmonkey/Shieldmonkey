export const UserscriptMessageType = {
    GM_setValue: 'GM_setValue',
    GM_getValue: 'GM_getValue',
    GM_deleteValue: 'GM_deleteValue',
    GM_listValues: 'GM_listValues',
    GM_notification: 'GM_notification',
    GM_openInTab: 'GM_openInTab',
    GM_log: 'GM_log',
    GM_xmlhttpRequest: 'GM_xmlhttpRequest',
    GM_registerMenuCommand: 'GM_registerMenuCommand',
    GM_download: 'GM_download',
    GM_unregisterMenuCommand: 'GM_unregisterMenuCommand',
    GM_setValues: 'GM_setValues',
    GM_getValues: 'GM_getValues',
    GM_deleteValues: 'GM_deleteValues',
    GM_closeTab: 'GM_closeTab',

    // Internal
    GM_xhrAbort: 'GM_xhrAbort'
} as const;

export type UserscriptMessageType = typeof UserscriptMessageType[keyof typeof UserscriptMessageType];

export const MessageType = {
    SAVE_SCRIPT: 'SAVE_SCRIPT',
    TOGGLE_SCRIPT: 'TOGGLE_SCRIPT',
    TOGGLE_GLOBAL: 'TOGGLE_GLOBAL',
    DELETE_SCRIPT: 'DELETE_SCRIPT',
    OPEN_INSTALL_PAGE: 'OPEN_INSTALL_PAGE',
    START_UPDATE_FLOW: 'START_UPDATE_FLOW',
    RELOAD_SCRIPTS: 'RELOAD_SCRIPTS',
    INSTALL_SCRIPT_WITH_CONTENT: 'INSTALL_SCRIPT_WITH_CONTENT',
    INSTALL_SCRIPT_FETCH_FAILED: 'INSTALL_SCRIPT_FETCH_FAILED'
} as const;

export type MessageType = typeof MessageType[keyof typeof MessageType];
