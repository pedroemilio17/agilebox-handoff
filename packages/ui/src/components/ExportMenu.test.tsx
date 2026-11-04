import { cleanup, render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ExportMenu } from './ExportMenu'

afterEach(cleanup)

const options = [
  { value: 'md', label: 'Markdown (.md)' },
  { value: 'csv', label: 'Planilha (.csv)' },
] as const

function setup(busy = false) {
  const onSelect = vi.fn()
  const user = userEvent.setup()
  render(
    <ExportMenu
      label="Exportar resumo"
      ariaLabel="Exportar resumo do dashboard"
      options={options}
      busy={busy}
      busyLabel="Exportando…"
      onSelect={onSelect}
    />,
  )
  return {
    onSelect,
    user,
    trigger: screen.getByRole('button', { name: 'Exportar resumo do dashboard' }),
  }
}

describe('ExportMenu', () => {
  it('abre o menu com as opções e expõe o estado aberto', async () => {
    const { user, trigger } = setup()
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    await user.click(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByRole('menuitem', { name: 'Markdown (.md)' })).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: 'Planilha (.csv)' })).toBeTruthy()
  })

  it('escolher uma opção chama onSelect com o valor, fecha e devolve o foco ao botão', async () => {
    const { user, trigger, onSelect } = setup()
    await user.click(trigger)
    await user.click(screen.getByRole('menuitem', { name: 'Planilha (.csv)' }))
    expect(onSelect).toHaveBeenCalledWith('csv')
    expect(screen.queryByRole('menu')).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })

  it('navega com setas e escolhe com Enter pelo teclado', async () => {
    const { user, trigger, onSelect } = setup()
    trigger.focus()
    await user.keyboard('{Enter}')
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Markdown (.md)' }))
    await user.keyboard('{ArrowDown}')
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Planilha (.csv)' }))
    await user.keyboard('{ArrowDown}')
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Markdown (.md)' }))
    await user.keyboard('{Enter}')
    expect(onSelect).toHaveBeenCalledWith('md')
  })

  it('Esc fecha o menu sem escolher e devolve o foco', async () => {
    const { user, trigger, onSelect } = setup()
    await user.click(trigger)
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).toBeNull()
    expect(onSelect).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(trigger)
  })

  it('clique fora fecha o menu', async () => {
    const { user, trigger } = setup()
    await user.click(trigger)
    fireEvent.mouseDown(document.body)
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('enquanto ocupado, desabilita o botão e mostra o texto de carregamento', () => {
    setup(true)
    const busy = screen.getByRole('button', { name: 'Exportar resumo do dashboard' })
    expect(busy.hasAttribute('disabled')).toBe(true)
    expect(busy.textContent).toBe('Exportando…')
  })
})
