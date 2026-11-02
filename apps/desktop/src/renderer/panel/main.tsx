import '@agilebox/ui'
import { Gallery } from './dev/Gallery'
import { createRoot } from 'react-dom/client'
import { applyGlassMode } from '../shared/lib/apply-glass-mode'
import { applyWindowOpacity } from '../shared/lib/window-opacity'
import { ApiProvider } from '../shared/api/ApiProvider'
import { QueryProvider } from '../shared/query/QueryProvider'
import { createIpcClient } from '../shared/api/ipc-client'
import { App } from './App'

const showGallery =
  import.meta.env.DEV && new URLSearchParams(window.location.search).has('gallery')

applyGlassMode()
applyWindowOpacity()

function PanelApp() {
  const api = createIpcClient(window.agilebox)
  return (
    <ApiProvider api={api}>
      <QueryProvider>
        <App />
      </QueryProvider>
    </ApiProvider>
  )
}

createRoot(document.getElementById('root')!).render(showGallery ? <Gallery /> : <PanelApp />)
