export type ActionType =
    | 'GET_SETTINGS'
    | 'UPDATE_THEME'
    | 'UPDATE_LOCALE'
    | 'TOGGLE_GLOBAL'
    | 'TOGGLE_SCRIPT'
    | 'DELETE_SCRIPT'
    | 'SAVE_SCRIPT'
    | 'OPEN_DASHBOARD'
    | 'OPEN_URL'
    | 'GET_CURRENT_TAB_URL'
    | 'GET_I18N_MESSAGE'
    | 'RELOAD_SCRIPTS'
    | 'START_UPDATE_FLOW'
    | 'IMPORT_FILE'
    | 'IMPORT_DIRECTORY'
    | 'UPDATE_BACKUP_SETTINGS'
    | 'GET_APP_INFO'
    | 'UPDATE_SCRIPTS'
    | 'GET_PENDING_INSTALL'
    | 'CLEAR_PENDING_INSTALL'
    | 'SELECT_BACKUP_DIR'
    | 'GET_BACKUP_DIR_NAME'
    | 'RUN_BACKUP'
    | 'RUN_RESTORE'
    | 'CHECK_USER_SCRIPTS_PERMISSION'
    | 'REQUEST_USER_SCRIPTS_PERMISSION'
    | 'REQUEST_USER_SCRIPTS_PERMISSION'
    | 'OPEN_EXTENSION_SETTINGS'
    | 'CLOSE_TAB'
    | 'DOWNLOAD_JSON';

export interface BridgeMessage {
    id: string;
    type: ActionType;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    payload?: any;
}

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
