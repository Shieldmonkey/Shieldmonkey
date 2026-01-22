declare namespace chrome.userScripts {
    interface ScriptSource {
        code?: string;
        file?: string;
    }

    interface UserScript {
        id: string;
        matches?: string[];
        excludeMatches?: string[];
        includeGlobs?: string[];
        excludeGlobs?: string[];
        js?: ScriptSource[];
        css?: ScriptSource[];
        runAt?: 'document_start' | 'document_end' | 'document_idle';
        allFrames?: boolean;
        world?: 'ISOLATED' | 'MAIN' | 'USER_SCRIPT';
    }

    interface ScriptFilter {
        ids?: string[];
    }

    interface ConfigureWorldProperties {
        csp?: string;
        messaging?: boolean;
    }

    function register(scripts: UserScript[]): Promise<void>;
    function unregister(filter?: ScriptFilter): Promise<void>;
    function getScripts(filter?: ScriptFilter): Promise<UserScript[]>;
    function configureWorld(properties: ConfigureWorldProperties): Promise<void>;
}
