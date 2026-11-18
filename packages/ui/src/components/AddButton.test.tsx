import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AddButton } from './AddButton'

describe('AddButton', () => {
  it('mostra o "+" decorativo e expõe só o rótulo como nome acessível', () => {
    const { container } = render(<AddButton type="button">Adicionar subtarefa</AddButton>)

    const button = screen.getByRole('button', { name: 'Adicionar subtarefa' })
    expect(button.getAttribute('type')).toBe('button')
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
  })

  it('dispara o clique e respeita disabled', () => {
    const onClick = vi.fn()
    const { rerender } = render(
      <AddButton type="button" onClick={onClick}>
        Adicionar critério
      </AddButton>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Adicionar critério' }))
    expect(onClick).toHaveBeenCalledTimes(1)

    rerender(
      <AddButton type="button" disabled onClick={onClick}>
        Adicionar critério
      </AddButton>,
    )
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'Adicionar critério' }).disabled,
    ).toBe(true)
  })
})
