import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Gallery } from './Gallery'

afterEach(cleanup)

describe('Galeria de componentes', () => {
  it('renderiza os componentes e estados de demonstração sem erros', () => {
    render(<Gallery />)

    expect(screen.getByRole('main', { name: 'Galeria de componentes' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Superfícies' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Campos' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Estados e feedback' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Diálogos e menus' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Abrir modal de exemplo' })).toBeTruthy()
    expect(screen.getByRole('menuitemradio', { name: 'A fazer' })).toBeTruthy()
    expect(screen.getByRole('group', { name: 'Visualização de demonstração' })).toBeTruthy()
    expect(screen.getByRole('group', { name: 'Opções de demonstração' })).toBeTruthy()
    expect(screen.getByLabelText('Campo desabilitado')).toBeTruthy()
    expect(screen.getByText('Alterações salvas')).toBeTruthy()
    expect(screen.getByText('Passo 2 de 3')).toBeTruthy()
    expect(screen.getByText('AB-118')).toBeTruthy()
    expect(screen.getByRole('tooltip')).toBeTruthy()
  })

  it('demonstra a troca de opção e a abertura e o fechamento do modal', () => {
    render(<Gallery />)

    fireEvent.click(screen.getByRole('button', { name: 'Lista' }))
    expect(screen.getByRole('button', { name: 'Lista' }).getAttribute('aria-pressed')).toBe('true')

    fireEvent.click(screen.getByRole('button', { name: 'Abrir modal de exemplo' }))
    expect(screen.getByRole('dialog', { name: 'Exemplo de modal' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Fechar modal' }))
    expect(screen.queryByRole('dialog', { name: 'Exemplo de modal' })).toBeNull()
  })
})
