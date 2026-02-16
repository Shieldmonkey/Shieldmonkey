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

}

export type Theme = 'light' | 'dark' | 'system';
