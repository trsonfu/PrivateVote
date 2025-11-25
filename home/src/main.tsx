import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Buffer } from 'buffer'
import './index.css'
import './styles/neoBrutal.css'
import App from './App.tsx'

// The relayer SDK depends on Node's Buffer API; create the polyfill once here.
if (!globalThis.Buffer) {
  globalThis.Buffer = Buffer
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
