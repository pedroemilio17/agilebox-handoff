import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { UNDO_FAILED_MESSAGE, UndoProvider, useUndo } from './UndoProvider'

function stubMotion(reduced: boolean): void {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      matches: reduced,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  )
}

/** Dois botões que oferecem desfazer, com o `undo` de cada um. */
function Offerers({
  first,
  second,
}: {
  first: () => Promise<unknown>
  second?: () => Promise<unknown>
}) {
  const { offer } = useUndo()
  return (
    <>
      <button
        type="button"
        onClick={() => offer({ message: 'Tarefa “Revisar integração” arquivada', undo: first })}
      >
        Arquivar A
      </button>
      {second ? (
        <button
          type="button"
          onClick={() => offer({ message: 'Projeto “Aurora” arquivado', undo: second })}
        >
          Arquivar B
        </button>
      ) : null}
      <input aria-label="Campo de texto" />
    </>
  )
}

function renderWith(first: () => Promise<unknown>, second?: () => Promise<unknown>) {
  render(
    <UndoProvider>
      <Offerers first={first} {...(second ? { second } : {})} />
    </UndoProvider>,
  )
}

function ctrlZ(target: Element | Document = document.body) {
  fireEvent.keyDown(target, { key: 'z', ctrlKey: true })
}

beforeEach(() => {
  stubMotion(false)
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('UndoProvider', () => {
  it('mostra o aviso como status, com Desfazer e o atalho Ctrl Z', () => {
    renderWith(vi.fn(() => Promise.resolve()))
    fireEvent.click(screen.getByRole('button', { name: 'Arquivar A' }))

    const toast = screen.getByRole('status')
    expect(toast.textContent).toContain('Tarefa “Revisar integração” arquivada')
    expect(toast.textContent).toContain('Desfazer')
    expect(toast.textContent).toContain('Ctrl Z')
  })

  it('o botão Desfazer chama a ação de volta e fecha o aviso', async () => {
    const undo = vi.fn(() => Promise.resolve())
    renderWith(undo)
    fireEvent.click(screen.getByRole('button', { name: 'Arquivar A' }))

    await userEvent.click(screen.getByRole('button', { name: /Desfazer/ }))

    expect(undo).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('Ctrl Z chama a ação de volta e fecha o aviso', () => {
    const undo = vi.fn(() => Promise.resolve())
    renderWith(undo)
    fireEvent.click(screen.getByRole('button', { name: 'Arquivar A' }))

    ctrlZ()

    expect(undo).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('Ctrl Z dentro de um campo de texto não desfaz a ação', () => {
    const undo = vi.fn(() => Promise.resolve())
    renderWith(undo)
    fireEvent.click(screen.getByRole('button', { name: 'Arquivar A' }))

    ctrlZ(screen.getByLabelText('Campo de texto'))

    expect(undo).not.toHaveBeenCalled()
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('sem aviso, Ctrl Z não faz nada', () => {
    const undo = vi.fn(() => Promise.resolve())
    renderWith(undo)

    ctrlZ()

    expect(undo).not.toHaveBeenCalled()
  })

  it('some sozinho depois de 8 s, sem desfazer', () => {
    vi.useFakeTimers()
    const undo = vi.fn(() => Promise.resolve())
    renderWith(undo)
    fireEvent.click(screen.getByRole('button', { name: 'Arquivar A' }))

    act(() => {
      vi.advanceTimersByTime(7900)
    })
    expect(screen.getByRole('status')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(screen.queryByRole('status')).toBeNull()
    expect(undo).not.toHaveBeenCalled()
  })

  it('um aviso novo espera na fila: só o primeiro aparece, e Ctrl Z desfaz esse', () => {
    const first = vi.fn(() => Promise.resolve())
    const second = vi.fn(() => Promise.resolve())
    renderWith(first, second)
    fireEvent.click(screen.getByRole('button', { name: 'Arquivar A' }))
    fireEvent.click(screen.getByRole('button', { name: 'Arquivar B' }))

    expect(screen.getByRole('status').textContent).toContain(
      'Tarefa “Revisar integração” arquivada',
    )
    expect(screen.queryByText(/Projeto “Aurora” arquivado/)).toBeNull()

    ctrlZ()

    expect(first).toHaveBeenCalledTimes(1)
    expect(second).not.toHaveBeenCalled()
    expect(screen.getByRole('status').textContent).toContain('Projeto “Aurora” arquivado')
  })

  it('Ctrl Z seguidos desfazem um aviso de cada vez, sem repetir o mesmo', () => {
    const first = vi.fn(() => Promise.resolve())
    const second = vi.fn(() => Promise.resolve())
    renderWith(first, second)
    fireEvent.click(screen.getByRole('button', { name: 'Arquivar A' }))
    fireEvent.click(screen.getByRole('button', { name: 'Arquivar B' }))

    ctrlZ()
    ctrlZ()
    ctrlZ()

    expect(first).toHaveBeenCalledTimes(1)
    expect(second).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('quando o aviso atual expira, o próximo da fila aparece e não é desfeito', () => {
    vi.useFakeTimers()
    const first = vi.fn(() => Promise.resolve())
    const second = vi.fn(() => Promise.resolve())
    renderWith(first, second)
    fireEvent.click(screen.getByRole('button', { name: 'Arquivar A' }))
    fireEvent.click(screen.getByRole('button', { name: 'Arquivar B' }))

    act(() => {
      vi.advanceTimersByTime(8100)
    })

    expect(screen.getByRole('status').textContent).toContain('Projeto “Aurora” arquivado')
    expect(first).not.toHaveBeenCalled()
    expect(second).not.toHaveBeenCalled()
  })

  it('mostra alerta quando desfazer falha', async () => {
    renderWith(vi.fn(() => Promise.reject(new Error('falhou'))))
    fireEvent.click(screen.getByRole('button', { name: 'Arquivar A' }))

    fireEvent.click(screen.getByRole('button', { name: /Desfazer/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent(UNDO_FAILED_MESSAGE)
  })

  it('o alerta de erro some sozinho depois de alguns segundos', async () => {
    vi.useFakeTimers()
    renderWith(vi.fn(() => Promise.reject(new Error('falhou'))))
    fireEvent.click(screen.getByRole('button', { name: 'Arquivar A' }))
    fireEvent.click(screen.getByRole('button', { name: /Desfazer/ }))
    await act(() => Promise.resolve())
    expect(screen.getByRole('alert')).toHaveTextContent(UNDO_FAILED_MESSAGE)

    act(() => {
      vi.advanceTimersByTime(5000)
    })

    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('um aviso novo tira o alerta de erro de um desfazer anterior', async () => {
    renderWith(
      vi.fn(() => Promise.reject(new Error('falhou'))),
      vi.fn(() => Promise.resolve()),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Arquivar A' }))
    fireEvent.click(screen.getByRole('button', { name: /Desfazer/ }))
    expect(await screen.findByRole('alert')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Arquivar B' }))

    expect(screen.queryByRole('alert')).toBeNull()
  })
})

describe('useUndo', () => {
  it('falha com mensagem clara quando não há UndoProvider acima', () => {
    function Lonely() {
      useUndo()
      return null
    }
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    expect(() => render(<Lonely />)).toThrow(/UndoProvider/)
    error.mockRestore()
  })
})
