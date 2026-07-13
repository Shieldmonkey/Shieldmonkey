import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import './App.css';

import { AppProvider } from './context/AppContext';
import { ModalProvider } from './context/ModalContext';

const Layout = lazy(() => import('./components/Layout'));
const Scripts = lazy(() => import('./pages/Scripts'));
const ScriptEditor = lazy(() => import('./pages/ScriptEditor'));
const Settings = lazy(() => import('./pages/Settings'));
const Help = lazy(() => import('./pages/Help'));
const PermissionHelp = lazy(() => import('./pages/PermissionHelp'));
const Install = lazy(() => import('./pages/Install'));

function App() {
  return (
    <AppProvider>
      <ModalProvider>
        <Suspense fallback={<div className="route-loading" role="status">Loading…</div>}>
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
        </Suspense>
      </ModalProvider>
    </AppProvider>
  );
}

export default App;
