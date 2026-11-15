import '@fontsource/dm-serif-display/400.css'
import '@fontsource-variable/work-sans'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { UpdatePrompt } from './components/UpdatePrompt'
import { installAudio } from './game/sound'
import './styles.css'

installAudio()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <UpdatePrompt />
  </StrictMode>,
)
