import { useState, useEffect } from 'react';
import { Settings, FileText, Plus, Trash2, RefreshCw, Sun, Moon, Monitor } from 'lucide-react';
import './App.css';
import { parseMetadata } from '../utils/metadataParser';
import { matchPattern } from '../utils/urlMatcher';

interface Script {
  id: string;
  name: string;
  code: string;
  enabled?: boolean;
  updateUrl?: string;
  downloadUrl?: string;
  sourceUrl?: string;
}

type Theme = 'light' | 'dark' | 'system';

const ToggleSwitch = ({ checked, onChange, disabled }: { checked: boolean, onChange: (checked: boolean) => void, disabled?: boolean }) => (
  <label className={`switch ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
    <input type="checkbox" checked={checked} onChange={(e) => !disabled && onChange(e.target.checked)} disabled={disabled} />
    <span className="slider"></span>
  </label>
);

function App() {
  const [activeScripts, setActiveScripts] = useState<Script[]>([]);
  const [currentUrl, setCurrentUrl] = useState<string>('');
  const [extensionEnabled, setExtensionEnabled] = useState(true);
  const [theme, setTheme] = useState<Theme>('dark');

  const applyTheme = (newTheme: Theme) => {
    if (newTheme === 'system') {
      const isLight = window.matchMedia('(prefers-color-scheme: light)').matches;
      document.documentElement.setAttribute('data-theme', isLight ? 'light' : 'dark');
    } else {
      document.documentElement.setAttribute('data-theme', newTheme);
    }
  };

  useEffect(() => {
    const init = async () => {
      // Get current tab URL
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.url) return;

      setCurrentUrl(tab.url);

      // Get settings and scripts
      const data = await chrome.storage.local.get(['scripts', 'extensionEnabled', 'theme']);
      setExtensionEnabled(data.extensionEnabled !== false);

      // Apply theme
      const storedTheme = (data.theme as Theme) || 'dark';
      setTheme(storedTheme);
      applyTheme(storedTheme);

      const scripts = (data.scripts || []) as Script[];

      // Filter scripts that match current URL (regardless of enabled state, so we can toggle them)
      const matched = scripts.filter(script => {
        const metadata = parseMetadata(script.code);
        const patterns = [...metadata.match, ...metadata.include];
        const effectivePatterns = patterns.length > 0 ? patterns : ["<all_urls>"];
        return effectivePatterns.some(pattern => matchPattern(pattern, tab.url!));
      });

      setActiveScripts(matched);
    };

    init();
  }, []);

  const cycleTheme = () => {
    const modes: Theme[] = ['light', 'dark', 'system'];
    const nextIndex = (modes.indexOf(theme) + 1) % modes.length;
    const nextTheme = modes[nextIndex];
    setTheme(nextTheme);
    applyTheme(nextTheme);
    chrome.storage.local.set({ theme: nextTheme });
  };

  const openDashboard = (create: boolean = false) => {
    if (create) {
      let url = 'src/options/index.html';
      if (currentUrl) {
        url += `?match=${encodeURIComponent(currentUrl)}`;
      }
      url += '#new';
      chrome.tabs.create({ url: chrome.runtime.getURL(url) });
    } else {
      chrome.runtime.openOptionsPage();
    }
  };

  const toggleGlobal = async (checked: boolean) => {
    setExtensionEnabled(checked);
    // Optimistic update, but we should ensure background gets it
    try {
      await chrome.runtime.sendMessage({ type: 'TOGGLE_GLOBAL', enabled: checked });
    } catch (e) {
      console.error("Failed to toggle global", e);
      // Revert on failure?
      // setExtensionEnabled(!checked);
    }
  };

  const toggleScript = async (id: string, checked: boolean) => {
    setActiveScripts(prev => prev.map(s => s.id === id ? { ...s, enabled: checked } : s));
    await chrome.runtime.sendMessage({ type: 'TOGGLE_SCRIPT', scriptId: id, enabled: checked });
  };

  const deleteScript = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete script "${name}"?`)) {
      setActiveScripts(prev => prev.filter(s => s.id !== id));
      await chrome.runtime.sendMessage({ type: 'DELETE_SCRIPT', scriptId: id });
    }
  };

  const getUpdateUrl = (script: Script) => {
    if (script.updateUrl || script.downloadUrl || script.sourceUrl) return script.updateUrl || script.downloadUrl || script.sourceUrl;
    const metadata = parseMetadata(script.code);
    return metadata.updateURL || metadata.downloadURL || metadata.installURL || metadata.source;
  };

  const checkForUpdate = (script: Script) => {
    const url = getUpdateUrl(script);
    if (url) {
      const installUrl = chrome.runtime.getURL('src/install/index.html') + `?url=${encodeURIComponent(url)}`;
      chrome.tabs.create({ url: installUrl });
    } else {
      alert('No update URL found for this script.');
    }
  };

  return (
    <div className="popup-container">
      <header className="popup-header">
        <div className="logo-area">
          <img src="/icons/icon48.png" alt="Logo" className="logo-img" />
          <h1>StickyMonkey</h1>
        </div>
        <div className="global-switch-container">
          <ToggleSwitch checked={extensionEnabled} onChange={toggleGlobal} />
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button onClick={cycleTheme} className="icon-btn" title={`Theme: ${theme}`}>
            {theme === 'light' && <Sun size={20} />}
            {theme === 'dark' && <Moon size={20} />}
            {theme === 'system' && <Monitor size={20} />}
          </button>
          <button onClick={() => openDashboard(false)} className="icon-btn" title="Dashboard">
            <Settings size={20} />
          </button>
        </div>
      </header>
      <main className="popup-main">
        {activeScripts.length > 0 ? (
          <div className="script-list">
            <h2 className="list-title">
              Scripts on this page
            </h2>
            {activeScripts.map(script => (
              <div key={script.id} className="script-item-row" style={{ opacity: extensionEnabled ? 1 : 0.6, pointerEvents: extensionEnabled ? 'auto' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', flex: 1, overflow: 'hidden' }}>
                  <ToggleSwitch checked={!!script.enabled} onChange={(c) => toggleScript(script.id, c)} />
                  <span className="script-name" style={{ marginLeft: '12px' }} title={script.name}>{script.name}</span>
                </div>
                <div className="script-actions">
                  {getUpdateUrl(script) && (
                    <button className="icon-btn" title="Check for updates" onClick={() => checkForUpdate(script)} style={{ padding: '4px' }}>
                      <RefreshCw size={14} />
                    </button>
                  )}
                  <button className="icon-btn" title="Delete" onClick={() => deleteScript(script.id, script.name)} style={{ padding: '4px', color: '#ef4444' }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <FileText size={48} className="text-gray-400 mb-2" />
            <p>No scripts matching this page.</p>
            {currentUrl && <p className="text-xs text-gray-500 mt-2 truncate max-w-200">{currentUrl}</p>}
          </div>
        )}

        <div style={{ padding: '0 16px 16px', marginTop: 'auto' }}>
          <button className="new-script-btn" onClick={() => openDashboard(true)}>
            <Plus size={16} /> Create New Script
          </button>
        </div>
      </main>
    </div>
  );
}

export default App;
