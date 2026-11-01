import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Modal } from './Modal'

afterEach(cleanup)

describe('Modal', () => {
  it('renderiza um diálogo modal, prende o foco e devolve-o ao fechar', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    function Harness() {
      const [open, setOpen] = useState(false)
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Abrir diálogo
          </button>
          <Modal
            open={open}
            title="Editar tarefa"
            onClose={() => {
              onClose()
              setOpen(false)
            }}
          >
            <button type="button">Salvar</button>
            <button type="button">Cancelar</button>
          </Modal>
        </>
      )
    }
    render(<Harness />)

    await user.click(screen.getByRole('button', { name: 'Abrir diálogo' }))
    expect(screen.getByRole('dialog', { name: 'Editar tarefa' }).getAttribute('aria-modal')).toBe(
      'true',
    )
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Salvar' }))
    await user.keyboard('{Shift>}{Tab}{/Shift}')
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancelar' }))
    await user.keyboard('{Escape}')

    expect(onClose).toHaveBeenCalledOnce()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Abrir diálogo' }))
  })

  it('fecha quando o fundo é acionado', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <Modal open title="Confirmação" onClose={onClose}>
        Conteúdo
      </Modal>,
    )

    await user.click(screen.getByTestId('modal-backdrop'))
    expect(onClose).toHaveBeenCalledOnce()
  })
})
