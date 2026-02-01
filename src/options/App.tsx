import { useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';

// Import only the languages we need
import 'monaco-editor/esm/vs/basic-languages/javascript/javascript.contribution.js';
import 'monaco-editor/esm/vs/language/typescript/monaco.contribution.js';


import { AppProvider } from './context/AppContext';
import { ModalProvider } from './context/ModalContext';
import { configureMonaco } from './monacoConfig';

import Layout from './components/Layout';
import Scripts from './pages/Scripts';
import ScriptEditor from './pages/ScriptEditor';
import Settings from './pages/Settings';
import Help from './pages/Help';
import PermissionHelp from './pages/PermissionHelp';
import Install from './pages/Install';

import './App.css';

// Monaco Worker Configuration
loader.config({ monaco });

import editorWorkerUrl from 'monaco-editor/esm/vs/editor/editor.worker?worker&url';
import jsonWorkerUrl from 'monaco-editor/esm/vs/language/json/json.worker?worker&url';
import cssWorkerUrl from 'monaco-editor/esm/vs/language/css/css.worker?worker&url';
import htmlWorkerUrl from 'monaco-editor/esm/vs/language/html/html.worker?worker&url';
import tsWorkerUrl from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker&url';

self.MonacoEnvironment = {
  getWorkerUrl: function (_moduleId, label) {
    if (label === 'json') return chrome.runtime.getURL(jsonWorkerUrl);
    if (label === 'css' || label === 'scss' || label === 'less') return chrome.runtime.getURL(cssWorkerUrl);
    if (label === 'html' || label === 'handlebars' || label === 'razor') return chrome.runtime.getURL(htmlWorkerUrl);
    if (label === 'typescript' || label === 'javascript') return chrome.runtime.getURL(tsWorkerUrl);
    return chrome.runtime.getURL(editorWorkerUrl);
  }
};

import { I18nProvider } from '../context/I18nContext';

const MonacoSetup = () => {
  useEffect(() => {
    const disposable = configureMonaco(monaco);
    return () => disposable.dispose();
  }, []);
  return null;
};

function App() {
  return (
    <I18nProvider>
      <AppProvider>
        <ModalProvider>
          <HashRouter>
            <MonacoSetup />
            <Routes>
              <Route path="/permission-help" element={
                <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column' }}>
                  <PermissionHelp />
                </div>
              } />
              <Route path="/install" element={<Install />} />

              <Route element={<Layout />}>
                <Route path="/" element={<Navigate to="/scripts" replace />} />
                <Route path="/scripts" element={<Scripts />} />

                <Route path="/settings" element={<Settings />} />
                <Route path="/help" element={<Help />} />
              </Route>
              <Route path="/scripts/:id" element={<ScriptEditor />} />
              <Route path="/new" element={<ScriptEditor />} />
            </Routes>
          </HashRouter>
        </ModalProvider>
      </AppProvider>
    </I18nProvider>
  );
}

export default App;
