import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { UpdateRun, UpdateStatus } from '@agilebox/contract'
import { UpdatesSection } from './UpdatesSection'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function stub(check: UpdateStatus, apply: UpdateStatus = { state: 'started' }) {
  const updates = {
    check: vi.fn(() => Promise.resolve(check)),
    apply: vi.fn(() => Promise.resolve(apply)),
    lastRun: vi.fn((): Promise<UpdateRun | null> => Promise.resolve(null)),
  }
  vi.stubGlobal('agilebox', { updates })
  return updates
}

describe('Ajustes: atualizações', () => {
  it('procura, lista os commits novos e atualiza', async () => {
    const updates = stub({ state: 'available', behind: 2, commits: ['feat: a', 'fix: b'] })
    const user = userEvent.setup()
    render(<UpdatesSection />)
    expect(screen.queryByRole('button', { name: 'Atualizar e reiniciar' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Procurar atualizações' }))
    expect(await screen.findByText('Há 2 atualizações disponíveis:')).toBeTruthy()
    expect(screen.getByText('fix: b')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Atualizar e reiniciar' }))
    expect(updates.apply).toHaveBeenCalledTimes(1)
    expect(await screen.findByText(/vai fechar e reabrir/)).toBeTruthy()
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
})
