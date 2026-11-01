import '@agilebox/ui'
import { createRoot } from 'react-dom/client'
import { applyGlassMode } from '../shared/lib/apply-glass-mode'
import { App } from './App'

applyGlassMode()

createRoot(document.getElementById('root')!).render(<App />)
