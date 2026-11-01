import '@agilebox/ui'
import { createRoot } from 'react-dom/client'
import { ApiProvider } from '../shared/api/ApiProvider'
import { createIpcClient } from '../shared/api/ipc-client'
import { applyGlassMode } from '../shared/lib/apply-glass-mode'
import { QueryProvider } from '../shared/query/QueryProvider'
import { App } from './App'

applyGlassMode()

const api = createIpcClient(window.agilebox)

createRoot(document.getElementById('root')!).render(
  <ApiProvider api={api}>
    <QueryProvider>
      <App />
    </QueryProvider>
  </ApiProvider>,
)
