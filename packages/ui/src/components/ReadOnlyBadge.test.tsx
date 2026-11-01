import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ReadOnlyBadge } from './ReadOnlyBadge'

afterEach(cleanup)

describe('ReadOnlyBadge', () => {
  it('informa que o conteúdo é somente leitura', () => {
    render(<ReadOnlyBadge />)
    expect(screen.getByText('Somente leitura')).toBeTruthy()
  })
})
