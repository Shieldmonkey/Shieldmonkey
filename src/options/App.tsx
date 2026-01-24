import { useState, useEffect, useCallback } from 'react';
import { Plus, Terminal, Save, Trash2, RefreshCw, Settings, Moon, Sun, Monitor, Edit, ArrowLeft, HelpCircle, FolderInput, Clock, Check, AlertCircle, RotateCcw } from 'lucide-react';
import { saveDirectoryHandle, getDirectoryHandle } from '../utils/backupStorage';
import { performBackup, performRestore } from '../utils/backupManager';
import Editor, { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import './App.css';
import { parseMetadata } from '../utils/metadataParser';
import PermissionModal from './PermissionModal';
import { configureMonaco } from './monacoConfig';

loader.config({ monaco });

import editorWorkerUrl from 'monaco-editor/esm/vs/editor/editor.worker?worker&url';
import jsonWorkerUrl from 'monaco-editor/esm/vs/language/json/json.worker?worker&url';
import cssWorkerUrl from 'monaco-editor/esm/vs/language/css/css.worker?worker&url';
import htmlWorkerUrl from 'monaco-editor/esm/vs/language/html/html.worker?worker&url';
import tsWorkerUrl from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker&url';

self.MonacoEnvironment = {
  getWorkerUrl: function (_moduleId, label) {
    if (label === 'json') {
      return chrome.runtime.getURL(jsonWorkerUrl);
    }
    if (label === 'css' || label === 'scss' || label === 'less') {
      return chrome.runtime.getURL(cssWorkerUrl);
    }
    if (label === 'html' || label === 'handlebars' || label === 'razor') {
      return chrome.runtime.getURL(htmlWorkerUrl);
    }
    if (label === 'typescript' || label === 'javascript') {
      return chrome.runtime.getURL(tsWorkerUrl);
    }
    return chrome.runtime.getURL(editorWorkerUrl);
  }
};

interface Script {
  id: string;
  name: string;
  code: string;
  enabled?: boolean;
  lastSavedCode?: string;
  grantedPermissions?: string[];
  updateUrl?: string;
  downloadUrl?: string;
  sourceUrl?: string;
  namespace?: string;
  installDate?: number;
}

type Theme = 'light' | 'dark' | 'system';
type Page = 'scripts' | 'settings' | 'help';

const ToggleSwitch = ({ checked, onChange, disabled }: { checked: boolean, onChange: (checked: boolean) => void, disabled?: boolean }) => (
  <label className={`switch ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
    <input type="checkbox" checked={checked} onChange={(e) => !disabled && onChange(e.target.checked)} disabled={disabled} />
    <span className="slider"></span>
  </label>
);

function App() {
  const [activePage, setActivePage] = useState<Page>('scripts');
  const [selectedScriptId, setSelectedScriptId] = useState<string | null>(null);
  const [scripts, setScripts] = useState<Script[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('theme') as Theme) || 'dark');
  const version = chrome.runtime.getManifest().version;

  // Permission Modal State
  const [permissionModalOpen, setPermissionModalOpen] = useState(false);
  const [permissionScript, setPermissionScript] = useState<Script | null>(null);
  const [requestedPermissions, setRequestedPermissions] = useState<string[]>([]);
  const [pendingSaveResolved, setPendingSaveResolved] = useState<((allowed: boolean) => void) | null>(null);

  // Backup State
  const [backupDirName, setBackupDirName] = useState<string | null>(null);
  const [lastBackupTime, setLastBackupTime] = useState<string | null>(null);
  const [isBackupLoading, setIsBackupLoading] = useState(false);
  const [backupStatus, setBackupStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [backupMessage, setBackupMessage] = useState<string>('');

  useEffect(() => {
    getDirectoryHandle().then(async (handle) => {
      if (handle) {
        setBackupDirName(handle.name);
      }
    });

    chrome.storage.local.get(['lastBackupTime'], (res) => {
      if (res.lastBackupTime) {
        setLastBackupTime(res.lastBackupTime as string);
      }
    });
  }, []);

  // Router Logic
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1); // Remove #
      const parts = hash.split('/');

      const page = parts[0] as Page;
      const id = parts[1];

      if (['scripts', 'help', 'settings'].includes(page || 'scripts')) {
        setActivePage((page || 'scripts') as Page);
      } else {
        setActivePage('scripts');
      }

      if (page === 'scripts' && id) {
        setSelectedScriptId(id);
      } else {
        setSelectedScriptId(null);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    // Initial check
    handleHashChange();

    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigateTo = (page: Page, id?: string) => {
    let hash = `#${page}`;
    if (id) hash += `/${id}`;
    window.location.hash = hash;
  };

  useEffect(() => {
    // Load scripts and theme from storage on mount
    chrome.storage.local.get(['scripts', 'theme'], (data) => {
      // Theme logic
      const storedTheme = (data.theme as Theme) || 'dark';
      setTheme(storedTheme);
      localStorage.setItem('theme', storedTheme);

      const storedScripts = data.scripts as Script[] | undefined;
      let initializedScripts: Script[] = [];

      if (Array.isArray(storedScripts)) {
        // Initialize lastSavedCode & ensure enabled is boolean
        initializedScripts = storedScripts.map(s => ({
          ...s,
          lastSavedCode: s.code,
          enabled: s.enabled !== false // Default to true if undefined
        }));
      }

      const hash = window.location.hash;
      // Legacy 'new' check - if present in search or hash logic we didn't fully migrate. 
      // But now we rely on explicit navigation. 
      // However, if opened with explicit intent via URL query params for new script:
      if (hash === '#new' || hash === '#scripts/new') {
        // Create logic handled below via a dedicated function call if triggered by UI, 
        // but if opened externally, we might want to auto-create.
        // Let's stick to the previous implementation for #new, but redirect to unique ID.
        // ... creation logic duplicated?
      }

      setScripts(initializedScripts);
    });

    // Configure Monaco
    const disposable = configureMonaco(monaco);
    return () => disposable.dispose();
  }, []);

  // Listen for storage changes (external updates)
  useEffect(() => {
    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
      if (areaName === 'local') {
        if (changes.scripts) {
          const newScripts = changes.scripts.newValue as Script[];
          if (Array.isArray(newScripts)) {
            setScripts(prev => {
              return newScripts.map(s => {
                const existing = prev.find(p => p.id === s.id);
                const isEditing = existing && existing.id === selectedScriptId;
                const isDirty = existing && existing.code !== existing.lastSavedCode;

                return {
                  ...s,
                  enabled: s.enabled !== false,
                  lastSavedCode: s.code,
                  code: (isEditing && isDirty) ? existing.code : s.code,
                  grantedPermissions: s.grantedPermissions || []
                };
              });
            });
          }
        }
        if (changes.theme) {
          setTheme(changes.theme.newValue as Theme);
        }
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, [selectedScriptId]);

  // Theme application effect
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
  }, [theme]);

  const activeScript = scripts.find(s => s.id === selectedScriptId);
  const isDirty = activeScript ? activeScript.code !== activeScript.lastSavedCode : false;

  const handleEditorChange = (value: string | undefined) => {
    if (activeScript && value !== undefined) {
      const metadata = parseMetadata(value);
      const newName = metadata.name || activeScript.name;

      const updatedScripts = scripts.map(s =>
        s.id === activeScript.id ? { ...s, code: value, name: newName } : s
      );
      setScripts(updatedScripts);
    }
  };

  const changeTheme = (newTheme: Theme) => {
    setTheme(newTheme);
    chrome.storage.local.set({ theme: newTheme });
    localStorage.setItem('theme', newTheme);
  };

  const handleNewScript = () => {
    const newScriptId = crypto.randomUUID();
    const newScript: Script = {
      id: newScriptId,
      name: 'New Script',
      code: `// ==UserScript==
// @name        New Script
// @match       <all_urls>
// ==/UserScript==

`,
      enabled: true,
      lastSavedCode: `// ==UserScript==
// @name        New Script
// @match       <all_urls>
// ==/UserScript==

`,
      grantedPermissions: [],
      installDate: Date.now()
    };
    setScripts([...scripts, newScript]);
    navigateTo('scripts', newScriptId);
  };

  const checkForUpdate = (script: Script) => {
    const url = script.updateUrl || script.downloadUrl || script.sourceUrl;
    if (url) {
      // Use START_INSTALL_FLOW to safely fetch script content via loader page,
      // preventing browser download prompts.
      chrome.runtime.sendMessage({ type: 'START_INSTALL_FLOW', url });
    }
  };

  const toggleScript = async (script: Script, currentState: boolean) => {
    const newState = !currentState;
    const updatedScripts = scripts.map(s =>
      s.id === script.id ? { ...s, enabled: newState } : s
    );
    setScripts(updatedScripts);

    // Notify background
    chrome.runtime.sendMessage({
      type: 'TOGGLE_SCRIPT',
      scriptId: script.id,
      enabled: newState
    });
  };

  const deleteScript = async (id: string) => {
    if (!confirm("Are you sure you want to delete this script?")) return;

    try {
      await chrome.runtime.sendMessage({
        type: 'DELETE_SCRIPT',
        scriptId: id
      });
      const newScripts = scripts.filter(s => s.id !== id);
      setScripts(newScripts);
      if (selectedScriptId === id) {
        navigateTo('scripts');
      }
    } catch (e) {
      console.error("Failed to delete", e);
    }
  };

  const saveScript = useCallback(async () => {
    if (!activeScript) return;
    setIsSaving(true);
    try {
      const metadata = parseMetadata(activeScript.code);
      const requested = metadata.grant || [];
      const needed = requested.filter(p => p !== 'none');

      const currentGranted = new Set(activeScript.grantedPermissions || []);
      const newPermissions = needed.filter(p => !currentGranted.has(p));

      if (newPermissions.length > 0) {
        const allowed = await new Promise<boolean>((resolve) => {
          setPermissionScript(activeScript);
          setRequestedPermissions(newPermissions);
          setPendingSaveResolved(() => resolve);
          setPermissionModalOpen(true);
        });

        if (!allowed) {
          setIsSaving(false);
          return;
        }
        activeScript.grantedPermissions = Array.from(new Set([...(activeScript.grantedPermissions || []), ...newPermissions]));
      }

      const response = await chrome.runtime.sendMessage({
        type: 'SAVE_SCRIPT',
        script: activeScript
      });
      if (response && !response.success) {
        throw new Error(response.error || "Unknown error");
      }

      const updatedScripts = scripts.map(s =>
        s.id === activeScript.id ? { ...s, lastSavedCode: s.code, grantedPermissions: activeScript.grantedPermissions } : s
      );
      setScripts(updatedScripts);
    } catch (e) {
      console.error("Failed to save", e);
      alert("Failed to save script: " + (e as Error).message);
    } finally {
      setIsSaving(false);
    }
  }, [activeScript, scripts]);

  const handlePermissionConfirm = () => {
    setPermissionModalOpen(false);
    if (pendingSaveResolved) pendingSaveResolved(true);
    setPendingSaveResolved(null);
  };

  const handlePermissionCancel = () => {
    setPermissionModalOpen(false);
    if (pendingSaveResolved) pendingSaveResolved(false);
    setPendingSaveResolved(null);
  };
  const handleSelectBackupDir = async () => {
    try {
      setBackupStatus('idle');
      setBackupMessage('');
      setIsBackupLoading(true);
      const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
      await saveDirectoryHandle(handle);
      setBackupDirName(handle.name);

      // Perform initial backup
      await performBackup(handle);
      const time = new Date().toISOString();
      setLastBackupTime(time);
      chrome.storage.local.set({ lastBackupTime: time });
      setBackupStatus('success');
      setBackupStatus('success');

    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        console.error("Backup setup failed", e);
        setBackupStatus('error');
        setBackupMessage((e as Error).message);
        // alert("Failed to select directory: " + (e as Error).message);
      }
    } finally {
      setIsBackupLoading(false);
    }
  };

  const handleManualBackup = async () => {
    try {
      setBackupStatus('idle');
      setBackupMessage('');
      setIsBackupLoading(true);
      const count = await performBackup();
      const time = new Date().toISOString();
      setLastBackupTime(time);
      chrome.storage.local.set({ lastBackupTime: time });
      // alert(`Backup successful! Saved ${count} scripts.`);
      setBackupStatus('success');
      setBackupMessage(`Saved ${count} scripts`);

    } catch (e) {
      console.error("Backup failed", e);
      setBackupStatus('error');
      setBackupMessage((e as Error).message);
      // alert("Backup failed: " + (e as Error).message);
    } finally {
      setIsBackupLoading(false);
    }
  };

  const handleManualRestore = async () => {
    if (!confirm("Are you sure you want to restore from backup? This will merge/update existing scripts with the backup data.")) {
      return;
    }
    try {
      setBackupStatus('idle');
      setBackupMessage('');
      setIsBackupLoading(true);

      const count = await performRestore();

      // Notify background to reload all scripts
      await chrome.runtime.sendMessage({ type: 'RELOAD_SCRIPTS' });

      // Reload scripts in UI
      chrome.storage.local.get(['scripts'], (result) => {
        setScripts((result.scripts as Script[]) || []);
      });

      setBackupStatus('success');
      setBackupMessage(`Restored ${count} scripts`);
    } catch (e) {
      console.error("Restore failed", e);
      setBackupStatus('error');
      setBackupMessage((e as Error).message);
    } finally {
      setIsBackupLoading(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        saveScript();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeScript, isSaving, scripts, saveScript]);

  // Render Logic
  const renderSidebar = () => (
    <aside className="sidebar">
      <div className="sidebar-header">
        <img src="/icons/icon48.png" className="logo-img" alt="Shieldmonkey" />
        <h2>Shieldmonkey</h2>
      </div>
      <nav className="nav-links">
        <button
          className={`nav-item ${activePage === 'scripts' ? 'active' : ''}`}
          onClick={() => navigateTo('scripts')}
        >
          <Terminal size={18} />
          <span>Scripts</span>
        </button>
        <button
          className={`nav-item ${activePage === 'settings' ? 'active' : ''}`}
          onClick={() => navigateTo('settings')}
        >
          <Settings size={18} />
          <span>Settings</span>
        </button>
        <button
          className={`nav-item ${activePage === 'help' ? 'active' : ''}`}
          onClick={() => navigateTo('help')}
        >
          <HelpCircle size={18} />
          <span>Help</span>
        </button>
      </nav>
      <div style={{ marginTop: 'auto', padding: '16px', color: 'var(--text-secondary)', fontSize: '0.8rem', textAlign: 'center' }}>
        v{version}
      </div>
    </aside>
  );

  const renderScriptTable = () => (
    <div className="content-scroll">
      <div className="script-table-container">
        <div className="page-header">
          <h2 className="page-title">My Scripts ({scripts.length})</h2>
          <button className="btn-primary" onClick={handleNewScript}>
            <Plus size={16} />
            <span>New Script</span>
          </button>
        </div>

        {scripts.length === 0 ? (
          <div className="empty-dashboard">
            <div className="empty-icon-wrapper">
              <Terminal size={48} />
            </div>
            <h3>No scripts found</h3>
            <p>Create a new script to get started.</p>
          </div>
        ) : (
          <table className="script-table compact">
            <thead>
              <tr>
                <th style={{ width: '60px' }}>Enabled</th>
                <th>Name / Namespace</th>
                <th>Version</th>
                <th>Source</th>
                <th>Installed</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {scripts.map(script => {
                const metadata = parseMetadata(script.code);
                const sourceUrl = script.updateUrl || script.downloadUrl || script.sourceUrl;

                return (
                  <tr key={script.id}>
                    <td>
                      <ToggleSwitch
                        checked={!!script.enabled}
                        onChange={() => toggleScript(script, !!script.enabled)}
                      />
                    </td>
                    <td style={{ fontWeight: 500 }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '0.95rem' }}>{script.name}</span>
                        {metadata.namespace && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }} className='truncate'>
                            {metadata.namespace}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      {metadata.version ? (
                        <span className="script-version">v{metadata.version}</span>
                      ) : (
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>-</span>
                      )}
                    </td>
                    <td>
                      {sourceUrl ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {/* Use a simple link logic */}
                          <a href={sourceUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.85rem', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--accent-color)', textDecoration: 'none' }} title={sourceUrl}>
                            {(() => { try { return new URL(sourceUrl).hostname; } catch { return 'Link'; } })()}
                          </a>
                          <button className="action-btn" title="Check for updates" onClick={(e) => { e.stopPropagation(); checkForUpdate(script); }} style={{ padding: 2 }}>
                            <RefreshCw size={14} />
                          </button>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>-</span>
                      )}
                    </td>
                    <td>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        {script.installDate ? new Date(script.installDate).toLocaleDateString() : '-'}
                      </span>
                    </td>
                    <td className="col-actions">
                      <button className="action-btn" title="Edit" onClick={() => navigateTo('scripts', script.id)}>
                        <Edit size={16} />
                      </button>
                      <button className="action-btn delete" title="Delete" onClick={() => deleteScript(script.id)}>
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );

  const renderScriptEditor = () => {
    if (!activeScript) return <div>Script not found</div>;
    return (
      <div className="editor-container">
        <header className="editor-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button className="btn-secondary" onClick={() => navigateTo('scripts')} title="Back to list" style={{ padding: '8px' }}>
              <ArrowLeft size={16} />
            </button>
            <h2 className="editor-title">{activeScript.name}</h2>
            {/* Optional: Add status dot if dirty */}
            {isDirty && <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#fbbf24', marginLeft: 8 }} title="Unsaved changes" />}
          </div>
          <div className="editor-actions">
            <button className="btn-secondary" onClick={() => deleteScript(activeScript.id)} title="Delete Script">
              <Trash2 size={16} />
            </button>
            <button className="btn-primary" onClick={saveScript} disabled={isSaving || !isDirty}>
              <Save size={16} /> {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </header>
        <div className="monaco-wrapper">
          <Editor
            height="100%"
            defaultLanguage="javascript"
            theme={theme === 'light' ? 'light' : 'vs-dark'}
            value={activeScript.code}
            onChange={handleEditorChange}
            options={{
              minimap: { enabled: false },
              fontSize: 12,
              padding: { top: 16 },
              quickSuggestions: { other: true, comments: true, strings: true },
              tabCompletion: 'on'
            }}
          />
        </div>
      </div>
    );
  };

  const renderSettings = () => {
    return (
      <div className="content-scroll">
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <h2 className="page-title" style={{ marginBottom: '24px' }}>Settings</h2>

          <div style={{ background: 'var(--surface-bg)', borderRadius: '12px', padding: '24px', border: '1px solid var(--border-color)' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '16px', fontWeight: 500 }}>Appearance</h3>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => changeTheme('light')}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '16px',
                  background: theme === 'light' ? 'var(--accent-color)' : 'var(--bg-color)',
                  border: '1px solid var(--border-color)',
                  color: theme === 'light' ? 'white' : 'var(--text-secondary)',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
              >
                <Sun size={24} />
                <span>Light</span>
              </button>
              <button
                onClick={() => changeTheme('dark')}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '16px',
                  background: theme === 'dark' ? 'var(--accent-color)' : 'var(--bg-color)',
                  border: '1px solid var(--border-color)',
                  color: theme === 'dark' ? 'white' : 'var(--text-secondary)',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
              >
                <Moon size={24} />
                <span>Dark</span>
              </button>
              <button
                onClick={() => changeTheme('system')}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '16px',
                  background: theme === 'system' ? 'var(--accent-color)' : 'var(--bg-color)',
                  border: '1px solid var(--border-color)',
                  color: theme === 'system' ? 'white' : 'var(--text-secondary)',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
              >
                <Monitor size={24} />
                <span>System</span>
              </button>
            </div>
          </div>

          <div style={{ background: 'var(--surface-bg)', borderRadius: '12px', padding: '24px', border: '1px solid var(--border-color)', marginTop: '24px' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '16px', fontWeight: 500 }}>Backup</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '16px' }}>
              Select a directory to automatically backup your scripts.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button
                  className="btn-secondary"
                  onClick={handleSelectBackupDir}
                  disabled={isBackupLoading}
                  style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <FolderInput size={18} />
                  <span>{backupDirName ? 'Change Directory' : 'Select Directory'}</span>
                </button>
                {backupDirName && (
                  <span style={{ fontSize: '0.9rem', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                    Selected: {backupDirName}
                  </span>
                )}
              </div>

              {backupDirName && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px' }}>
                  <button
                    className="btn-primary"
                    onClick={handleManualBackup}
                    disabled={isBackupLoading}
                    style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '8px' }}
                  >
                    <Save size={18} />
                    <span>{isBackupLoading ? 'Working...' : 'Backup'}</span>
                  </button>

                  <button
                    className="btn-secondary"
                    onClick={handleManualRestore}
                    disabled={isBackupLoading}
                    style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '8px' }}
                  >
                    <RotateCcw size={18} />
                    <span>Restore</span>
                  </button>

                  {backupStatus === 'success' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#10b981', fontSize: '0.9rem' }}>
                      <Check size={18} />
                      <span>Done{backupMessage ? `: ${backupMessage}` : ''}</span>
                    </div>
                  )}

                  {backupStatus === 'error' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#ef4444', fontSize: '0.9rem' }}>
                      <AlertCircle size={18} />
                      <span>Error{backupMessage ? `: ${backupMessage}` : ''}</span>
                    </div>
                  )}

                  {lastBackupTime && backupStatus !== 'success' && backupStatus !== 'error' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                      <Clock size={14} />
                      <span>Last: {new Date(lastBackupTime).toLocaleString()}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderHelp = () => {
    return (
      <div className="content-scroll">
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <h2 className="page-title" style={{ marginBottom: '20px' }}>Help & Support</h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
            <div style={{ background: 'var(--surface-bg)', borderRadius: '12px', padding: '20px', border: '1px solid var(--border-color)' }}>
              <h3 style={{ fontSize: '1rem', marginBottom: '12px', fontWeight: 500 }}>Links</h3>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <li>
                  <a href="https://github.com/toshs/Shieldmonkey" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-color)', textDecoration: 'none', fontSize: '0.95rem' }}>
                    <span>GitHub Repository</span>
                  </a>
                  <p style={{ margin: '2px 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>View source code & docs.</p>
                </li>
              </ul>
            </div>

            <div style={{ background: 'var(--surface-bg)', borderRadius: '12px', padding: '20px', border: '1px solid var(--border-color)' }}>
              <h3 style={{ fontSize: '1rem', marginBottom: '12px', fontWeight: 500 }}>Issues</h3>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <li>
                  <a href="https://github.com/toshs/Shieldmonkey/issues" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-color)', textDecoration: 'none', fontWeight: 500, fontSize: '0.95rem' }}>
                    Report a Bug
                  </a>
                  <p style={{ margin: '2px 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Found a problem? Let us know.
                  </p>
                </li>
                <li>
                  <a href="https://github.com/toshs/Shieldmonkey/security/advisories" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-color)', textDecoration: 'none', fontWeight: 500, fontSize: '0.95rem' }}>
                    Report Vulnerability
                  </a>
                </li>
              </ul>
            </div>

            <div style={{ background: 'var(--surface-bg)', borderRadius: '12px', padding: '20px', border: '1px solid var(--border-color)', gridColumn: '1 / -1' }}>
              <h3 style={{ fontSize: '1rem', marginBottom: '12px', fontWeight: 500 }}>About</h3>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.5, fontSize: '0.9rem', margin: 0 }}>
                Shieldmonkey is a modern userscript manager for Chrome. <span style={{ opacity: 0.7 }}>v{version}</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="dashboard-container">
      {renderSidebar()}

      <main className="content-area">
        {activePage === 'scripts' && !selectedScriptId && renderScriptTable()}
        {activePage === 'scripts' && selectedScriptId && renderScriptEditor()}
        {activePage === 'settings' && renderSettings()}
        {activePage === 'help' && renderHelp()}
      </main>

      {permissionModalOpen && permissionScript && (
        <PermissionModal
          isOpen={permissionModalOpen}
          scriptName={permissionScript.name}
          permissions={requestedPermissions}
          onConfirm={handlePermissionConfirm}
          onCancel={handlePermissionCancel}
        />
      )}
    </div>
  );
}

export default App;
