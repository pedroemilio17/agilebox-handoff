import { useEffect, useRef, useState } from 'react'

/**
 * Campo que grava ao sair dele: um `onSave` por blur, e só se o texto mudou.
 * Enquanto o campo tem o foco, valores novos vindos do servidor não sobrescrevem o que está sendo digitado.
 */
export function useBlurSave(value: string, onSave: (next: string) => void) {
  const [draft, setDraft] = useState(value)
  const focused = useRef(false)

  useEffect(() => {
    if (!focused.current) setDraft(value)
  }, [value])

  return {
    value: draft,
    onChange: (next: string) => setDraft(next),
    onFocus: () => {
      focused.current = true
    },
    onBlur: () => {
      focused.current = false
      if (draft !== value) onSave(draft)
    },
  }
}
