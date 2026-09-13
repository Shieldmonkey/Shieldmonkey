export interface ScriptRecord {
    id: string;
    name: string;
    code: string;
    enabled?: boolean;
    grantedPermissions?: string[];
    sourceUrl?: string;
    referrerUrl?: string;
    updateUrl?: string;
    downloadUrl?: string;
    namespace?: string;
    installDate?: number;
    updateDate?: number;
    token?: string;
    /** Accepted when reading legacy storage, but never required when writing. */
    lastSavedCode?: string;
}

export interface ScriptDraft extends Omit<ScriptRecord, 'lastSavedCode'> {
    baselineCode: string;
}

export type Theme = 'light' | 'dark' | 'system';

export const normalizeScript = (script: ScriptRecord): ScriptRecord => ({
    ...script,
    enabled: script.enabled !== false,
    grantedPermissions: script.grantedPermissions ?? []
});

export const toPersistedScript = (script: ScriptRecord): ScriptRecord => {
    const persisted = { ...script };
    delete persisted.lastSavedCode;
    return persisted;
};
