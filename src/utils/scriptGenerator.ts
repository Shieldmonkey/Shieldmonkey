import gmApiImplCode from '../injected/gm_api_impl.js?raw';

export interface GM_ScriptConfig {
    id: string;
    name: string;
    version: string;
    permissions: string[];
    namespace?: string;
    description?: string;
    token: string;
}

export function getGMAPIScript(config: GM_ScriptConfig): string {
    const perms = JSON.stringify(config.permissions || []);
    const scriptObj = JSON.stringify({
        version: config.version || '1.0',
        name: config.name || 'Unknown Script',
        namespace: config.namespace || '',
        description: config.description || '',
    });

    return gmApiImplCode
        .replace('"__SCRIPT_NAME__"', JSON.stringify(config.name))
        .replace('"__SCRIPT_ID__"', JSON.stringify(config.id))
        .replace('"__SCRIPT_TOKEN__"', JSON.stringify(config.token))
        .replace("'__GRANTED_PERMISSIONS__'", JSON.stringify(perms))
        .replace("'__SCRIPT_OBJ__'", JSON.stringify(scriptObj));
}

// Deprecated: for backward comp only if needed, but we should remove it
export const GM_API_SCRIPT = getGMAPIScript({ id: '', name: '', version: '', permissions: [], token: '' });
