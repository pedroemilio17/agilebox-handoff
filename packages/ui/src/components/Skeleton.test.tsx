import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Skeleton } from './Skeleton'

afterEach(cleanup)

describe('Skeleton', () => {
  it('indica carregamento com semântica de status', () => {
    render(<Skeleton aria-label="Carregando tarefas" />)
    expect(
      screen.getByRole('status', { name: 'Carregando tarefas' }).getAttribute('aria-busy'),
    ).toBe('true')
  })
})
