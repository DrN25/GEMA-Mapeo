import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { applyStoredTheme } from './utils/theme'

// Aplicar el tema guardado ANTES del primer render para evitar parpadeo
applyStoredTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
