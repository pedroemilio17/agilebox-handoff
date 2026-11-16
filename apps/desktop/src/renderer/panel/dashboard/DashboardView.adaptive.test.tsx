import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectiveCapabilities, type ExperienceLevel, type ModuleId } from '@agilebox/core'
import type { DashboardDto } from '@agilebox/contract'
import { ApiProvider } from '../../shared/api/ApiProvider'
import {
  buildCapabilities,
  CapabilitiesContext,
} from '../../shared/capabilities/capabilities-context'
import { QueryProvider } from '../../shared/query/QueryProvider'
import { createFakeApi } from '../../shared/testing/fake-api'
import { ALL_MODULES, presetModules } from '../../shared/testing/team-tools-fixture'
import { DashboardView } from './DashboardView'

afterEach(cleanup)

const BRUNO = '01HZBRUNO0000000000000000A'
const ANA = '01HZANA00000000000000000B'

const dashboard: DashboardDto = {
  insights: {
    updatedAt: '2026-11-04T12:00:00Z',
    weekStart: '2026-11-02',
    upToDatePercentage: 75,
    agingCount: 0,
    overdueCount: 0,
    blockedCount: 2,
    overWipColumns: [{ status: 'in_progress', count: 4, limit: 3 }],
    cycleDays: 3,
    leadDays: 5,
    throughput: 2,
    weeks: [
      { start: '2026-11-02', throughput: 2, cycleDays: 3, leadDays: 5, upToDatePercentage: 75 },
    ],
    recentChanges: [],
    team: [
      {
        user: { id: BRUNO, name: 'Bruno Lima', initials: 'BL', role: 'collaborator' as const },
        taskCount: 3,
        completedPercentage: 25,
        inProgress: 2,
        agingCount: 0,
        overdueCount: 0,
        blockedCount: 1,
        lastUpdatedAt: '2026-11-04T10:00:00Z',
      },
      {
        user: { id: ANA, name: 'Ana Souza', initials: 'AS', role: 'collaborator' as const },
        taskCount: 2,
        completedPercentage: 0,
        inProgress: 1,
        agingCount: 0,
        overdueCount: 0,
        blockedCount: 0,
        lastUpdatedAt: '2026-11-04T09:00:00Z',
      },
    ],
  },
  distribution: { planning: 0, todo: 0, in_progress: 0, review: 0, done: 0 },
  collaborators: [],
}

/** Dashboard com as capacidades de um time (ferramentas e nível), como o servidor calcularia. */
function setup(modules: readonly ModuleId[], level: ExperienceLevel) {
  const api = createFakeApi()
  vi.spyOn(api.dashboard, 'get').mockResolvedValue(dashboard)
  const listForDate = vi
    .spyOn(api.daily, 'listForDate')
    .mockResolvedValue([{ userId: BRUNO, userName: 'Bruno Lima', done: true }])
  const capabilities = buildCapabilities(
    effectiveCapabilities({ modules: [...modules], level, role: 'manager' }),
  )
  render(
    <ApiProvider api={api}>
      <QueryProvider>
        <CapabilitiesContext.Provider value={capabilities}>
          <DashboardView
            onNotice={vi.fn()}
            onOpenException={vi.fn()}
            onOpenTask={vi.fn()}
            onOpenProjects={vi.fn()}
          />
        </CapabilitiesContext.Provider>
      </QueryProvider>
    </ApiProvider>,
  )
  return { listForDate }
}

describe('Dashboard adaptativo (M2.1)', () => {
  it('com todas as ferramentas no Avançado mostra bloqueios, WIP e a daily de hoje', async () => {
    const { listForDate } = setup(ALL_MODULES, 'advanced')

    expect(await screen.findByRole('button', { name: /^Bloqueadas/ })).toBeTruthy()
    expect(screen.getByRole('list', { name: 'Colunas acima do limite' })).toBeTruthy()
    expect(await screen.findByText('Daily de hoje · 1 de 2')).toBeTruthy()
    expect(listForDate).toHaveBeenCalled()
  })

  it('módulo desligado não deixa nenhum efeito: sem bloqueios, WIP nem daily, e a daily não é pedida', async () => {
    const { listForDate } = setup(['core'], 'advanced')

    await screen.findByRole('region', { name: 'Equipe' })
    expect(screen.queryByRole('button', { name: /^Bloqueadas/ })).toBeNull()
    expect(screen.queryByRole('list', { name: 'Colunas acima do limite' })).toBeNull()
    expect(screen.queryByText(/Daily de hoje/)).toBeNull()
    expect(screen.queryByText(/bloqueada/)).toBeNull()
    expect(listForDate).not.toHaveBeenCalled()
  })

  it('Scrum no Básico: bloqueios continuam (passivo); daily e WIP não aparecem', async () => {
    const { listForDate } = setup(presetModules('scrum'), 'basic')

    expect(await screen.findByRole('button', { name: /^Bloqueadas/ })).toBeTruthy()
    const team = screen.getByRole('region', { name: 'Equipe' })
    expect(within(team).getByText('1 bloqueada')).toBeTruthy()
    expect(screen.queryByRole('list', { name: 'Colunas acima do limite' })).toBeNull()
    expect(screen.queryByText(/Daily de hoje/)).toBeNull()
    expect(listForDate).not.toHaveBeenCalled()
  })
})
