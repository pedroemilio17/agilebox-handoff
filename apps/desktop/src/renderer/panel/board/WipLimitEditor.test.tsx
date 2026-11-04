import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { WipLimitEditor } from './WipLimitEditor'

afterEach(cleanup)

function renderEditor(limit: number | null = 3) {
  const onSave = vi.fn()
  render(<WipLimitEditor columnName="Desenvolvendo" limit={limit} onSave={onSave} />)
  return { onSave, user: userEvent.setup() }
}

describe('WipLimitEditor', () => {
  it('abre o painel pelo botão com o nome da coluna no aria-label', async () => {
    const { user } = renderEditor()
    await user.click(screen.getByRole('button', { name: 'Definir limite de Desenvolvendo' }))

    expect(screen.getByRole('dialog', { name: 'Limite de Desenvolvendo' })).toBeTruthy()
    expect(screen.getByLabelText<HTMLInputElement>('Limite de tarefas').value).toBe('3')
  })

  it('salva um limite válido e fecha o painel', async () => {
    const { onSave, user } = renderEditor(null)
    await user.click(screen.getByRole('button', { name: 'Definir limite de Desenvolvendo' }))
    await user.type(screen.getByLabelText('Limite de tarefas'), '5')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(onSave).toHaveBeenCalledWith(5)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('aceita os extremos 1 e 99', async () => {
    const { onSave, user } = renderEditor(null)
    await user.click(screen.getByRole('button', { name: 'Definir limite de Desenvolvendo' }))
    await user.type(screen.getByLabelText('Limite de tarefas'), '99')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(onSave).toHaveBeenLastCalledWith(99)

    await user.click(screen.getByRole('button', { name: 'Definir limite de Desenvolvendo' }))
    await user.clear(screen.getByLabelText('Limite de tarefas'))
    await user.type(screen.getByLabelText('Limite de tarefas'), '1')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(onSave).toHaveBeenLastCalledWith(1)
  })

  it('recusa 0 e 100 com a mensagem em português, sem salvar', async () => {
    const { onSave, user } = renderEditor(null)
    await user.click(screen.getByRole('button', { name: 'Definir limite de Desenvolvendo' }))
    const input = screen.getByLabelText('Limite de tarefas')

    await user.type(input, '0')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.getByText('Use um número de 1 a 99.')).toBeTruthy()
    expect(input.getAttribute('aria-invalid')).toBe('true')

    await user.clear(input)
    await user.type(input, '100')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(screen.getByText('Use um número de 1 a 99.')).toBeTruthy()
    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  it('remove o limite pelo botão Remover limite', async () => {
    const { onSave, user } = renderEditor(3)
    await user.click(screen.getByRole('button', { name: 'Definir limite de Desenvolvendo' }))
    await user.click(screen.getByRole('button', { name: 'Remover limite' }))

    expect(onSave).toHaveBeenCalledWith(null)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('desabilita Remover limite quando não há limite', async () => {
    const { user } = renderEditor(null)
    await user.click(screen.getByRole('button', { name: 'Definir limite de Desenvolvendo' }))

    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Remover limite' }).disabled).toBe(
      true,
    )
  })

  it('cancelar e Esc fecham sem salvar', async () => {
    const { onSave, user } = renderEditor(3)
    await user.click(screen.getByRole('button', { name: 'Definir limite de Desenvolvendo' }))
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('dialog')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Definir limite de Desenvolvendo' }))
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(onSave).not.toHaveBeenCalled()
  })
})
