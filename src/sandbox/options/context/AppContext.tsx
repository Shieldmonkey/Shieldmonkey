import React, { useState, useEffect, type ReactNode } from 'react';
import { type Script, type Theme } from '../types';
import { AppContext } from './AppContextDefinition';
import { bridge } from '../../bridge/client';


export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [scripts, setScripts] = useState<Script[]>([]);
    const [theme, setTheme] = useState<Theme>('dark');
    const [extensionEnabled, setExtensionEnabled] = useState(true);

    // Initial Load & Storage Sync
    useEffect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        bridge.call('GET_SETTINGS').then((data: any) => {
            const storedTheme = (data.theme as Theme) || 'dark';
            setTheme(storedTheme);
            if (data.extensionEnabled !== undefined) setExtensionEnabled(!!data.extensionEnabled);

            const storedScripts = data.scripts as Script[] | undefined;
            if (Array.isArray(storedScripts)) {
                const initializedScripts = storedScripts.map(s => ({
                    ...s,
                    lastSavedCode: s.code,
                    enabled: s.enabled !== false
                }));
                setScripts(initializedScripts);
            }
        });
    }, []);

    // Listen for storage changes
    useEffect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const handleStorageChange = (changes: { [key: string]: any }, areaName: string) => {
            if (areaName === 'local') {
                if (changes.scripts && Array.isArray(changes.scripts.newValue)) {
                    setScripts(() => {
                        const newScripts = changes.scripts.newValue as Script[];
                        return newScripts.map(s => {
                            return {
                                ...s,
                                enabled: s.enabled !== false,
                                lastSavedCode: s.code
                            };
                        });
                    });
                }
                if (changes.theme) {
                    setTheme(changes.theme.newValue as Theme);
                }
                if (changes.extensionEnabled) {
                    setExtensionEnabled(!!changes.extensionEnabled.newValue);
                }
            }
        };
        const removeListener = bridge.onStorageChanged(handleStorageChange);
        return () => { removeListener(); };
    }, []);

    // Apply Theme
    useEffect(() => {
        if (theme === 'system') {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: light)');
            const handleChange = (e: MediaQueryListEvent) => {
                document.documentElement.setAttribute('data-theme', e.matches ? 'light' : 'dark');
            };
            document.documentElement.setAttribute('data-theme', mediaQuery.matches ? 'light' : 'dark');
            mediaQuery.addEventListener('change', handleChange);
            return () => mediaQuery.removeEventListener('change', handleChange);
        } else {
            document.documentElement.setAttribute('data-theme', theme);
        }
        // localStorage.setItem('theme', theme); // Not available in sandbox
    }, [theme]);

    const updateTheme = (newTheme: Theme) => {
        setTheme(newTheme);
        bridge.call('UPDATE_THEME', newTheme);
    };

    const handleToggleExtension = (enabled: boolean) => {
        setExtensionEnabled(enabled);
        bridge.call('TOGGLE_GLOBAL', enabled);
        // chrome.runtime.sendMessage({ type: MessageType.RELOAD_SCRIPTS }); // Bridge handles this? Or host handles?
        // bridge.call('RELOAD_SCRIPTS'); // If needed explicitly, but host likely handles it on storage change? 
        // Host bridge: TOGGLE_GLOBAL sets storage. Background listens to storage. 
        // Background sends RELOAD_SCRIPTS message? 
        // In original code: set storage, THEN send RELOAD_SCRIPTS.
        // So we should probably send RELOAD_SCRIPTS via bridge too.
        bridge.call('RELOAD_SCRIPTS');
    };

    const reloadScripts = async () => {
        const data = await bridge.call('GET_SETTINGS');
        if (Array.isArray(data.scripts)) {
            setScripts(data.scripts.map((s: Script) => ({ ...s, lastSavedCode: s.code, enabled: s.enabled !== false })));
        }
    };

    const saveScript = async (script: Script) => {
        await bridge.call('SAVE_SCRIPT', script);
    };

    const deleteScript = async (id: string) => {
        await bridge.call('DELETE_SCRIPT', { scriptId: id });
    };

    const toggleScript = async (script: Script, enabled: boolean) => {
        // Optimistic upate
        setScripts(prev => prev.map(s => s.id === script.id ? { ...s, enabled } : s));
        await bridge.call('TOGGLE_SCRIPT', { scriptId: script.id, enabled });
    };

    return (
        <AppContext.Provider value={{
            scripts,
            theme,
            extensionEnabled,
            setTheme: updateTheme,
            toggleExtension: handleToggleExtension,
            setScripts,
            reloadScripts,
            saveScript,
            deleteScript,
            toggleScript
        }}>
            {children}
        </AppContext.Provider>
    );
};


