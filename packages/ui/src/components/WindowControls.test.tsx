import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { WindowControls } from './WindowControls'

afterEach(cleanup)

describe('WindowControls', () => {
  it('oferece controles de 40 por 44 px com nomes acessíveis', async () => {
    const user = userEvent.setup()
    const onMinimize = vi.fn()
    const onToggle = vi.fn()
    const onClose = vi.fn()
    render(
      <WindowControls
        onMinimize={onMinimize}
        onToggleExpand={onToggle}
        onClose={onClose}
        expanded={false}
      />,
    )

    const controls = screen.getByRole('group', { name: 'Controles da janela' })
    expect(controls.querySelectorAll('button')).toHaveLength(3)
    expect(controls.querySelector('button')?.getAttribute('style')).toContain('40px')
    expect(controls.querySelector('button')?.getAttribute('style')).toContain('44px')
    await user.click(screen.getByRole('button', { name: 'Expandir' }))
    await user.click(screen.getByRole('button', { name: 'Fechar' }))
    await user.click(screen.getByRole('button', { name: 'Minimizar' }))

    expect(onToggle).toHaveBeenCalledOnce()
    expect(onClose).toHaveBeenCalledOnce()
    expect(onMinimize).toHaveBeenCalledOnce()
  })

  it('suporta modo compacto para barra de título de 42 px', () => {
    render(
      <WindowControls
        compact
        expanded
        onMinimize={vi.fn()}
        onToggleExpand={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    const toggleButton = screen.getByRole('button', { name: 'Recolher' })
    expect(toggleButton.getAttribute('style')).toBeNull()
    expect(screen.getByRole('group', { name: 'Controles da janela' }).className).toContain(
      'compact',
    )
  })
})
