import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { StepIndicator } from './StepIndicator'

afterEach(cleanup)

describe('StepIndicator', () => {
  it('lê "Passo X de Y" como texto acessível', () => {
    render(<StepIndicator current={2} total={3} />)
    expect(screen.getByText('Passo 2 de 3')).toBeTruthy()
  })

  it('as barras são decorativas e ficam ocultas para leitor de tela', () => {
    const { container } = render(<StepIndicator current={1} total={3} />)
    const bars = container.querySelector('[aria-hidden="true"]')
    expect(bars?.children).toHaveLength(3)
  })

  it('limita o passo atual ao intervalo de 1 até o total', () => {
    const { rerender } = render(<StepIndicator current={9} total={3} />)
    expect(screen.getByText('Passo 3 de 3')).toBeTruthy()
    rerender(<StepIndicator current={0} total={3} />)
    expect(screen.getByText('Passo 1 de 3')).toBeTruthy()
  })
})
