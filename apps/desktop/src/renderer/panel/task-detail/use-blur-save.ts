import { useEffect, useRef, useState } from 'react'

/**
 * Campo que grava ao sair dele: um `onSave` por blur, e só se o texto mudou.
 * Enquanto o campo tem o foco, valores novos vindos do servidor não sobrescrevem o que está sendo digitado.
 * `cancel` volta ao valor gravado sem gravar nada (Esc).
 */
export function useBlurSave(value: string, onSave: (next: string) => void) {
  const [draft, setDraftState] = useState(value)
  // O blur lê o rascunho por aqui, para não depender do render que ainda não aconteceu.
  const draftRef = useRef(value)
  const focused = useRef(false)

  const setDraft = (next: string) => {
    draftRef.current = next
    setDraftState(next)
  }

  useEffect(() => {
    if (!focused.current) {
      draftRef.current = value
      setDraftState(value)
    }
  }, [value])

  return {
    value: draft,
    onChange: (next: string) => setDraft(next),
    onFocus: () => {
      focused.current = true
    },
    onBlur: () => {
      focused.current = false
      if (draftRef.current !== value) onSave(draftRef.current)
    },
    cancel: () => setDraft(value),
  }
}
