import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { UpdateRun, UpdateStatus, UpdateStep } from '@agilebox/contract'
import { UpdatesSection } from './UpdatesSection'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function stub(check: UpdateStatus, apply: UpdateStatus = { state: 'ready' }) {
  let progress: ((step: UpdateStep) => void) | undefined
  const updates = {
    check: vi.fn(() => Promise.resolve(check)),
    apply: vi.fn(() => Promise.resolve(apply)),
    restart: vi.fn((): Promise<UpdateStatus> => Promise.resolve({ state: 'started' })),
    lastRun: vi.fn((): Promise<UpdateRun | null> => Promise.resolve(null)),
    info: vi.fn(() => Promise.resolve({ version: '0.2.0', mode: 'release' as const })),
    onProgress: vi.fn((callback: (step: UpdateStep) => void) => {
      progress = callback
      return () => undefined
    }),
    emit: (step: UpdateStep) => progress?.(step),
  }
  vi.stubGlobal('agilebox', { updates })
  return updates
}

describe('Ajustes: atualizações', () => {
  it('procura, baixa e instala com o app aberto e depois reinicia', async () => {
    const updates = stub({ state: 'available', behind: 2, commits: ['feat: a', 'fix: b'] })
    const user = userEvent.setup()
    render(<UpdatesSection />)
    await user.click(screen.getByRole('button', { name: 'Verificar atualizações' }))
    expect(await screen.findByText('Há uma atualização disponível.')).toBeTruthy()
    expect(screen.queryByText('fix: b')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Reiniciar agora' })).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Baixar e instalar' }))
    expect(updates.apply).toHaveBeenCalledTimes(1)
    expect(updates.restart).not.toHaveBeenCalled()
    expect(await screen.findByText(/Versão nova pronta/)).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Reiniciar agora' }))
    expect(updates.restart).toHaveBeenCalledTimes(1)
    expect(await screen.findByText(/reabre em alguns segundos/)).toBeTruthy()
  })

  it('mostra a etapa em andamento enquanto atualiza', async () => {
    const updates = stub({ state: 'available', behind: 1, commits: ['feat: a'] })
    let finish: (status: UpdateStatus) => void = () => undefined
    updates.apply.mockImplementation(() => new Promise((resolve) => (finish = resolve)))
    const user = userEvent.setup()
    render(<UpdatesSection />)
    await user.click(screen.getByRole('button', { name: 'Verificar atualizações' }))
    await user.click(await screen.findByRole('button', { name: 'Baixar e instalar' }))
    act(() => updates.emit('install'))
    expect(await screen.findByText(/Preparando a atualização/)).toBeTruthy()
    act(() => finish({ state: 'ready' }))
    expect(await screen.findByRole('button', { name: 'Reiniciar agora' })).toBeTruthy()
  })

  it('avisa quando já está atualizado ou quando há alterações locais', async () => {
    stub({ state: 'up-to-date', commit: 'abc1234' })
    const user = userEvent.setup()
    render(<UpdatesSection />)
    await user.click(screen.getByRole('button', { name: 'Verificar atualizações' }))
    expect(await screen.findByText('Tudo atualizado.')).toBeTruthy()
    cleanup()
    stub({ state: 'dirty', files: 3 })
    render(<UpdatesSection />)
    await user.click(screen.getByRole('button', { name: 'Verificar atualizações' }))
    expect(await screen.findByText(/alterações locais/)).toBeTruthy()
  })

  it('mostra a última atualização que falhou, sem detalhe técnico', async () => {
    const updates = stub({ state: 'up-to-date', commit: 'x' })
    updates.lastRun.mockResolvedValue({
      ok: false,
      at: '2026-11-01T12:00:00.000Z',
      logPath: 'C:\\agilebox\\update.log',
      message: 'pnpm install falhou',
    })
    render(<UpdatesSection />)
    expect(await screen.findByText(/falhou/)).toBeTruthy()
    expect(screen.queryByText('C:\\agilebox\\update.log')).toBeNull()
  })

  it('mostra a versão instalada e o canal estável', async () => {
    stub({ state: 'up-to-date', commit: '0.2.0' })
    render(<UpdatesSection />)
    expect(await screen.findByText('AgileBox Desktop 0.2.0')).toBeTruthy()
  })
})
