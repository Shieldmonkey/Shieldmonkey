import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Popup CSS removed to prevent layout issues
import Install from './Install.tsx'

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <Install />
    </StrictMode>,
)
