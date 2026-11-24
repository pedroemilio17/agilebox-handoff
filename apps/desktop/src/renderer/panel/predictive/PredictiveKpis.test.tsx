import { cleanup, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { TrackingViewDto } from '@agilebox/contract'
import { createFakeApi } from '../../shared/testing/fake-api'
import { renderPanel } from '../../shared/testing/render-panel'
import { PredictiveKpis } from './PredictiveKpis'

const PROJECT_ID = '01J8Y4G2XK8Z1S6M3Q9W0FGHKA'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

/** Números de exemplo do acompanhamento, com custo (gestor) ou sem custo (colaborador). */
function tracking(overrides: Partial<TrackingViewDto['summary']> & { costEnabled?: boolean } = {}) {
  const { costEnabled = true, ...summary } = overrides
  const value: TrackingViewDto = {
    projectId: PROJECT_ID,
    costEnabled,
    week: null,
    summary: {
      progress: 64,
      plannedHours: 100,
      loggedHours: 40,
      realizedCost: 18420,
      plannedCost: 22000,
      tasks: { total: 14, done: 9 },
      ...summary,
    },
    nextMilestone: null,
    milestones: [],
    today: '2026-11-22',
  }
  return value
}

function setup(data: TrackingViewDto) {
  const api = createFakeApi()
  vi.spyOn(api.tracking, 'get').mockResolvedValue(data)
  renderPanel(<PredictiveKpis projectId={PROJECT_ID} />, { api })
}

describe('indicadores do Fluxo Preditivo', () => {
  it('mostra concluído e, para o gestor, realizado sobre planejado', async () => {
    setup(tracking())
    expect(await screen.findByText('64%')).toBeTruthy()
    expect(screen.getByText('9 de 14 tarefas finalizadas')).toBeTruthy()
    expect(screen.getByText('Realizado / Planejado')).toBeTruthy()
    expect(screen.getByText('Gestor')).toBeTruthy()
    expect(screen.getByText('83,7% do orçamento usado')).toBeTruthy()
  })

  it('colaborador não vê R$: o servidor manda o custo nulo e o indicador some', async () => {
    setup(tracking({ realizedCost: null, plannedCost: null }))
    await screen.findByText('64%')
    expect(screen.queryByText('Realizado / Planejado')).toBeNull()
    expect(screen.queryByText(/R\$/)).toBeNull()
  })

  it('projeto sem o módulo de custo não mostra o indicador de custo', async () => {
    setup(tracking({ costEnabled: false }))
    await screen.findByText('64%')
    expect(screen.queryByText('Realizado / Planejado')).toBeNull()
  })

  it('sem orçamento previsto mostra só o realizado, sem percentual', async () => {
    setup(tracking({ plannedCost: null }))
    await screen.findByText('Realizado / Planejado')
    expect(screen.getByText(/R\$/)).toBeTruthy()
    expect(screen.queryByText(/do orçamento usado/)).toBeNull()
  })
})
