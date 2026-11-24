import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { JargonTip } from './JargonTip'

afterEach(cleanup)

describe('JargonTip', () => {
  it('exibe a explicação ao focar ou passar o mouse e oculta ao sair', async () => {
    const user = userEvent.setup()
    render(<JargonTip term="WIP" description="Limite de tarefas em andamento na coluna." />)

    const button = screen.getByRole('button', { name: 'Explicação sobre WIP' })
    expect(screen.queryByRole('tooltip')).toBeNull()

    await user.hover(button)
    expect(screen.getByRole('tooltip').textContent).toBe(
      'Limite de tarefas em andamento na coluna.',
    )

    await user.unhover(button)
    expect(screen.queryByRole('tooltip')).toBeNull()

    await user.tab()
    expect(document.activeElement).toBe(button)
    expect(screen.getByRole('tooltip')).toBeTruthy()
  })
})
