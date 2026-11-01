import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useRestoreFocus } from './use-restore-focus'

describe('useRestoreFocus', () => {
  it('devolve o foco ao elemento ativo quando o conteúdo fecha', () => {
    const opener = document.createElement('button')
    opener.textContent = 'Abrir'
    document.body.append(opener)
    opener.focus()

    const { unmount } = renderHook(() => useRestoreFocus())
    document.body.focus()
    unmount()

    expect(document.activeElement).toBe(opener)
    opener.remove()
  })
})
