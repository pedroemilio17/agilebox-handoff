import '@agilebox/ui'
import { Gallery } from './dev/Gallery'
import { createRoot } from 'react-dom/client'

const showGallery =
  import.meta.env.DEV && new URLSearchParams(window.location.search).has('gallery')

createRoot(document.getElementById('root')!).render(showGallery ? <Gallery /> : null)
