import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Toast, useToast } from './Toast'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('Toast', () => {
  it('expõe o aviso como status e o oculta após cerca de 2,6 segundos', async () => {
    vi.useFakeTimers()
    render(<Toast message="Tarefa salva" />)

    expect(screen.getByRole('status').textContent).toContain('Tarefa salva')
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2600)
    })
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('permite mostrar avisos pelo hook useToast', async () => {
    function Harness() {
      const { message, showToast } = useToast()
      return (
        <>
          <button type="button" onClick={() => showToast('Alterações salvas')}>
            Salvar
          </button>
          {message ? <Toast message={message} /> : null}
        </>
      )
    }

    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(screen.getByRole('status').textContent).toContain('Alterações salvas')
  })
})
