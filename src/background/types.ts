export interface Script {
    id: string;
    name: string;
    code: string;
    enabled?: boolean;
    grantedPermissions?: string[];
    sourceUrl?: string;
    referrerUrl?: string;

    installDate?: number;
    updateDate?: number;
    token?: string;
    [key: string]: unknown;
}
