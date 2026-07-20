import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { ErrorBoundary } from './components/Layout/ErrorBoundary'
import { theme } from './config/theme'
import { initGTM, initRealUserDetection, trackError } from './lib/analytics'
import { initTheme } from './lib/theme'
import './index.css'

// Apply saved theme before React renders (prevents flash)
initTheme()

// Set HTML title from theme
document.title = theme.appName

// Initialize GTM (no-op if VITE_GTM_ID is unset)
initGTM()

// Detect real users vs bots (fires real_user event after 5s + interaction)
initRealUserDetection()

// Global error tracking
window.addEventListener('error', (e) => {
  trackError(e.message, 'window_error')
})
window.addEventListener('unhandledrejection', (e) => {
  trackError(String(e.reason), 'unhandled_rejection')
})

const root = document.getElementById('root')
if (!root) throw new Error('Root element not found')

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)
