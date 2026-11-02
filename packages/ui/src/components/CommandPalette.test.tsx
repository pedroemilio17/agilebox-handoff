import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CommandPalette } from './CommandPalette'
afterEach(cleanup)
describe('paleta de comandos', () => {
  it('seleciona por setas, usa Shift Enter e retorna foco ao fechar por Esc', async () => {
    const user = userEvent.setup()
    const select = vi.fn()
    function Harness() {
      const [open, setOpen] = useState(false)
      return (
        <>
          <button onClick={() => setOpen(true)}>Abrir paleta</button>
          {open && (
            <CommandPalette
              value=""
              onChange={() => undefined}
              onClose={() => setOpen(false)}
              tokens={<span>A fazer</span>}
              actions={[
                { id: 'first', label: 'Criar', section: 'Ações', onSelect: select },
                {
                  id: 'second',
                  label: 'Abrir tarefa',
                  section: 'Tarefas parecidas',
                  onSelect: select,
                },
              ]}
            />
          )}
        </>
      )
    }
    render(<Harness />)
    const trigger = screen.getByRole('button', { name: 'Abrir paleta' })
    await user.click(trigger)
    const input = screen.getByRole('combobox')
    expect(document.activeElement).toBe(input)
    await user.keyboard('{ArrowDown}{Shift>}{Enter}{/Shift}')
    expect(screen.getByRole('option', { name: 'Abrir tarefa' }).getAttribute('aria-selected')).toBe(
      'true',
    )
    expect(input.getAttribute('aria-activedescendant')).toBe(
      screen.getByRole('option', { name: 'Abrir tarefa' }).id,
    )
    expect(select).toHaveBeenCalledWith(true)
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })
  it('prende foco e permite Tab completar sem acionar outra opção', async () => {
    const complete = vi.fn(() => true)
    render(
      <CommandPalette
        value="@an"
        onChange={() => undefined}
        onClose={() => undefined}
        tokens={null}
        actions={[]}
        onComplete={complete}
      />,
    )
    const input = screen.getByRole('combobox')
    await userEvent.tab()
    expect(complete).toHaveBeenCalledOnce()
    expect(document.activeElement).toBe(input)
    await userEvent.keyboard('{Shift>}{Tab}{/Shift}')
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Fechar busca' }))
  })
})
