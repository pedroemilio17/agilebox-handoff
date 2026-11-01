import type { AgileBoxBridge } from '@agilebox/contract'

declare global {
  interface Window {
    agilebox: AgileBoxBridge
  }
}

export {}
