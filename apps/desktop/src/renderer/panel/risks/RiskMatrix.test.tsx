import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RiskMatrix } from './RiskMatrix'

afterEach(cleanup)

const RISKS = [
  { probability: 3 as const, impact: 3 as const },
  { probability: 3 as const, impact: 3 as const },
  { probability: 1 as const, impact: 1 as const },
]

describe('matriz 3×3 de riscos', () => {
  it('mostra nove quadrantes com a contagem, com texto acessível por quadrante', () => {
    render(<RiskMatrix risks={RISKS} selected={null} onSelect={vi.fn()} />)
    expect(screen.getAllByRole('button', { name: /^Probabilidade/ })).toHaveLength(9)
    expect(
      screen.getByRole('button', { name: 'Probabilidade Alta, impacto Alto: 2 riscos' })
        .textContent,
    ).toContain('2')
    expect(
      screen.getByRole('button', { name: 'Probabilidade Baixa, impacto Baixo: 1 risco' }),
    ).toBeTruthy()
  })

  it('clicar num quadrante seleciona; clicar de novo, ou no "Mostrar todos", limpa', async () => {
    const onSelect = vi.fn()
    const { rerender } = render(<RiskMatrix risks={RISKS} selected={null} onSelect={onSelect} />)
    await userEvent.click(screen.getByRole('button', { name: /Probabilidade Alta, impacto Alto/ }))
    expect(onSelect).toHaveBeenLastCalledWith({ probability: 3, impact: 3 })

    rerender(
      <RiskMatrix risks={RISKS} selected={{ probability: 3, impact: 3 }} onSelect={onSelect} />,
    )
    const cell = screen.getByRole('button', { name: /Probabilidade Alta, impacto Alto/ })
    expect(cell.getAttribute('aria-pressed')).toBe('true')
    await userEvent.click(cell)
    expect(onSelect).toHaveBeenLastCalledWith(null)

    await userEvent.click(screen.getByRole('button', { name: 'Mostrar todos (3)' }))
    expect(onSelect).toHaveBeenLastCalledWith(null)
  })

  it('o botão "Mostrar todos" só aparece com um quadrante selecionado', () => {
    render(<RiskMatrix risks={RISKS} selected={null} onSelect={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /Mostrar todos/ })).toBeNull()
  })
})
