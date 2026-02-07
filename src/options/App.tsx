import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
// Import only the languages we need - NO, we remove Monaco completely
import './App.css';

import { I18nProvider } from '../context/I18nContext';
import { AppProvider } from './context/AppContext';
import { ModalProvider } from './context/ModalContext';

import Layout from './components/Layout';
import Scripts from './pages/Scripts';
import ScriptEditor from './pages/ScriptEditor';
import Settings from './pages/Settings';
import Help from './pages/Help';
import PermissionHelp from './pages/PermissionHelp';
import Install from './pages/Install';

function App() {
  return (
    <I18nProvider>
      <AppProvider>
        <ModalProvider>
          <HashRouter>
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
