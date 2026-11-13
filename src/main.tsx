import '@fontsource/dm-serif-display/400.css'
import '@fontsource-variable/work-sans'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { UpdatePrompt } from './components/UpdatePrompt'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <UpdatePrompt />
  </StrictMode>,
)
