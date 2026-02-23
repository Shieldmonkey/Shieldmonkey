import type { Script, Theme } from '../options/types';

export interface BridgeActionMap {
    'GET_SETTINGS': {
        payload?: never;
        response: {
            scripts?: Script[];
            theme?: Theme;
            locale?: string;
            extensionEnabled?: boolean;
            lastBackupTime?: string;
            autoBackup?: boolean;
        }
    };
    'UPDATE_THEME': { payload: Theme; response: void };
    'UPDATE_LOCALE': { payload: string; response: void };
    'TOGGLE_GLOBAL': { payload: boolean; response: void };
    'TOGGLE_SCRIPT': { payload: { scriptId: string, enabled: boolean }; response: void };
    'DELETE_SCRIPT': { payload: { scriptId: string }; response: void };
    'SAVE_SCRIPT': { payload: Script; response: void };
    'OPEN_DASHBOARD': { payload?: { path?: string }; response: void };
    'OPEN_URL': { payload: string; response: void };
    'GET_CURRENT_TAB_URL': { payload?: never; response: string | undefined };
    'GET_I18N_MESSAGE': { payload: { key: string, substitutions?: string | string[] }; response: string };
    'RELOAD_SCRIPTS': { payload?: never; response: void };
    'START_UPDATE_FLOW': { payload: { scriptId: string }; response: void };
    'IMPORT_FILE': { payload?: never; response: Script[] };
    'IMPORT_DIRECTORY': { payload?: never; response: Script[] };
    'UPDATE_BACKUP_SETTINGS': { payload: { autoBackup?: boolean, lastBackupTime?: string }; response: void };
    'GET_APP_INFO': { payload?: never; response: { version: string } };
    'UPDATE_SCRIPTS': { payload: Script[]; response: void };
    'GET_PENDING_INSTALL': { payload: { id: string }; response: { url: string; content: string; referrer?: string } | undefined };
    'CLEAR_PENDING_INSTALL': { payload: { id: string }; response: void };
    'SELECT_BACKUP_DIR': { payload?: never; response: string | null };
    'GET_BACKUP_DIR_NAME': { payload?: never; response: string | null };
    'RUN_BACKUP': { payload: { scripts: Script[], version: string }; response: number };
    'RUN_RESTORE': { payload: { scripts: Script[] }; response: { count: number, mergedScripts: Script[] } };
    'CHECK_USER_SCRIPTS_PERMISSION': { payload?: never; response: boolean };
    'REQUEST_USER_SCRIPTS_PERMISSION': { payload?: never; response: boolean };
    'OPEN_EXTENSION_SETTINGS': { payload?: never; response: void };
    'CLOSE_TAB': { payload?: never; response: void };
    'DOWNLOAD_JSON': { payload: { data: string, filename: string }; response: boolean };
}

export type ActionType = keyof BridgeActionMap;

export interface BridgeMessage<T extends ActionType = ActionType> {
    id: string;
    type: T;
    payload?: BridgeActionMap[T]['payload'];
}

export type TypedBridgeMessage = {
    [K in ActionType]: BridgeActionMap[K]['payload'] extends undefined | never
    ? { id: string; type: K; payload?: never }
    : { id: string; type: K; payload: BridgeActionMap[K]['payload'] }
}[ActionType];

export interface BridgeResponse {
    id: string;
    error?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    result?: any;
}

export interface StorageChangeMessage {
    type: 'STORAGE_CHANGED';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    changes: { [key: string]: any }; // simplified storage change
    areaName: string;
}
