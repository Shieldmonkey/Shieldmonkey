import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import SandboxApp from './App'
import { I18nProvider } from './context/I18nContext'

// Global styles?
// We might need to import index.css from both popup and options or have a shared one.
// For now, let's assume specific components import their styles or we import them here.
import './index.css';
import './popup/index.css';
import './options/index.css';

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <I18nProvider>
            <SandboxApp />
        </I18nProvider>
    </StrictMode>,
)
