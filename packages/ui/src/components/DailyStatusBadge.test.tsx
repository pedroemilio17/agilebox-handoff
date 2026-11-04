import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { DailyStatusBadge } from './DailyStatusBadge'

afterEach(cleanup)

describe('DailyStatusBadge', () => {
  it('mostra "Feita" como texto, com ícone decorativo', () => {
    const { container } = render(<DailyStatusBadge done />)
    expect(screen.getByText('Feita')).toBeTruthy()
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
  })

  it('mostra "Pendente" como texto, mesmo sem cor', () => {
    render(<DailyStatusBadge done={false} />)
    expect(screen.getByText('Pendente')).toBeTruthy()
    expect(screen.queryByText('Feita')).toBeNull()
  })
})
