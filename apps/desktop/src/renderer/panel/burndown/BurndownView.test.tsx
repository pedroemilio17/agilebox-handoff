import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BurndownViewDto } from '@agilebox/contract'
import { createFakeApi, emptyBurndownView } from '../../shared/testing/fake-api'
import { renderPanel } from '../../shared/testing/render-panel'
import type { PanelView } from '../layout/PanelShell'
import { BurndownView } from './BurndownView'
import { burndownSummary, linePath, yAt, CHART } from './burndown-screen'

const PROJECT_ID = '01J8Y4G2XK8Z1S6M3Q9W0FGHKA'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

/** Sprint 4 ativa: 12 h no escopo, 8 h abertas, hoje é o dia 2 de 3. */
function view(overrides: Partial<BurndownViewDto> = {}): BurndownViewDto {
  return {
    projectId: PROJECT_ID,
    today: '2026-01-02',
    sprint: {
      id: '01J8Y4G2XK8Z1S6M3Q9W0FGHM0',
      number: 4,
      name: 'Sprint 4',
      status: 'active',
      plannedStart: '2026-01-01',
      plannedEnd: '2026-01-03',
    },
    totalHours: 12,
    remainingHours: 8,
    scopeTasks: 3,
    doneTasks: 1,
    unestimatedTasks: 0,
    days: [
      { date: '2026-01-01', idealHours: 12, remainingHours: 12 },
      { date: '2026-01-02', idealHours: 6, remainingHours: 8 },
      { date: '2026-01-03', idealHours: 0, remainingHours: null },
    ],
    velocity: {
      average: 4,
      sprints: [{ sprintId: '01J8Y4G2XK8Z1S6M3Q9W0FGHM1', number: 3, name: 'Sprint 3', hours: 4 }],
    },
    ...overrides,
  }
}

function renderBurndown({
  data = view(),
  projectId = PROJECT_ID,
  onNavigate = vi.fn(),
}: {
  readonly data?: BurndownViewDto
  readonly projectId?: string | null
  readonly onNavigate?: (view: PanelView) => void
} = {}) {
  const api = createFakeApi()
  vi.spyOn(api.burndown, 'get').mockResolvedValue(data)
  renderPanel(
    <BurndownView projectId={projectId} projectName="Implantação ERP" onNavigate={onNavigate} />,
    { api },
  )
  return { api, onNavigate }
}

function card(name: string) {
  return screen.getByRole('region', { name })
}

describe('BurndownView', () => {
  it('mostra o cabeçalho, os cartões de horas restantes e de velocidade', async () => {
    renderBurndown()

    expect(await screen.findByRole('heading', { name: 'Burndown', level: 2 })).toBeTruthy()
    expect(screen.getByText('Implantação ERP · Sprint 4 · Ativa · 01/01 a 03/01')).toBeTruthy()

    const remaining = card('Horas restantes')
    expect(within(remaining).getByText('8 h')).toBeTruthy()
    expect(within(remaining).getByText(/de 12 h estimadas/)).toBeTruthy()

    const velocity = card('Velocidade média')
    // "4 h" aparece no valor médio e na linha da Sprint 3.
    expect(within(velocity).getAllByText('4 h')).toHaveLength(2)
    expect(within(velocity).getByText('média de 1 sprint encerrada')).toBeTruthy()
    expect(within(velocity).getByText('Sprint 3')).toBeTruthy()
  })

  it('o gráfico é uma imagem com nome e resumo textual, e a tabela traz os valores por dia', async () => {
    const user = userEvent.setup()
    renderBurndown()

    const chart = await screen.findByRole('img', { name: 'Gráfico de burndown' })
    expect(chart.getAttribute('aria-describedby')).toBeTruthy()
    const summary = burndownSummary(view())
    expect(summary).toContain('Restam 8 h de 12 h estimadas')
    expect(chart.querySelector('desc')?.textContent).toBe(summary)
    // O resumo aparece no parágrafo visível (e no <desc> do SVG, para o leitor de tela).
    expect(screen.getAllByText(summary).length).toBeGreaterThan(0)

    await user.click(screen.getByText('Ver os valores dia a dia'))
    const table = screen.getByRole('table')
    expect(within(table).getByRole('columnheader', { name: 'Ideal (h)' })).toBeTruthy()
    const rows = within(table).getAllByRole('row')
    // Cabeçalho + três dias. O último dia ainda não foi medido.
    expect(rows).toHaveLength(4)
    expect(within(rows[3]!).getByText('—')).toBeTruthy()
  })

  it('sem sprint, mostra o estado vazio do módulo e nenhum gráfico', async () => {
    renderBurndown({ data: emptyBurndownView(PROJECT_ID) })
    expect(await screen.findByText('Nenhuma sprint ativa ou encerrada.')).toBeTruthy()
    expect(screen.queryByRole('img', { name: 'Gráfico de burndown' })).toBeNull()
  })

  it('sem projeto selecionado, pede para escolher um', () => {
    renderBurndown({ projectId: null })
    expect(screen.getByText('Escolha um projeto para ver o burndown.')).toBeTruthy()
  })

  it('erro de carga mostra alerta e tenta de novo', async () => {
    const user = userEvent.setup()
    const api = createFakeApi()
    const spy = vi
      .spyOn(api.burndown, 'get')
      .mockRejectedValueOnce(new Error('falha'))
      .mockResolvedValue(view())
    renderPanel(<BurndownView projectId={PROJECT_ID} projectName={null} />, { api })

    expect(await screen.findByRole('alert')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(2))
    expect(await screen.findByRole('region', { name: 'Horas restantes' })).toBeTruthy()
  })
})

describe('geometria do gráfico', () => {
  it('o eixo vertical vai de zero ao total, e a linha quebra onde não há valor', () => {
    expect(yAt(0, 12)).toBe(CHART.height - CHART.bottom)
    expect(yAt(12, 12)).toBe(CHART.top)
    expect(linePath([{ x: 1, y: 2 }, null, { x: 3, y: 4 }])).toBe('M1.0 2.0 M3.0 4.0')
  })
})
