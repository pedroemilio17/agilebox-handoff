import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ManagerBanner } from './ManagerBanner'

afterEach(cleanup)

describe('ManagerBanner', () => {
  it('diz de quem são as tarefas exibidas e que as edições saem como Gestor', () => {
    render(<ManagerBanner userName="Ana" onBack={() => undefined} />)

    const banner = screen.getByRole('status', { name: 'Tarefas de Ana' })
    expect(banner.textContent).toContain('Tarefas de Ana · editando como Gestor')
  })

  it('oferece a volta com texto visível, não só ícone', async () => {
    const onBack = vi.fn()
    render(<ManagerBanner userName="Ana" onBack={onBack} />)

    await userEvent.setup().click(screen.getByRole('button', { name: 'Voltar às minhas' }))

    expect(onBack).toHaveBeenCalledOnce()
  })
})
