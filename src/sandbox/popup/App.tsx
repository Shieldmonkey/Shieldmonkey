import { useState, useEffect } from 'react';
import { Settings, FileText, Plus, Trash2, RefreshCw, Sun, Moon, Monitor, Edit } from 'lucide-react';
import './App.css';
import { parseMetadata } from '../../utils/metadataParser';
import { isScriptMatchingUrl } from '../../utils/scriptMatcher';
import { useI18n } from '../context/I18nContext';
import { isValidHttpUrl } from '../../utils/urlValidator';
import { bridge } from '../bridge/client';

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
  const { t } = useI18n();

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
      // Get settings first to apply theme immediately
      const data = await bridge.call('GET_SETTINGS');

      // Apply theme
      const storedTheme = (data.theme as Theme) || 'dark';
      setTheme(storedTheme);
      applyTheme(storedTheme);

      setExtensionEnabled(data.extensionEnabled !== false);

      // Get current tab URL
      const url = await bridge.call('GET_CURRENT_TAB_URL');

      // Only allow supported schemes (whitelist)
      if (!url || !isValidHttpUrl(url)) {
        return;
      }

      setCurrentUrl(url);

      const scripts = (data.scripts || []) as Script[];

      // Filter scripts that match current URL (regardless of enabled state, so we can toggle them)
      const matched = scripts.filter(script => {
        return isScriptMatchingUrl(script.code, url);
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
    bridge.call('UPDATE_THEME', nextTheme);
  };

  const openDashboard = (create: boolean = false) => {
    let path = '';
    if (create) {
      if (currentUrl) {
        path = `?match=${encodeURIComponent(currentUrl)}#/options/new`;
      } else {
        path = '#/options/new';
      }
    }
    bridge.call('OPEN_DASHBOARD', { path });
    // window.close() might not work in iframe, or it closes iframe? 
    // Usually popup closes when focus is lost.
  };

  const toggleGlobal = async (checked: boolean) => {
    setExtensionEnabled(checked);
    // Optimistic update
    try {
      await bridge.call('TOGGLE_GLOBAL', checked);
    } catch (e) {
      console.error("Failed to toggle global", e);
    }
  };

  const toggleScript = async (id: string, checked: boolean) => {
    setActiveScripts(prev => prev.map(s => s.id === id ? { ...s, enabled: checked } : s));
    await bridge.call('TOGGLE_SCRIPT', { scriptId: id, enabled: checked });
  };

  const deleteScript = async (id: string, name: string) => {
    if (confirm(t('confirmDeleteScript', [name]))) {
      setActiveScripts(prev => prev.filter(s => s.id !== id));
      await bridge.call('DELETE_SCRIPT', { scriptId: id });
    }
  };

  const getUpdateUrl = (script: Script) => {
    if (script.updateUrl || script.downloadUrl || script.sourceUrl) return script.updateUrl || script.downloadUrl || script.sourceUrl;
    const metadata = parseMetadata(script.code);
    return metadata.updateURL || metadata.downloadURL || metadata.installURL || metadata.source;
  };

  const checkForUpdate = (script: Script) => {
    bridge.call('START_UPDATE_FLOW', { scriptId: script.id });
  };

  const editScript = (id: string) => {
    // Open directly using the hash routing supported by Options App
    bridge.call('OPEN_DASHBOARD', { path: `#/options/scripts/${id}` });
    // window.close();
  };

  return (
    <div className="popup-container">
      <header className="popup-header">
        <div className="logo-area">
          <img src="/icons/icon48.png" alt="Logo" className="logo-img" />
          <h1>{t('appName')}</h1>
          <div className="global-switch-container">
            <ToggleSwitch checked={extensionEnabled} onChange={toggleGlobal} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button onClick={cycleTheme} className="icon-btn" title={t('themeTooltip', [theme])}>
            {theme === 'light' && <Sun size={20} />}
            {theme === 'dark' && <Moon size={20} />}
            {theme === 'system' && <Monitor size={20} />}
          </button>
          <button onClick={() => openDashboard(false)} className="icon-btn" title={t('dashboardTooltip')}>
            <Settings size={20} />
          </button>
        </div>
      </header>
      <main className="popup-main">
        {activeScripts.length > 0 ? (
          <div className="script-list">
            <h2 className="list-title">
              {t('scriptsOnThisPage')}
            </h2>
            {activeScripts.map(script => (
              <div key={script.id} className="script-item-row" style={{ opacity: extensionEnabled ? 1 : 0.6, pointerEvents: extensionEnabled ? 'auto' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', flex: 1, overflow: 'hidden' }}>
                  <ToggleSwitch checked={!!script.enabled} onChange={(c) => toggleScript(script.id, c)} />
                  <span className="script-name" style={{ marginLeft: '12px' }} title={script.name}>{script.name}</span>
                </div>
                <div className="script-actions">
                  <button className="icon-btn" title={t('editTooltip')} onClick={() => editScript(script.id)} style={{ padding: '8px' }}>
                    <Edit size={18} />
                  </button>
                  {getUpdateUrl(script) && (
                    <button className="icon-btn" title={t('checkForUpdatesTooltip')} onClick={() => checkForUpdate(script)} style={{ padding: '8px' }}>
                      <RefreshCw size={18} />
                    </button>
                  )}
                  <button className="icon-btn" title={t('deleteTooltip')} onClick={() => deleteScript(script.id, script.name)} style={{ padding: '8px', color: '#ef4444' }}>
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <FileText size={48} className="text-gray-400 mb-2" />
            <p>{t('noScriptsMatching')}</p>
            {currentUrl && <p className="text-xs text-gray-500 mt-2 truncate max-w-200">{currentUrl}</p>}
          </div>
        )
        }

        <div style={{ padding: '0 16px 16px', marginTop: 'auto' }}>
          <button className="new-script-btn" onClick={() => openDashboard(true)}>
            <Plus size={16} /> {t('createNewScript')}
          </button>
        </div>
      </main >
    </div >
  );
}

export default App;
