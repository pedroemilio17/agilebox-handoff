import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FlowMetricsViewDto } from '@agilebox/contract'
import { createFakeApi, emptyFlowMetricsView } from '../../shared/testing/fake-api'
import { renderPanel } from '../../shared/testing/render-panel'
import type { PanelView } from '../layout/PanelShell'
import { FlowMetricsView } from './FlowMetricsView'

const PROJECT_ID = '01J8Y4G2XK8Z1S6M3Q9W0FGHKA'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

/** Três tarefas concluídas nas últimas oito semanas: uma em 22/12 e duas em 29/12. */
function view(overrides: Partial<FlowMetricsViewDto> = {}): FlowMetricsViewDto {
  const starts = [
    '2025-11-10',
    '2025-11-17',
    '2025-11-24',
    '2025-12-01',
    '2025-12-08',
    '2025-12-15',
    '2025-12-22',
    '2025-12-29',
  ]
  return {
    projectId: PROJECT_ID,
    today: '2026-01-02',
    windowStart: '2025-11-10',
    windowEnd: '2026-01-05',
    leadDays: 4.5,
    cycleDays: 4,
    completed: 3,
    weeks: starts.map((start, index) => ({
      start,
      completed: index === 6 ? 1 : index === 7 ? 2 : 0,
    })),
    ...overrides,
  }
}

function renderFlow({
  data = view(),
  projectId = PROJECT_ID,
  onNavigate = vi.fn(),
}: {
  readonly data?: FlowMetricsViewDto
  readonly projectId?: string | null
  readonly onNavigate?: (view: PanelView) => void
} = {}) {
  const api = createFakeApi()
  vi.spyOn(api.flowMetrics, 'get').mockResolvedValue(data)
  renderPanel(
    <FlowMetricsView projectId={projectId} projectName="Implantação ERP" onNavigate={onNavigate} />,
    { api },
  )
  return { api, onNavigate }
}

function card(name: string) {
  return screen.getByRole('region', { name })
}

describe('FlowMetricsView', () => {
  it('mostra o cabeçalho e os três cartões de lead time, cycle time e vazão', async () => {
    renderFlow()

    expect(await screen.findByRole('heading', { name: 'Métricas de fluxo', level: 2 })).toBeTruthy()
    expect(screen.getByText('Implantação ERP · Últimas 8 semanas · 10/11 a 04/01')).toBeTruthy()

    expect(within(card('Lead time médio')).getByText('4,5 dias')).toBeTruthy()
    expect(within(card('Cycle time médio')).getByText('4 dias')).toBeTruthy()
    const throughput = card('Vazão')
    expect(within(throughput).getByText('3')).toBeTruthy()
    expect(within(throughput).getByText('média de 0,4 por semana')).toBeTruthy()
  })

  it('amostra menor que cinco mostra a nota de amostra pequena', async () => {
    renderFlow()
    expect(
      await screen.findByText(
        'Amostra pequena: 3 tarefas concluídas nas últimas 8 semanas. Os números ficam mais firmes com pelo menos 5.',
      ),
    ).toBeTruthy()
  })

  it('com cinco ou mais tarefas concluídas, não mostra a nota', async () => {
    renderFlow({ data: view({ completed: 5 }) })
    await screen.findByRole('img', { name: 'Tarefas concluídas por semana' })
    expect(screen.queryByText(/Amostra pequena/)).toBeNull()
  })

  it('o gráfico é uma imagem com nome e resumo textual, e a tabela traz as oito semanas', async () => {
    const user = userEvent.setup()
    renderFlow()

    const chart = await screen.findByRole('img', { name: 'Tarefas concluídas por semana' })
    expect(chart.querySelector('desc')?.textContent).toContain('Total de 3 tarefas concluídas')
    expect(screen.getAllByText(/Total de 3 tarefas concluídas/).length).toBeGreaterThan(0)

    await user.click(screen.getByText('Ver os valores semana a semana'))
    const table = screen.getByRole('table')
    expect(within(table).getByRole('columnheader', { name: 'Concluídas' })).toBeTruthy()
    const rows = within(table).getAllByRole('row')
    // Cabeçalho + oito semanas.
    expect(rows).toHaveLength(9)
    expect(within(rows[8]!).getByText('29/12')).toBeTruthy()
    expect(within(rows[8]!).getByText('2')).toBeTruthy()
  })

  it('sem tarefa concluída, mostra o estado vazio do módulo e nenhum gráfico', async () => {
    renderFlow({ data: emptyFlowMetricsView(PROJECT_ID) })
    expect(await screen.findByText('Nenhuma tarefa concluída nas últimas 8 semanas.')).toBeTruthy()
    expect(screen.queryByRole('img', { name: 'Tarefas concluídas por semana' })).toBeNull()
    expect(within(card('Lead time médio')).getByText('—')).toBeTruthy()
  })

  it('não mostra valores de custo', async () => {
    renderFlow()
    await screen.findByRole('region', { name: 'Vazão' })
    expect(screen.queryByText(/R\$/)).toBeNull()
  })

  it('sem projeto selecionado, pede para escolher um', () => {
    renderFlow({ projectId: null })
    expect(screen.getByText('Escolha um projeto para ver as métricas de fluxo.')).toBeTruthy()
  })

  it('erro de carga mostra alerta e tenta de novo', async () => {
    const user = userEvent.setup()
    const api = createFakeApi()
    const spy = vi
      .spyOn(api.flowMetrics, 'get')
      .mockRejectedValueOnce(new Error('falha'))
      .mockResolvedValue(view())
    renderPanel(<FlowMetricsView projectId={PROJECT_ID} projectName={null} />, { api })

    expect(await screen.findByRole('alert')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(2))
    expect(await screen.findByRole('region', { name: 'Lead time médio' })).toBeTruthy()
  })
})
