import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ScopeBanner } from './ScopeBanner'

afterEach(cleanup)

describe('ScopeBanner', () => {
  it('mostra o nome da visão e o selo de somente leitura', () => {
    render(<ScopeBanner>Visão da equipe</ScopeBanner>)
    expect(screen.getByText('Visão da equipe')).toBeTruthy()
    expect(screen.getByText('Somente leitura')).toBeTruthy()
  })

  it('deixa o separador "·" fora da leitura de tela', () => {
    render(<ScopeBanner>Visão da equipe</ScopeBanner>)
    expect(screen.getByText('·').getAttribute('aria-hidden')).toBe('true')
  })
})
