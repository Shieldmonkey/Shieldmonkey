import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
// Import only the languages we need - NO, we remove Monaco completely
import './App.css';

import { AppProvider } from './context/AppContext';
import { ModalProvider } from './context/ModalContext';

import Layout from './components/Layout';
import Scripts from './pages/Scripts';
import ScriptEditor from './pages/ScriptEditor';
import Settings from './pages/Settings';
import Help from './pages/Help';
import PermissionHelp from './pages/PermissionHelp';
import Install from './pages/Install';

// Helper component to sync hash with parent
function HashSync() {
  const { hash } = useLocation();

  useEffect(() => {
    // Notify parent of hash change
    window.parent.postMessage({ type: 'URL_CHANGED', hash }, '*');
  }, [hash]);

  useEffect(() => {
    // Listen for navigation requests from parent (browser back/forward)
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'NAVIGATE' && event.data.path) {
        if (window.location.hash !== event.data.path) {
          window.location.hash = event.data.path;
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  return null;
}

function App() {
  return (
    <AppProvider>
      <ModalProvider>
        <HashSync />
        <Routes>
          <Route path="install" element={<Install />} />
          <Route path="permission-help" element={
            <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column' }}>
              <PermissionHelp />
            </div>
          } />

          <Route element={<Layout />}>
            <Route index element={<Navigate to="scripts" replace />} />
            <Route path="scripts" element={<Scripts />} />

            <Route path="settings" element={<Settings />} />
            <Route path="help" element={<Help />} />
          </Route>
          <Route path="scripts/:id" element={<ScriptEditor />} />
          <Route path="new" element={<ScriptEditor />} />
        </Routes>
      </ModalProvider>
    </AppProvider>
  );
}

export default App;
