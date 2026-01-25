export interface Script {
    id: string;
    name: string;
    code: string;
    enabled?: boolean;
    grantedPermissions?: string[];
    sourceUrl?: string;
    referrerUrl?: string;
    updateUrl?: string;
    downloadUrl?: string;
    installDate?: number;
    updateDate?: number;
    [key: string]: unknown;
}
