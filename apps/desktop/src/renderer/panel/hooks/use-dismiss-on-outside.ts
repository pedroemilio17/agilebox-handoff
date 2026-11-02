import { useEffect, useRef, type RefObject } from 'react'

/**
 * Fecha um menu quando o clique ou o foco vai para fora de `anchor`, que deve envolver o gatilho
 * e o próprio menu. Enquanto `open` é verdadeiro, ouve o pointerdown no documento e o focusout
 * dentro do anchor. Clicar no gatilho não conta como "fora": ele mesmo alterna o menu.
 */
export function useDismissOnOutside(
  anchor: RefObject<HTMLElement | null>,
  open: boolean,
  onDismiss: () => void,
): void {
  // Guarda a última versão do callback: o efeito não precisa se reinscrever a cada render.
  const dismissRef = useRef(onDismiss)
  useEffect(() => {
    dismissRef.current = onDismiss
  })

  useEffect(() => {
    if (!open) return
    const node = anchor.current

    const onPointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node) || !anchor.current?.contains(event.target)) {
        dismissRef.current()
      }
    }
    const onFocusOut = (event: FocusEvent) => {
      if (
        !(event.relatedTarget instanceof Node) ||
        !anchor.current?.contains(event.relatedTarget)
      ) {
        dismissRef.current()
      }
    }

    document.addEventListener('pointerdown', onPointerDown)
    node?.addEventListener('focusout', onFocusOut)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      node?.removeEventListener('focusout', onFocusOut)
    }
  }, [anchor, open])
}
