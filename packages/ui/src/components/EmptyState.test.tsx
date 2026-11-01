import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { EmptyState } from './EmptyState'

afterEach(cleanup)

describe('EmptyState', () => {
  it('expõe o título e a descrição em um estado acessível', () => {
    render(<EmptyState title="Sem tarefas" description="Crie uma para começar." />)
    expect(
      screen.getByRole('status', { name: 'Sem tarefas' }).getAttribute('aria-labelledby'),
    ).toBeTruthy()
    expect(screen.getByText('Crie uma para começar.')).toBeTruthy()
  })
})
