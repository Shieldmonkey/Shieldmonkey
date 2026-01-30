import React, { useState, useEffect, type ReactNode } from 'react';
import { type Script, type Theme } from '../types';
import { AppContext } from './AppContextDefinition';
import { MessageType } from '../../types/messages';


export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [scripts, setScripts] = useState<Script[]>([]);
    const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('theme') as Theme) || 'dark');
    const [extensionEnabled, setExtensionEnabled] = useState(true);

    // Initial Load & Storage Sync
    useEffect(() => {
        chrome.storage.local.get(['scripts', 'theme', 'extensionEnabled'], (data) => {
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
        const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
            if (areaName === 'local') {
                if (changes.scripts && Array.isArray(changes.scripts.newValue)) {
                    // Merging logic might be needed if we are editing, 
                    // but for now simple replacement or smart merge if specific IDs changed?
                    // The App.tsx logic was smart about not overwriting dirty edits active in editor.
                    // This is tricky for global context. 
                    // Let's assume the Editor page manages "local dirty state" and global state is "saved state".
                    // But if updated externally, we might want to know.
                    // For now, simple set.
                    // Warning: This could overwrite local unsaved changes if we are not careful?
                    // The Editor component should probably track its own "draft" code distinct from the context "scripts".
                    setScripts(() => {
                        const newScripts = changes.scripts.newValue as Script[];
                        return newScripts.map(s => {
                            // Preserve lastSavedCode if we had it, or reset it?
                            // Actually, storage change means saved data changed.
                            return {
                                ...s,
                                enabled: s.enabled !== false,
                                lastSavedCode: s.code // It matches what is in storage
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
        chrome.storage.onChanged.addListener(handleStorageChange);
        return () => chrome.storage.onChanged.removeListener(handleStorageChange);
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
        localStorage.setItem('theme', theme);
    }, [theme]);

    const updateTheme = (newTheme: Theme) => {
        setTheme(newTheme);
        chrome.storage.local.set({ theme: newTheme });
    };

    const handleToggleExtension = (enabled: boolean) => {
        setExtensionEnabled(enabled);
        chrome.storage.local.set({ extensionEnabled: enabled });
        chrome.runtime.sendMessage({ type: MessageType.RELOAD_SCRIPTS });
    };

    const reloadScripts = async () => {
        const data = await chrome.storage.local.get('scripts');
        if (Array.isArray(data.scripts)) {
            setScripts(data.scripts.map((s: Script) => ({ ...s, lastSavedCode: s.code, enabled: s.enabled !== false })));
        }
    };

    const saveScript = async (script: Script) => {
        // Send to background to save (which handles parsing, validation, registration)
        await chrome.runtime.sendMessage({
            type: MessageType.SAVE_SCRIPT,
            script
        });
        // Optimistic update handled by onStorageChanged theoretically, but we can also update locally?
        // Let's rely on storage change to keep singular source of truth? 
        // Or update immediately.
    };

    const deleteScript = async (id: string) => {
        await chrome.runtime.sendMessage({
            type: MessageType.DELETE_SCRIPT,
            scriptId: id
        });
    };

    const toggleScript = async (script: Script, enabled: boolean) => {
        // Optimistic upate
        setScripts(prev => prev.map(s => s.id === script.id ? { ...s, enabled } : s));
        await chrome.runtime.sendMessage({
            type: MessageType.TOGGLE_SCRIPT,
            scriptId: script.id,
            enabled
        });
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


