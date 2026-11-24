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

  it('suporta variantes ghost e danger além de tamanho compacto sm', () => {
    render(
      <>
        <Button variant="ghost" size="sm">
          Cancelar
        </Button>
        <Button variant="danger" shortcut="Del">
          Excluir
        </Button>
      </>,
    )

    const ghost = screen.getByRole('button', { name: 'Cancelar' })
    expect(ghost.className).toContain('ghost')
    expect(ghost.className).toContain('sm')

    const danger = screen.getByRole('button', { name: /Excluir/ })
    expect(danger.className).toContain('danger')
    expect(danger.textContent).toContain('Del')
  })
})
