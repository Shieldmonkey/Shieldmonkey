export interface Script {
    id: string;
    name: string;
    code: string;
    enabled?: boolean;
    lastSavedCode?: string;
    grantedPermissions?: string[];
    sourceUrl?: string;
    referrerUrl?: string;
    namespace?: string;
    installDate?: number;
    updateDate?: number;
    updateUrl?: string;
    downloadUrl?: string;
}

export type Theme = 'light' | 'dark' | 'system';
