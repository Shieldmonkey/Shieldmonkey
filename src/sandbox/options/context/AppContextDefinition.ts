import { createContext } from 'react';
import { type Script, type Theme } from '../types';

export interface AppContextType {
    scripts: Script[];
    loadStatus: 'loading' | 'ready' | 'error';
    operationError: string | null;
    clearOperationError: () => void;
    theme: Theme;
    extensionEnabled: boolean;
    setTheme: (theme: Theme) => void;
    toggleExtension: (enabled: boolean) => Promise<void>;
    setScripts: React.Dispatch<React.SetStateAction<Script[]>>;
    reloadScripts: () => Promise<void>;
    saveScript: (script: Script) => Promise<void>;
    deleteScript: (id: string) => Promise<void>;
    toggleScript: (script: Script, enabled: boolean) => Promise<void>;
    bulkSetScriptEnabled: (ids: string[], enabled: boolean) => Promise<void>;
    bulkDeleteScripts: (ids: string[]) => Promise<void>;
}

export const AppContext = createContext<AppContextType | undefined>(undefined);
