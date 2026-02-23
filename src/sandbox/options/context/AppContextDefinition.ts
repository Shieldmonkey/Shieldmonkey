import { createContext } from 'react';
import { type Script, type Theme } from '../types';

export interface AppContextType {
    scripts: Script[];
    theme: Theme;
    extensionEnabled: boolean;
    setTheme: (theme: Theme) => void;
    toggleExtension: (enabled: boolean) => void;
    setScripts: React.Dispatch<React.SetStateAction<Script[]>>;
    reloadScripts: () => Promise<void>;
    saveScript: (script: Script) => Promise<void>;
    deleteScript: (id: string) => Promise<void>;
    toggleScript: (script: Script, enabled: boolean) => Promise<void>;
}

export const AppContext = createContext<AppContextType | undefined>(undefined);
