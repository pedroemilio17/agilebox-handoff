import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useReducedMotion } from './use-reduced-motion'

describe('useReducedMotion', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('reflete e acompanha a preferência de movimento reduzido', () => {
    let changeListener: (() => void) | undefined
    const mediaQuery = {
      matches: true,
      addEventListener: vi.fn((_type: string, listener: () => void) => {
        changeListener = listener
      }),
      removeEventListener: vi.fn(),
    }
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => mediaQuery),
    )

    const { result } = renderHook(() => useReducedMotion())
    expect(result.current).toBe(true)

    act(() => {
      mediaQuery.matches = false
      changeListener?.()
    })
    expect(result.current).toBe(false)
  })
})
