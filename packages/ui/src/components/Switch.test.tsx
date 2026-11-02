import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Switch } from './Switch'

afterEach(cleanup)

describe('Switch', () => {
  it('expõe papel switch com o nome visível e aria-checked refletindo o estado', () => {
    const { rerender } = render(
      <Switch checked={false} onCheckedChange={vi.fn()}>
        Integrações
      </Switch>,
    )

    const toggle = screen.getByRole('switch', { name: 'Integrações' })
    expect(toggle.getAttribute('aria-checked')).toBe('false')

    rerender(
      <Switch checked onCheckedChange={vi.fn()}>
        Integrações
      </Switch>,
    )
    expect(screen.getByRole('switch', { name: 'Integrações' }).getAttribute('aria-checked')).toBe(
      'true',
    )
  })

  it('pede a troca do estado oposto ao clicar', async () => {
    const user = userEvent.setup()
    const onCheckedChange = vi.fn()
    render(
      <Switch checked={false} onCheckedChange={onCheckedChange}>
        Agenda
      </Switch>,
    )

    await user.click(screen.getByRole('switch', { name: 'Agenda' }))
    expect(onCheckedChange).toHaveBeenCalledWith(true)
  })

  it('alterna pelo teclado e atualiza aria-checked quando o pai controla o estado', async () => {
    const user = userEvent.setup()
    function Harness() {
      const [on, setOn] = useState(false)
      return (
        <Switch checked={on} onCheckedChange={setOn}>
          Impedimentos
        </Switch>
      )
    }
    render(<Harness />)

    await user.tab()
    expect(document.activeElement).toBe(screen.getByRole('switch', { name: 'Impedimentos' }))
    await user.keyboard(' ')
    expect(screen.getByRole('switch', { name: 'Impedimentos' }).getAttribute('aria-checked')).toBe(
      'true',
    )
  })

  it('não responde quando está desabilitado', async () => {
    const user = userEvent.setup()
    const onCheckedChange = vi.fn()
    render(
      <Switch checked={false} disabled onCheckedChange={onCheckedChange}>
        Bloqueado
      </Switch>,
    )

    await user.click(screen.getByRole('switch', { name: 'Bloqueado' }))
    expect(onCheckedChange).not.toHaveBeenCalled()
  })
})
