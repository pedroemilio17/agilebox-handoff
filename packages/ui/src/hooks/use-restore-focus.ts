import { useEffect } from 'react'

export function useRestoreFocus(active = true): void {
  useEffect(() => {
    if (!active) return

    const previouslyFocused = document.activeElement
    return () => {
      if (previouslyFocused instanceof HTMLElement && previouslyFocused.isConnected) {
        previouslyFocused.focus()
      }
    }
  }, [active])
}
