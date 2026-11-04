import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Toast } from './Toast'
import { WipLimitMeter } from './WipLimitMeter'

afterEach(cleanup)

describe('WipLimitMeter', () => {
  it('mostra N/limite e o estado dentro do limite com texto e ícone', () => {
    const { container } = render(
      <WipLimitMeter name="Desenvolvendo" count={2} limit={3} state="ok" />,
    )

    expect(
      screen.getByRole('img', { name: 'Desenvolvendo: 2 de 3, dentro do limite' }),
    ).toBeTruthy()
    expect(screen.getByText('2/3')).toBeTruthy()
    expect(screen.getByText('Dentro do limite')).toBeTruthy()
    expect(container.querySelector('svg')).not.toBeNull()
  })

  it('mostra o estado no limite com texto "No limite"', () => {
    render(<WipLimitMeter name="Revisar" count={3} limit={3} state="at_limit" />)

    expect(screen.getByRole('img', { name: 'Revisar: 3 de 3, no limite' })).toBeTruthy()
    expect(screen.getByText('No limite')).toBeTruthy()
  })

  it('mostra o estado acima do limite com texto "Acima do limite"', () => {
    render(<WipLimitMeter name="Desenvolvendo" count={4} limit={3} state="over" />)

    expect(screen.getByRole('img', { name: 'Desenvolvendo: 4 de 3, acima do limite' })).toBeTruthy()
    expect(screen.getByText('4/3')).toBeTruthy()
    expect(screen.getByText('Acima do limite')).toBeTruthy()
  })

  it('aceita uma dica via title', () => {
    render(
      <WipLimitMeter
        name="Desenvolvendo"
        count={1}
        limit={3}
        state="ok"
        title="Conta só as tarefas que você vê."
      />,
    )

    expect(screen.getByRole('img').getAttribute('title')).toBe('Conta só as tarefas que você vê.')
  })
})

describe('Toast de aviso', () => {
  it('usa ícone de alerta no tom de atenção, sem a confirmação', () => {
    const { container } = render(
      <Toast message="Desenvolvendo passou do limite (4/3)." tone="warning" />,
    )

    expect(screen.getByRole('status').textContent).toContain(
      'Desenvolvendo passou do limite (4/3).',
    )
    expect(container.textContent).toContain('!')
    expect(container.textContent).not.toContain('✓')
  })
})
