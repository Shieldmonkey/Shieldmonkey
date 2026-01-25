export interface Script {
    id: string;
    name: string;
    code: string;
    enabled?: boolean;
    lastSavedCode?: string;
    grantedPermissions?: string[];
    updateUrl?: string;
    downloadUrl?: string;
    sourceUrl?: string;
    namespace?: string;
    installDate?: number;
}

export type Theme = 'light' | 'dark' | 'system';
