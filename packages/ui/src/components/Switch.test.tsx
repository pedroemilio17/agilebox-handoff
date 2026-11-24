import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Switch } from './Switch'

afterEach(cleanup)

describe('Switch', () => {
  it('expõe role switch e alterna estado por clique e teclado', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const { rerender } = render(
      <Switch checked={false} onChange={onChange} aria-label="Ativar sprints" />,
    )

    const control = screen.getByRole('switch', { name: 'Ativar sprints' })
    expect(control.getAttribute('aria-checked')).toBe('false')

    await user.click(control)
    expect(onChange).toHaveBeenCalledWith(true)

    rerender(<Switch checked onChange={onChange} aria-label="Ativar sprints" />)
    expect(control.getAttribute('aria-checked')).toBe('true')

    control.focus()
    await user.keyboard(' ')
    expect(onChange).toHaveBeenLastCalledWith(false)
  })

  it('associa rótulo visível e respeita estado desabilitado', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Switch checked={false} disabled onChange={onChange} label="Somente leitura" />)

    const control = screen.getByRole('switch', { name: 'Somente leitura' })
    expect(control.hasAttribute('disabled')).toBe(true)
    await user.click(control)
    expect(onChange).not.toHaveBeenCalled()
  })
})
