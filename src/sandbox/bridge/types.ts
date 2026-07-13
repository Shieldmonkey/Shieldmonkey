import type { ScriptRecord as Script, Theme } from '../../types/script';

export type BridgeErrorCode = 'INVALID_REQUEST' | 'UNAUTHORIZED_SOURCE' | 'TIMEOUT' | 'ACTION_FAILED';

export interface BridgeError {
    code: BridgeErrorCode;
    message: string;
    action?: ActionType;
}

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
    'OPEN_DASHBOARD': { payload?: { path?: string; query?: Record<string, string> }; response: void };
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
    'RELOAD_EXTENSION': { payload?: never; response: void };
    'BULK_SET_SCRIPT_ENABLED': { payload: { scriptIds: string[]; enabled: boolean }; response: void };
    'BULK_DELETE_SCRIPTS': { payload: { scriptIds: string[] }; response: void };
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
    error?: BridgeError;
    result?: unknown;
}

const noPayloadActions = new Set<ActionType>([
    'GET_SETTINGS', 'GET_APP_INFO', 'GET_CURRENT_TAB_URL', 'RELOAD_SCRIPTS',
    'IMPORT_FILE', 'IMPORT_DIRECTORY', 'GET_BACKUP_DIR_NAME',
    'CHECK_USER_SCRIPTS_PERMISSION', 'REQUEST_USER_SCRIPTS_PERMISSION',
    'OPEN_EXTENSION_SETTINGS', 'CLOSE_TAB', 'RELOAD_EXTENSION'
]);

const isObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);
const isId = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 256;
const isIdList = (value: unknown): value is string[] => Array.isArray(value) && value.length > 0 && value.length <= 1000 && value.every(isId);

export function isBridgeRequest(value: unknown): value is TypedBridgeMessage {
    if (!isObject(value) || !isId(value.id) || typeof value.type !== 'string') return false;
    const type = value.type as ActionType;
    if (noPayloadActions.has(type)) return value.payload === undefined;
    const payload = value.payload;
    if (type === 'UPDATE_THEME') return payload === 'light' || payload === 'dark' || payload === 'system';
    if (type === 'UPDATE_LOCALE') return payload === 'en' || payload === 'ja' || payload === 'system';
    if (type === 'TOGGLE_GLOBAL') return typeof payload === 'boolean';
    if (type === 'OPEN_URL') {
        if (typeof payload !== 'string') return false;
        try { return new URL(payload).protocol === 'https:'; } catch { return false; }
    }
    if (type === 'OPEN_DASHBOARD') {
        if (payload === undefined) return true;
        if (!isObject(payload)) return false;
        if (payload.path !== undefined && (typeof payload.path !== 'string' || !payload.path.startsWith('/options/'))) return false;
        return payload.query === undefined || (isObject(payload.query) && Object.values(payload.query).every(item => typeof item === 'string'));
    }
    if (type === 'TOGGLE_SCRIPT') return isObject(payload) && isId(payload.scriptId) && typeof payload.enabled === 'boolean';
    if (type === 'DELETE_SCRIPT' || type === 'START_UPDATE_FLOW') return isObject(payload) && isId(payload.scriptId);
    if (type === 'BULK_SET_SCRIPT_ENABLED') return isObject(payload) && isIdList(payload.scriptIds) && typeof payload.enabled === 'boolean';
    if (type === 'BULK_DELETE_SCRIPTS') return isObject(payload) && isIdList(payload.scriptIds);
    if (type === 'GET_I18N_MESSAGE') return isObject(payload) && typeof payload.key === 'string';
    if (type === 'GET_PENDING_INSTALL' || type === 'CLEAR_PENDING_INSTALL') return isObject(payload) && isId(payload.id);
    if (type === 'DOWNLOAD_JSON') return isObject(payload) && typeof payload.data === 'string' && typeof payload.filename === 'string';
    if (type === 'RUN_BACKUP') return isObject(payload) && Array.isArray(payload.scripts) && typeof payload.version === 'string';
    if (type === 'RUN_RESTORE') return isObject(payload) && Array.isArray(payload.scripts);
    if (type === 'UPDATE_BACKUP_SETTINGS') return isObject(payload);
    if (type === 'UPDATE_SCRIPTS') return Array.isArray(payload);
    if (type === 'SAVE_SCRIPT') return isObject(payload) && isId(payload.id) && typeof payload.code === 'string' && typeof payload.name === 'string';
    return false;
}

export interface StorageChangeMessage {
    type: 'STORAGE_CHANGED';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    changes: { [key: string]: any }; // simplified storage change
    areaName: string;
}

export interface SandboxReadyMessage {
    type: 'SANDBOX_READY';
    route: 'popup';
}
