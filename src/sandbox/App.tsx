import { lazy, Suspense, useEffect } from 'react';
import { HashRouter, Routes, Route, useLocation, Navigate, useNavigate } from 'react-router-dom';
const PopupApp = lazy(() => import('./popup/App'));
const OptionsApp = lazy(() => import('./options/App'));

// Redirect logic for legacy paths (e.g. #/settings -> #/options/settings)
function RedirectToOptions() {
    const location = useLocation();
    const path = location.pathname.startsWith('/') ? location.pathname.slice(1) : location.pathname;
    return <Navigate to={`/options/${path}`} replace />;
}

// Removed HashSync as we simplify the routing approach to avoid the location API limits

function HashSync() {
    const { pathname, search } = useLocation();
    const navigate = useNavigate();

    useEffect(() => {
        const fullPath = `#${pathname}${search}`;
        window.parent.postMessage({ type: 'URL_CHANGED', hash: fullPath }, '*');
    }, [pathname, search]);

    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.source !== window.parent) return;
            if (event.data && event.data.type === 'NAVIGATE' && event.data.path) {
                const targetHash = event.data.path;
                const targetPath = targetHash.startsWith('#') ? targetHash.slice(1) : targetHash;

                if (`${pathname}${search}` !== targetPath) {
                    // Use replace to prevent blowing up the history stack
                    navigate(targetPath, { replace: true });
                }
            }
        };
        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [navigate, pathname, search]);

    return null;
}

function SandboxApp() {
    return (
        <HashRouter>
            <Routes>
                <Route path="/popup/*" element={<Suspense fallback={null}><PopupApp /></Suspense>} />
                <Route path="/options/*" element={<Suspense fallback={<div className="route-loading" role="status">Loading Shieldmonkey…</div>}><OptionsApp /></Suspense>} />
                <Route path="*" element={<RedirectToOptions />} />
            </Routes>
            <HashSync />
        </HashRouter>
    );
}

export default SandboxApp;
