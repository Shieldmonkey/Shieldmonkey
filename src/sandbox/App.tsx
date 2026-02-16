import { useEffect } from 'react';
import { HashRouter, Routes, Route, useLocation, Navigate, useNavigate } from 'react-router-dom';
import PopupApp from './popup/App';
import OptionsApp from './options/App';

// Redirect logic for legacy paths (e.g. #/settings -> #/options/settings)
function RedirectToOptions() {
    const location = useLocation();
    const path = location.pathname.startsWith('/') ? location.pathname.slice(1) : location.pathname;
    return <Navigate to={`/options/${path}`} replace />;
}

function HashSync() {
    const { pathname } = useLocation();

    useEffect(() => {
        // Notify parent of hash change
        // We use hash from useLocation, which is usually empty in HashRouter if we just check location.hash?
        // No, useLocation().hash might be empty if we are in HashRouter, because the "path" IS the hash relative to the page.
        // Actually, in HashRouter, useLocation().pathname is the path after the hash.
        // So we should construct the hash.
        const fullPath = '#' + pathname;
        window.parent.postMessage({ type: 'URL_CHANGED', hash: fullPath }, '*');
    }, [pathname]);

    useEffect(() => {
        // Listen for navigation requests from parent (browser back/forward)
        const handleMessage = (event: MessageEvent) => {
            if (event.data && event.data.type === 'NAVIGATE' && event.data.path) {
                if (window.location.hash !== event.data.path) {
                    // We need to navigate internally
                    // This creates a loop if we are not careful, but React Router should handle replacement if same.
                    // But we can't access navigate here easily unless we wrap logic.
                    // Actually we can use window.location.hash = targetPath? Use Navigate component?
                    // Better to rely on the fact that HashRouter listens to hashchange event?
                    // If HashRouter listens to hashchange, and Host updates iframe hash (Wait, Host does NOT update iframe hash directly in my reading of main.tsx, it sends NAVIGATE message).
                    // So we must handle NAVIGATE message and use `navigate` hook.
                }
            }
        };
        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    // We need 'navigate' hook to programmatically navigate on NAVIGATE message
    // So let's split this into a component that uses useNavigate
    return <HashSyncInner />;
}

function HashSyncInner() {
    const { pathname } = useLocation();
    const navigate = useNavigate();

    useEffect(() => {
        const fullPath = '#' + pathname;
        window.parent.postMessage({ type: 'URL_CHANGED', hash: fullPath }, '*');
    }, [pathname]);

    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.data && event.data.type === 'NAVIGATE' && event.data.path) {
                const targetHash = event.data.path;
                // targetHash is like #/options/new
                const targetPath = targetHash.startsWith('#') ? targetHash.slice(1) : targetHash;

                if (pathname !== targetPath) {
                    navigate(targetPath);
                }
            }
        };
        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [navigate, pathname]);

    return null;
}

function SandboxApp() {
    return (
        <HashRouter>
            <Routes>
                <Route path="/popup/*" element={<PopupApp />} />
                <Route path="/options/*" element={<OptionsApp />} />
                <Route path="*" element={<RedirectToOptions />} />
            </Routes>
            <HashSync />
        </HashRouter>
    );
}

export default SandboxApp;
