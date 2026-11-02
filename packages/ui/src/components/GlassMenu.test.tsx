import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GlassMenu, type GlassMenuItem } from './GlassMenu'

afterEach(cleanup)

const items: readonly GlassMenuItem[] = [
  { id: 'rename', label: 'Renomear', shortcut: 'F2' },
  { id: 'archive', label: 'Arquivar', shortcut: 'E', separatorBefore: true },
  { id: 'move', label: 'Mover para', disabled: true },
]

function Harness({ onSelect, onClose }: { onSelect: (id: string) => void; onClose: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Abrir ações
      </button>
      {open ? (
        <GlassMenu
          label="Mais ações"
          items={items}
          onSelect={onSelect}
          onClose={() => {
            onClose()
            setOpen(false)
          }}
        />
      ) : null}
    </>
  )
}

describe('GlassMenu', () => {
  it('expõe role menu com itens menuitem e separador', () => {
    render(<GlassMenu label="Mais ações" items={items} onSelect={vi.fn()} onClose={vi.fn()} />)

    expect(screen.getByRole('menu', { name: 'Mais ações' })).toBeTruthy()
    expect(screen.getAllByRole('menuitem')).toHaveLength(3)
    expect(screen.getByRole('menuitem', { name: 'Renomear' })).toBeTruthy()
    expect(screen.getByRole('separator')).toBeTruthy()
  })

  it('move o foco com setas, pula itens desativados e dá a volta', async () => {
    const user = userEvent.setup()
    render(<GlassMenu label="Mais ações" items={items} onSelect={vi.fn()} onClose={vi.fn()} />)
    const rename = screen.getByRole('menuitem', { name: 'Renomear' })
    const archive = screen.getByRole('menuitem', { name: 'Arquivar' })

    expect(document.activeElement).toBe(rename)
    await user.keyboard('{ArrowDown}')
    expect(document.activeElement).toBe(archive)
    await user.keyboard('{ArrowDown}')
    expect(document.activeElement).toBe(rename)
    await user.keyboard('{ArrowUp}')
    expect(document.activeElement).toBe(archive)
    await user.keyboard('{Home}')
    expect(document.activeElement).toBe(rename)
    await user.keyboard('{End}')
    expect(document.activeElement).toBe(archive)
  })

  it('escolhe o item com Enter, chama onSelect e fecha', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    const onClose = vi.fn()
    render(<Harness onSelect={onSelect} onClose={onClose} />)

    await user.click(screen.getByRole('button', { name: 'Abrir ações' }))
    await user.keyboard('{Enter}')

    expect(onSelect).toHaveBeenCalledExactlyOnceWith('rename')
    expect(onClose).toHaveBeenCalledOnce()
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('fecha com Esc e devolve o foco ao controle que abriu', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<Harness onSelect={vi.fn()} onClose={onClose} />)

    await user.click(screen.getByRole('button', { name: 'Abrir ações' }))
    await user.keyboard('{Escape}')

    expect(onClose).toHaveBeenCalledOnce()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Abrir ações' }))
  })

  it('fecha com Tab e devolve o foco ao controle que abriu', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<Harness onSelect={vi.fn()} onClose={onClose} />)

    await user.click(screen.getByRole('button', { name: 'Abrir ações' }))
    await user.keyboard('{Tab}')

    expect(onClose).toHaveBeenCalledOnce()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Abrir ações' }))
  })
})
