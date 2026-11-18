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
import { BRUNO, dashboardFixture, insightsFixture } from './dashboard-fixtures'

afterEach(cleanup)

const dashboard: DashboardDto = dashboardFixture()

/** Painel sem os campos de fluxo: é o que o servidor devolve com `flowMetrics` desligado (o cartão usa o progresso). */
const dashboardWithoutFlow: DashboardDto = dashboardFixture(
  insightsFixture({
    weeks: undefined,
    upToDatePercentage: undefined,
    cycleDays: undefined,
    leadDays: undefined,
    throughput: undefined,
  }),
)

/** Dashboard com as capacidades de um time (ferramentas e nível), como o servidor calcularia. */
function setup(
  modules: readonly ModuleId[],
  level: ExperienceLevel,
  payload: DashboardDto = dashboard,
) {
  const api = createFakeApi()
  vi.spyOn(api.dashboard, 'get').mockResolvedValue(payload)
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
            onOpenProject={vi.fn()}
            onOpenTask={vi.fn()}
            onOpenUpdates={vi.fn()}
            onOpenProjects={vi.fn()}
          />
        </CapabilitiesContext.Provider>
      </QueryProvider>
    </ApiProvider>,
  )
  return { listForDate }
}

describe('Dashboard adaptativo (M2.1), no layout do desenho', () => {
  it('com todas as ferramentas no Avançado mostra WIP em Precisa de você e a coluna Diária de hoje', async () => {
    const { listForDate } = setup(ALL_MODULES, 'advanced')

    const needs = await screen.findByRole('list', { name: 'Precisa de você' })
    expect(within(needs).getByText('Desenvolvendo está com 4 de 3.')).toBeTruthy()
    expect(await screen.findByText('Diária de hoje')).toBeTruthy()
    expect(listForDate).toHaveBeenCalled()
  })

  it('módulo desligado não deixa nenhum efeito: sem WIP, sem coluna de daily, e a daily não é pedida', async () => {
    const { listForDate } = setup(['core'], 'advanced')

    await screen.findByRole('region', { name: 'Equipe em todos os projetos' })
    expect(screen.queryByText('Desenvolvendo está com 4 de 3.')).toBeNull()
    expect(screen.queryByText('Diária de hoje')).toBeNull()
    expect(screen.queryByText('✓ respondida')).toBeNull()
    expect(listForDate).not.toHaveBeenCalled()
  })

  it('Scrum no Básico: o bloqueio segue como sinal (passivo); daily e WIP não aparecem', async () => {
    const { listForDate } = setup(presetModules('scrum'), 'basic')

    const team = await screen.findByRole('region', { name: 'Equipe em todos os projetos' })
    expect(within(team).getByText('1 bloqueada')).toBeTruthy()
    expect(screen.queryByText('Desenvolvendo está com 4 de 3.')).toBeNull()
    expect(screen.queryByText('Diária de hoje')).toBeNull()
    expect(listForDate).not.toHaveBeenCalled()
  })

  it('sem fluxo no DTO: o cartão Kanban some do fluxo e o cartão com progresso segue, sem erro', async () => {
    setup(ALL_MODULES, 'advanced', dashboardWithoutFlow)

    const team = await screen.findByRole('region', { name: 'Equipe em todos os projetos' })
    expect(within(team).getByText('Bruno Lima')).toBeTruthy()
    expect(screen.getByRole('article', { name: 'Implantação ERP' })).toBeTruthy()
    expect(screen.queryByText(/Lead time médio/)).toBeNull()
  })
})
