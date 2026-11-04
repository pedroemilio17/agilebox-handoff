import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { DueDate } from './DueDate'

afterEach(cleanup)

describe('DueDate', () => {
  it('mostra a data em dd/mm/aaaa dentro de um elemento time', () => {
    const { container } = render(<DueDate date="2026-11-12" />)
    const time = screen.getByText('12/11/2026')
    expect(time.tagName).toBe('TIME')
    expect(time.getAttribute('datetime')).toBe('2026-11-12')
    expect(container.textContent).toBe('12/11/2026')
  })

  it('acrescenta o texto "atrasado" quando está vencido', () => {
    render(<DueDate date="2026-11-01" overdue />)
    expect(screen.getByText('atrasado')).toBeTruthy()
  })

  it('não mostra "atrasado" quando está no prazo', () => {
    render(<DueDate date="2026-11-30" />)
    expect(screen.queryByText('atrasado')).toBeNull()
  })
})
