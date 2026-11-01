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
})
