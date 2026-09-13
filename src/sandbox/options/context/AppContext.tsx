import React, { useState, useEffect, type ReactNode } from 'react';
import { type Script, type Theme } from '../types';
import { AppContext } from './AppContextDefinition';
import { bridge } from '../../bridge/client';
import { normalizeScript, toPersistedScript } from '../../../types/script';


export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [scripts, setScripts] = useState<Script[]>([]);
    const [theme, setTheme] = useState<Theme>('dark');
    const [extensionEnabled, setExtensionEnabled] = useState(true);
    const [loadStatus, setLoadStatus] = useState<'loading' | 'ready' | 'error'>('loading');
    const [operationError, setOperationError] = useState<string | null>(null);

    // Initial Load & Storage Sync
    useEffect(() => {
        bridge.call('GET_SETTINGS').then((data) => {
            const storedTheme = (data.theme as Theme) || 'dark';
            setTheme(storedTheme);
            if (data.extensionEnabled !== undefined) setExtensionEnabled(!!data.extensionEnabled);

            const storedScripts = data.scripts as Script[] | undefined;
            if (Array.isArray(storedScripts)) {
                const initializedScripts = storedScripts.map(s => ({
                    ...normalizeScript(s),
                    lastSavedCode: s.code,
                }));
                setScripts(initializedScripts);
            }
            setLoadStatus('ready');
        }).catch((error: Error) => {
            setOperationError(error.message);
            setLoadStatus('error');
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

    const handleToggleExtension = async (enabled: boolean) => {
        const previous = extensionEnabled;
        setExtensionEnabled(enabled);
        setOperationError(null);
        try {
            await bridge.call('TOGGLE_GLOBAL', enabled);
        } catch (error) {
            setExtensionEnabled(previous);
            setOperationError((error as Error).message);
            throw error;
        }
    };

    const reloadScripts = async () => {
        const data = await bridge.call('GET_SETTINGS');
        if (Array.isArray(data.scripts)) {
            setScripts(data.scripts.map((s: Script) => ({ ...s, lastSavedCode: s.code, enabled: s.enabled !== false })));
        }
    };

    const saveScript = async (script: Script) => {
        setOperationError(null);
        try {
            await bridge.call('SAVE_SCRIPT', toPersistedScript(script));
        } catch (error) {
            setOperationError((error as Error).message);
            throw error;
        }
    };

    const deleteScript = async (id: string) => {
        await bridge.call('DELETE_SCRIPT', { scriptId: id });
    };

    const toggleScript = async (script: Script, enabled: boolean) => {
        const previous = script.enabled !== false;
        setScripts(prev => prev.map(s => s.id === script.id ? { ...s, enabled } : s));
        setOperationError(null);
        try {
            await bridge.call('TOGGLE_SCRIPT', { scriptId: script.id, enabled });
        } catch (error) {
            setScripts(prev => prev.map(s => s.id === script.id ? { ...s, enabled: previous } : s));
            setOperationError((error as Error).message);
            throw error;
        }
    };

    const bulkSetScriptEnabled = async (ids: string[], enabled: boolean) => {
        const previous = scripts;
        const selected = new Set(ids);
        setScripts(current => current.map(script => selected.has(script.id) ? { ...script, enabled } : script));
        setOperationError(null);
        try {
            await bridge.call('BULK_SET_SCRIPT_ENABLED', { scriptIds: ids, enabled });
        } catch (error) {
            setScripts(previous);
            setOperationError((error as Error).message);
            throw error;
        }
    };

    const bulkDeleteScripts = async (ids: string[]) => {
        const previous = scripts;
        const selected = new Set(ids);
        setScripts(current => current.filter(script => !selected.has(script.id)));
        setOperationError(null);
        try {
            await bridge.call('BULK_DELETE_SCRIPTS', { scriptIds: ids });
        } catch (error) {
            setScripts(previous);
            setOperationError((error as Error).message);
            throw error;
        }
    };

    return (
        <AppContext.Provider value={{
            scripts,
            loadStatus,
            operationError,
            clearOperationError: () => setOperationError(null),
            theme,
            extensionEnabled,
            setTheme: updateTheme,
            toggleExtension: handleToggleExtension,
            setScripts,
            reloadScripts,
            saveScript,
            deleteScript,
            toggleScript,
            bulkSetScriptEnabled,
            bulkDeleteScripts
        }}>
            {children}
        </AppContext.Provider>
    );
};
