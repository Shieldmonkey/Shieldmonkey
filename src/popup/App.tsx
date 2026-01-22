import { useState, useEffect } from 'react';
import { Settings, FileText, CheckCircle2 } from 'lucide-react';
import './App.css';
import { parseMetadata } from '../utils/metadataParser';
import { matchPattern } from '../utils/urlMatcher';

interface Script {
  id: string;
  name: string;
  code: string;
  enabled?: boolean;
}

function App() {
  const [activeScripts, setActiveScripts] = useState<Script[]>([]);
  const [currentUrl, setCurrentUrl] = useState<string>('');

  useEffect(() => {
    const init = async () => {
      // Get current tab URL
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.url) return;

      setCurrentUrl(tab.url);

      // Get all scripts
      const data = await chrome.storage.local.get('scripts');
      const scripts = (data.scripts || []) as Script[];

      // Filter scripts that match current URL and are enabled
      const matched = scripts.filter(script => {
        if (!script.enabled) return false;

        const metadata = parseMetadata(script.code);
        const patterns = [...metadata.match, ...metadata.include];

        // If no matches defined, default to <all_urls> or none? 
        // MetadataParser defaults are empty.
        // Usually @match is required. If empty, maybe assume no match? 
        // But in background/index.ts it defaults to <all_urls> if empty matches?
        // Let's check background logic: 
        // matches: matches.length > 0 ? matches : ["<all_urls>"]

        const effectivePatterns = patterns.length > 0 ? patterns : ["<all_urls>"];

        return effectivePatterns.some(pattern => matchPattern(pattern, tab.url!));
      });

      setActiveScripts(matched);
    };

    init();
  }, []);

  const openDashboard = () => {
    chrome.runtime.openOptionsPage();
  };

  return (
    <div className="popup-container">
      <header className="popup-header">
        <div className="logo-area">
          <img src="/icons/icon48.png" alt="Logo" className="logo-img" />
          <h1>StickyMonkey</h1>
        </div>
        <button onClick={openDashboard} className="icon-btn" title="Dashboard">
          <Settings size={20} />
        </button>
      </header>
      <main className="popup-main">
        {activeScripts.length > 0 ? (
          <div className="script-list">
            <h2 className="list-title">
              Running on this page
            </h2>
            {activeScripts.map(script => (
              <div key={script.id} className="script-item-row">
                <CheckCircle2 size={16} className="script-item-icon" />
                <span className="script-name">{script.name}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <FileText size={48} className="text-gray-400 mb-2" />
            <p>No scripts running on this page.</p>
            {currentUrl && <p className="text-xs text-gray-500 mt-2 truncate max-w-200">{currentUrl}</p>}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
