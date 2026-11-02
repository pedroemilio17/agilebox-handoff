import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Card } from './Card'

afterEach(cleanup)

describe('Card', () => {
  it('renderiza o conteúdo e aceita classe extra', () => {
    render(
      <Card className="extra" data-testid="card">
        <p>Revisar integração de chamados</p>
      </Card>,
    )

    const card = screen.getByTestId('card')
    expect(card.textContent).toContain('Revisar integração de chamados')
    expect(card.className).toContain('card')
    expect(card.className).toContain('extra')
  })
})
