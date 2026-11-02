import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useBlurSave } from './use-blur-save'

describe('useBlurSave', () => {
  it('grava uma vez ao sair do campo quando o texto mudou', () => {
    const onSave = vi.fn()
    const { result } = renderHook(() => useBlurSave('antes', onSave))
    act(() => result.current.onFocus())
    act(() => result.current.onChange('depois'))
    act(() => result.current.onBlur())
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledWith('depois')
  })

  it('não grava quando nada mudou', () => {
    const onSave = vi.fn()
    const { result } = renderHook(() => useBlurSave('igual', onSave))
    act(() => result.current.onFocus())
    act(() => result.current.onBlur())
    expect(onSave).not.toHaveBeenCalled()
  })

  it('não perde o que está sendo digitado quando chega um valor novo do servidor', () => {
    const { result, rerender } = renderHook(({ value }) => useBlurSave(value, vi.fn()), {
      initialProps: { value: 'a' },
    })
    act(() => result.current.onFocus())
    act(() => result.current.onChange('digitando'))
    rerender({ value: 'b' })
    expect(result.current.value).toBe('digitando')
  })

  it('cancel volta ao valor gravado e o próximo blur não grava nada', () => {
    const onSave = vi.fn()
    const { result } = renderHook(() => useBlurSave('gravado', onSave))
    act(() => result.current.onFocus())
    act(() => result.current.onChange('digitado'))
    act(() => result.current.cancel())
    expect(result.current.value).toBe('gravado')
    act(() => result.current.onBlur())
    expect(onSave).not.toHaveBeenCalled()
  })

  it('o blur grava o último texto digitado, mesmo com digitações seguidas', () => {
    const onSave = vi.fn()
    const { result } = renderHook(() => useBlurSave('a', onSave))
    act(() => result.current.onFocus())
    act(() => result.current.onChange('ab'))
    act(() => result.current.onChange('abc'))
    act(() => result.current.onBlur())
    expect(onSave).toHaveBeenCalledWith('abc')
  })

  it('acompanha o servidor quando o campo não tem o foco', () => {
    const { result, rerender } = renderHook(({ value }) => useBlurSave(value, vi.fn()), {
      initialProps: { value: 'a' },
    })
    rerender({ value: 'b' })
    expect(result.current.value).toBe('b')
  })
})
