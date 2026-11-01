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
    await user.click(screen.getByRole('button', { name: 'Procurar atualizações' }))
    expect(await screen.findByText('Há 2 atualizações disponíveis:')).toBeTruthy()
    expect(screen.getByText('fix: b')).toBeTruthy()
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
    await user.click(screen.getByRole('button', { name: 'Procurar atualizações' }))
    await user.click(await screen.findByRole('button', { name: 'Baixar e instalar' }))
    act(() => updates.emit('install'))
    expect(await screen.findByText(/Instalando dependências/)).toBeTruthy()
    act(() => finish({ state: 'ready' }))
    expect(await screen.findByRole('button', { name: 'Reiniciar agora' })).toBeTruthy()
  })

  it('avisa quando já está atualizado ou quando há alterações locais', async () => {
    stub({ state: 'up-to-date', commit: 'abc1234' })
    const user = userEvent.setup()
    render(<UpdatesSection />)
    await user.click(screen.getByRole('button', { name: 'Procurar atualizações' }))
    expect(await screen.findByText(/versão mais nova \(abc1234\)/)).toBeTruthy()
    cleanup()
    stub({ state: 'dirty', files: 3 })
    render(<UpdatesSection />)
    await user.click(screen.getByRole('button', { name: 'Procurar atualizações' }))
    expect(await screen.findByText(/Há 3 arquivo/)).toBeTruthy()
  })

  it('mostra a última atualização que falhou, com o registro', async () => {
    const updates = stub({ state: 'up-to-date', commit: 'x' })
    updates.lastRun.mockResolvedValue({
      ok: false,
      at: '2026-11-01T12:00:00.000Z',
      logPath: 'C:\\agilebox\\update.log',
      message: 'pnpm install falhou',
    })
    render(<UpdatesSection />)
    expect(await screen.findByText(/falhou/)).toBeTruthy()
    expect(screen.getByText('C:\\agilebox\\update.log')).toBeTruthy()
  })

  it('mostra a versão instalada e de onde vem a atualização', async () => {
    stub({ state: 'up-to-date', commit: '0.2.0' })
    render(<UpdatesSection />)
    expect(await screen.findByText(/Versão 0\.2\.0 · instalada/)).toBeTruthy()
  })
})
