import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GlassToast } from './GlassToast'

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

async function advance(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

function timeBar(): HTMLElement {
  const bar = screen.getByRole('status').querySelector<HTMLElement>('[aria-hidden="true"] > div')
  if (!bar) throw new Error('barra de tempo ausente')
  return bar
}

beforeEach(() => {
  stubMotion(false)
  vi.useFakeTimers()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('GlassToast', () => {
  it('expõe o aviso como status com botão de ação e atalho', () => {
    render(
      <GlassToast
        message="AB-142 arquivada"
        actionLabel="Desfazer"
        actionShortcut="Ctrl Z"
        onDismiss={vi.fn()}
      />,
    )

    expect(screen.getByRole('status').textContent).toContain('AB-142 arquivada')
    expect(screen.getByRole('button', { name: 'Desfazer' }).textContent).toContain('Ctrl Z')
  })

  it('chama a ação e fecha ao clicar em Desfazer', () => {
    const onAction = vi.fn()
    const onDismiss = vi.fn()
    render(
      <GlassToast
        message="AB-142 arquivada"
        actionLabel="Desfazer"
        onAction={onAction}
        onDismiss={onDismiss}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Desfazer' }))

    expect(onAction).toHaveBeenCalledOnce()
    expect(onDismiss).toHaveBeenCalledOnce()
  })

  it('some sozinho após 8 segundos, com a barra descendo', async () => {
    const onDismiss = vi.fn()
    render(<GlassToast message="Tarefa arquivada" onDismiss={onDismiss} />)

    await advance(4000)
    expect(timeBar().style.transform).toBe('scaleX(0.5)')
    expect(onDismiss).not.toHaveBeenCalled()

    await advance(3999)
    expect(onDismiss).not.toHaveBeenCalled()

    await advance(1)
    expect(onDismiss).toHaveBeenCalledOnce()
  })

  it('pausa o cronômetro enquanto o foco está no aviso e retoma ao sair', async () => {
    const onDismiss = vi.fn()
    render(
      <GlassToast
        message="AB-142 arquivada"
        actionLabel="Desfazer"
        onAction={vi.fn()}
        onDismiss={onDismiss}
      />,
    )

    await advance(4000)
    act(() => screen.getByRole('button', { name: 'Desfazer' }).focus())
    await advance(10000)
    expect(onDismiss).not.toHaveBeenCalled()

    act(() => {
      ;(document.activeElement as HTMLElement).blur()
    })
    await advance(3900)
    expect(onDismiss).not.toHaveBeenCalled()

    await advance(100)
    expect(onDismiss).toHaveBeenCalledOnce()
  })

  it('com movimento reduzido, a barra anda em degraus de 1 segundo', async () => {
    stubMotion(true)
    render(<GlassToast message="Tarefa arquivada" onDismiss={vi.fn()} />)

    await advance(500)
    expect(timeBar().style.transform).toBe('scaleX(1)')

    await advance(500)
    expect(timeBar().style.transform).toBe('scaleX(0.875)')
  })
})
