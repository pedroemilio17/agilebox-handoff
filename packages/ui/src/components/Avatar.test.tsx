import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Avatar } from './Avatar'

afterEach(cleanup)

describe('Avatar', () => {
  it('mostra as iniciais e o nome acessível', () => {
    render(<Avatar name="Pedro Oliveira" />)
    expect(screen.getByRole('img', { name: 'Pedro Oliveira' }).textContent).toBe('PO')
  })
})
