import { useEffect, useState } from 'react';
import { Edit3, FileCode2, Gauge, Moon, Plus, RefreshCw, Settings, Sun, Monitor } from 'lucide-react';
import './App.css';
import { parseMetadata } from '../../utils/metadataParser';
import { isScriptMatchingUrl } from '../../utils/scriptMatcher';
import { isValidHttpUrl } from '../../utils/urlValidator';
import { useI18n } from '../context/I18nContext';
import { bridge } from '../bridge/client';
import ToggleSwitch from '../options/components/ToggleSwitch';
import type { ScriptRecord, Theme } from '../../types/script';

export default function App() {
    const [scripts, setScripts] = useState<ScriptRecord[]>([]);
    const [currentUrl, setCurrentUrl] = useState('');
    const [extensionEnabled, setExtensionEnabled] = useState(true);
    const [theme, setTheme] = useState<Theme>('dark');
    const [error, setError] = useState<string | null>(null);
    const { t } = useI18n();

    const applyTheme = (value: Theme) => {
        const resolved = value === 'system' ? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : value;
        document.documentElement.setAttribute('data-theme', resolved);
    };

    useEffect(() => {
        Promise.all([bridge.call('GET_SETTINGS'), bridge.call('GET_CURRENT_TAB_URL')]).then(([settings, url]) => {
            const nextTheme = settings.theme || 'dark';
            setTheme(nextTheme); applyTheme(nextTheme);
            setExtensionEnabled(settings.extensionEnabled !== false);
            if (url && isValidHttpUrl(url)) {
                setCurrentUrl(url);
                setScripts((settings.scripts || []).filter(script => isScriptMatchingUrl(script.code, url)));
            }
        }).catch(reason => setError((reason as Error).message));
    }, []);

    const cycleTheme = async () => {
        const themes: Theme[] = ['light', 'dark', 'system'];
        const next = themes[(themes.indexOf(theme) + 1) % themes.length];
        setTheme(next); applyTheme(next); await bridge.call('UPDATE_THEME', next);
    };
    const setGlobal = async (enabled: boolean) => {
        const previous = extensionEnabled; setExtensionEnabled(enabled); setError(null);
        try { await bridge.call('TOGGLE_GLOBAL', enabled); } catch (reason) { setExtensionEnabled(previous); setError((reason as Error).message); }
    };
    const setScript = async (id: string, enabled: boolean) => {
        const previous = scripts; setScripts(items => items.map(item => item.id === id ? { ...item, enabled } : item));
        try { await bridge.call('TOGGLE_SCRIPT', { scriptId: id, enabled }); } catch (reason) { setScripts(previous); setError((reason as Error).message); }
    };
    const host = currentUrl ? (() => { try { return new URL(currentUrl).hostname; } catch { return currentUrl; } })() : t('unsupportedPage');

    return <div className="popup-console">
        <header className="popup-console-header"><div className="popup-brand"><img src="/icons/icon48.png" alt="" /><div><strong>{t('appName')}</strong><span>Security Console</span></div></div><div className="popup-header-actions"><button onClick={cycleTheme} aria-label={t('themeTooltip', [theme])}>{theme === 'light' ? <Sun /> : theme === 'dark' ? <Moon /> : <Monitor />}</button><button onClick={() => bridge.call('OPEN_DASHBOARD', { path: '/options/scripts' })} aria-label={t('dashboardTooltip')}><Settings /></button></div></header>
        <section className={`popup-status ${extensionEnabled ? 'active' : 'paused'}`}><div><span className="status-dot" /><div><strong>{extensionEnabled ? t('globalStatusActive') : t('globalStatusPaused')}</strong><span>{extensionEnabled ? t('globalStatusDescActive') : t('globalStatusDescPaused')}</span></div></div><ToggleSwitch checked={extensionEnabled} onChange={setGlobal} ariaLabel={t('extensionLabel')} /></section>
        {error && <div className="popup-error" role="alert">{error}</div>}
        <div className="page-context"><Gauge size={15} /><span>{host}</span><strong>{scripts.length}</strong></div>
        <main className="popup-script-list">
            {scripts.length ? scripts.map(script => {
                const metadata = parseMetadata(script.code); const canUpdate = Boolean(script.sourceUrl || metadata.updateURL || metadata.downloadURL);
                return <article className="popup-script" key={script.id}><div className="popup-script-main"><ToggleSwitch checked={script.enabled !== false} onChange={enabled => setScript(script.id, enabled)} disabled={!extensionEnabled} ariaLabel={t('toggleScript', [script.name])} /><div><strong title={script.name}>{script.name}</strong><span>{metadata.namespace || `${metadata.match.length} URL`}</span></div></div><div className="popup-script-actions"><button onClick={() => bridge.call('OPEN_DASHBOARD', { path: `/options/scripts/${script.id}` })} aria-label={t('editTooltip')}><Edit3 /></button>{canUpdate && <button onClick={() => bridge.call('START_UPDATE_FLOW', { scriptId: script.id })} aria-label={t('checkForUpdatesTooltip')}><RefreshCw /></button>}</div></article>;
            }) : <div className="popup-empty"><FileCode2 /><strong>{t('noScriptsMatching')}</strong><span>{host}</span></div>}
        </main>
        <footer><button className="popup-create new-script-btn" onClick={() => bridge.call('OPEN_DASHBOARD', { path: '/options/new', query: currentUrl ? { match: currentUrl } : undefined })}><Plus />{t('createNewScript')}</button></footer>
    </div>;
}
