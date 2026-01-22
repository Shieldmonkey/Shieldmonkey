import { useState, useEffect } from 'react';
import { Plus, Search, Terminal, Save, Trash2 } from 'lucide-react';
import Editor, { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import './App.css';
import { parseMetadata } from '../utils/metadataParser';

loader.config({ monaco });

import editorWorkerUrl from 'monaco-editor/esm/vs/editor/editor.worker?worker&url';
import jsonWorkerUrl from 'monaco-editor/esm/vs/language/json/json.worker?worker&url';
import cssWorkerUrl from 'monaco-editor/esm/vs/language/css/css.worker?worker&url';
import htmlWorkerUrl from 'monaco-editor/esm/vs/language/html/html.worker?worker&url';
import tsWorkerUrl from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker&url';

self.MonacoEnvironment = {
  getWorkerUrl: function (_moduleId, label) {
    // chrome.runtime.getURL で拡張機能内の完全なパスに変換します
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
    // デフォルト
    return chrome.runtime.getURL(editorWorkerUrl);
  }
};

interface Script {
  id: string;
  name: string;
  code: string;
  enabled?: boolean;
  lastSavedCode?: string;
}

function App() {
  const [activeTab, setActiveTab] = useState<'scripts' | 'discover'>('scripts');
  const [selectedScriptId, setSelectedScriptId] = useState<string | null>(null);
  const [scripts, setScripts] = useState<Script[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    // Load scripts from storage on mount
    chrome.storage.local.get('scripts', (data) => {
      const storedScripts = data.scripts as Script[] | undefined;
      if (Array.isArray(storedScripts)) {
        // Initialize lastSavedCode
        const initializedScripts = storedScripts.map(s => ({ ...s, lastSavedCode: s.code }));
        setScripts(initializedScripts);
      }
    });
  }, []);

  const activeScript = scripts.find(s => s.id === selectedScriptId);
  const isDirty = activeScript ? activeScript.code !== activeScript.lastSavedCode : false;

  const handleEditorChange = (value: string | undefined) => {
    if (activeScript && value !== undefined) {
      const metadata = parseMetadata(value);
      // Use the parsed name, or fallback to existing name if cleaning fails, but usually parseMetadata returns "New Script" or parsed name.
      // If the user clears the name field in code, we might want to keep the old one or show "Untitled".
      const newName = metadata.name || activeScript.name;

      const updatedScripts = scripts.map(s =>
        s.id === activeScript.id ? { ...s, code: value, name: newName } : s
      );
      setScripts(updatedScripts);
    }
  };

  const handleNewScript = () => {
    const newScript: Script = {
      id: crypto.randomUUID(),
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

`
    };
    setScripts([...scripts, newScript]);
    setSelectedScriptId(newScript.id);
  };

  const saveScript = async () => {
    if (!activeScript) return;
    setIsSaving(true);
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'SAVE_SCRIPT',
        script: activeScript
      });
      if (response && !response.success) {
        throw new Error(response.error || "Unknown error");
      }
      // Visual feedback
      const originalName = activeScript.name;

      // Update the lastSavedCode for this script
      const updatedScripts = scripts.map(s =>
        s.id === activeScript.id ? { ...s, lastSavedCode: s.code } : s
      );
      setScripts(updatedScripts);

      console.log('Script saved:', originalName);
    } catch (e) {
      console.error("Failed to save", e);
      alert("Failed to save script: " + (e as Error).message);
    } finally {
      setIsSaving(false);
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
  }, [activeScript, isSaving, scripts]); // Dependencies for the effect

  const deleteScript = async () => {
    if (!activeScript) return;
    if (!confirm("Are you sure you want to delete this script?")) return;

    try {
      await chrome.runtime.sendMessage({
        type: 'DELETE_SCRIPT',
        scriptId: activeScript.id
      });
      const newScripts = scripts.filter(s => s.id !== activeScript.id);
      setScripts(newScripts);
      setSelectedScriptId(null);
    } catch (e) {
      console.error("Failed to delete", e);
    }
  };

  return (
    <div className="dashboard-container">
      <aside className="sidebar">
        <div className="sidebar-header">
          <img src="/icons/icon48.png" className="logo-img" alt="StickyMonkey" />
          <h2>StickyMonkey</h2>
        </div>
        <nav className="nav-links">
          <a href="#"
            className={`nav-item ${activeTab === 'scripts' ? 'active' : ''}`}
            onClick={() => setActiveTab('scripts')}
          >
            <Terminal size={18} />
            <span>Scripts</span>
          </a>
          <a href="#"
            className={`nav-item ${activeTab === 'discover' ? 'active' : ''}`}
            onClick={() => setActiveTab('discover')}
          >
            <Search size={18} />
            <span>Discover</span>
          </a>
        </nav>

        {activeTab === 'scripts' && (
          <div className="script-list-sidebar">
            <div className="sidebar-section-header">
              <span>INSTALLED</span>
              <button className="icon-btn-small" onClick={handleNewScript}>
                <Plus size={14} />
              </button>
            </div>
            {scripts.map(script => (
              <div
                key={script.id}
                className={`script-item ${selectedScriptId === script.id ? 'active' : ''}`}
                onClick={() => setSelectedScriptId(script.id)}
              >
                {script.name}
              </div>
            ))}
          </div>
        )}
      </aside>
      <main className="content-area">
        {selectedScriptId && activeScript ? (
          <div className="editor-container">
            <header className="editor-header">
              <h2 className="editor-title">{activeScript.name}</h2>
              <div className="editor-actions">
                <button className="btn-secondary" onClick={deleteScript} title="Delete Script">
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
                theme="vs-dark"
                value={activeScript.code}
                onChange={handleEditorChange}
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  padding: { top: 16 }
                }}
              />
            </div>
          </div>
        ) : (
          <div className="empty-dashboard">
            <div className="empty-icon-wrapper">
              <Terminal size={48} />
            </div>
            <h3>Select or create a script</h3>
            <p>Manage your userscripts from the sidebar.</p>
            <button className="btn-primary" onClick={handleNewScript}>
              <Plus size={18} />
              <span>New Script</span>
            </button>
          </div>
        )}
      </main>
    </div>
  )
}

export default App
