import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Button } from './Button'

afterEach(cleanup)

describe('Button', () => {
  it('renderiza o estilo primário e permanece habilitado', () => {
    render(<Button variant="primary">Salvar</Button>)
    expect(screen.getByRole('button', { name: 'Salvar' }).className).toContain('primary')
    expect(screen.getByRole('button').hasAttribute('disabled')).toBe(false)
  })

  it('impede interação quando está desabilitado', () => {
    render(<Button disabled>Salvar</Button>)
    expect(screen.getByRole('button', { name: 'Salvar' }).hasAttribute('disabled')).toBe(true)
  })
})
