import { renderHook } from '@testing-library/react'
import { createRef, type ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { useFocusTrap } from './use-focus-trap'

describe('useFocusTrap', () => {
  it('leva o foco ao primeiro controle ao avançar do último', () => {
    const containerRef = createRef<HTMLDivElement>()
    const Wrapper = ({ children }: { children: ReactNode }) => (
      <div ref={containerRef}>
        {children}
        <button type="button">Primeiro</button>
        <button type="button">Último</button>
      </div>
    )
    renderHook(() => useFocusTrap(containerRef), { wrapper: Wrapper })
    const first = containerRef.current?.querySelector<HTMLButtonElement>('button:first-of-type')
    const last = containerRef.current?.querySelector<HTMLButtonElement>('button:last-of-type')
    expect(first).not.toBeNull()
    expect(last).not.toBeNull()
    last?.focus()
    last?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }))
    expect(document.activeElement).toBe(first)
  })
})
