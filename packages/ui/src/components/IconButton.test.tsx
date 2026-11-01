import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { IconButton } from './IconButton'

afterEach(cleanup)

describe('IconButton', () => {
  it('expõe o rótulo acessível obrigatório', () => {
    render(<IconButton aria-label="Fechar">×</IconButton>)
    expect(screen.getByRole('button', { name: 'Fechar' })).toBeTruthy()
  })
})
