import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { StatusMenu } from './StatusMenu'

afterEach(cleanup)

describe('StatusMenu', () => {
  it('expõe os estados como itens de rádio e marca o atual', () => {
    render(<StatusMenu value="todo" onChange={vi.fn()} />)

    expect(screen.getByRole('menu')).toBeTruthy()
    expect(screen.getAllByRole('menuitemradio')).toHaveLength(5)
    expect(
      screen.getByRole('menuitemradio', { name: 'A fazer' }).getAttribute('aria-checked'),
    ).toBe('true')
    expect(screen.getByRole('menu').getAttribute('style')).toContain('224px')
  })

  it('fecha com Escape e devolve o foco ao controle que abriu', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    function Harness() {
      const [open, setOpen] = useState(false)
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Abrir status
          </button>
          {open ? (
            <StatusMenu
              value="todo"
              onChange={vi.fn()}
              onClose={() => {
                onClose()
                setOpen(false)
              }}
            />
          ) : null}
        </>
      )
    }
    render(<Harness />)

    await user.click(screen.getByRole('button', { name: 'Abrir status' }))
    await user.keyboard('{Escape}')

    expect(onClose).toHaveBeenCalledOnce()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Abrir status' }))
  })
})
