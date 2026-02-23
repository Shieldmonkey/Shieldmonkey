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

// Removed HashSync as we simplify the routing approach to avoid the location API limits

function HashSync() {
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
                const targetPath = targetHash.startsWith('#') ? targetHash.slice(1) : targetHash;

                if (pathname !== targetPath) {
                    // Use replace to prevent blowing up the history stack
                    navigate(targetPath, { replace: true });
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
