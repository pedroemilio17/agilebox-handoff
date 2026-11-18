import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BaselineViewDto } from '@agilebox/contract'
import { createFakeApi } from '../../shared/testing/fake-api'
import { renderPanel } from '../../shared/testing/render-panel'
import type { PanelView } from '../layout/PanelShell'
import { BaselineView } from './BaselineView'

const PROJECT_ID = '01J8Y4G2XK8Z1S6M3Q9W0FGHKA'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

/** Linha de base de exemplo: gestor, com custo visível e uma tarefa atrasada, uma nova e uma removida. */
function view(overrides: Partial<BaselineViewDto> = {}): BaselineViewDto {
  return {
    projectId: PROJECT_ID,
    canTake: true,
    costEnabled: true,
    costVisible: true,
    baseline: {
      id: '01J8Y4G2XK8Z1S6M3Q9W0FGHM0',
      name: 'Linha de base de 02/11/2026',
      takenAt: '2026-11-02T12:00:00.000Z',
      takenByName: 'Gestora',
    },
    summary: {
      plannedEnd: '2026-11-30',
      currentEnd: '2026-12-03',
      endDeviationDays: 3,
      plannedHours: 40,
      currentHours: 46,
      plannedCost: 1800,
      currentCost: 2070,
    },
    tasks: [
      {
        taskId: '01J8Y4G2XK8Z1S6M3Q9W0FGHM1',
        title: 'Levantar requisitos',
        status: 'late',
        delayDays: 3,
        startDelayDays: 0,
        endDelayDays: 3,
        plannedStartsOn: '2026-11-02',
        plannedEndsOn: '2026-11-30',
        currentStartsOn: '2026-11-02',
        currentEndsOn: '2026-12-03',
        hoursDelta: 6,
        costDelta: 270,
      },
      {
        taskId: '01J8Y4G2XK8Z1S6M3Q9W0FGHM2',
        title: 'Desenho da tela',
        status: 'new',
        delayDays: null,
        startDelayDays: null,
        endDelayDays: null,
        plannedStartsOn: null,
        plannedEndsOn: null,
        currentStartsOn: null,
        currentEndsOn: '2026-12-10',
        hoursDelta: null,
        costDelta: null,
      },
      {
        taskId: '01J8Y4G2XK8Z1S6M3Q9W0FGHM3',
        title: 'Plano antigo',
        status: 'removed',
        delayDays: null,
        startDelayDays: null,
        endDelayDays: null,
        plannedStartsOn: '2026-11-02',
        plannedEndsOn: '2026-11-09',
        currentStartsOn: null,
        currentEndsOn: null,
        hoursDelta: null,
        costDelta: null,
      },
    ],
    ...overrides,
  }
}

function renderBaseline({
  data = view(),
  take = vi.fn(),
  onNavigate = vi.fn(),
}: {
  readonly data?: BaselineViewDto
  readonly take?: () => Promise<BaselineViewDto>
  readonly onNavigate?: (view: PanelView) => void
} = {}) {
  const api = createFakeApi()
  vi.spyOn(api.baseline, 'get').mockResolvedValue(data)
  const takeSpy = vi.spyOn(api.baseline, 'take').mockImplementation(take)
  renderPanel(
    <BaselineView projectId={PROJECT_ID} projectName="Implantação ERP" onNavigate={onNavigate} />,
    { api },
  )
  return { api, takeSpy }
}

function card(name: string) {
  return screen.getByRole('region', { name })
}

describe('BaselineView', () => {
  it('mostra o cabeçalho com o projeto e os cartões de fim, desvio, horas e custo', async () => {
    renderBaseline()

    expect(await screen.findByRole('heading', { name: 'Linha de base', level: 2 })).toBeTruthy()
    expect(screen.getByText('Implantação ERP')).toBeTruthy()
    expect(within(card('Fim planejado')).getByText('seg 30/11')).toBeTruthy()
    expect(within(card('Fim atual')).getByText('qui 03/12')).toBeTruthy()

    const deviation = card('Desvio em dias')
    expect(within(deviation).getByText('+3 d')).toBeTruthy()
    expect(within(deviation).getByText('Fim atrasado')).toBeTruthy()

    const hours = card('Horas')
    expect(within(hours).getByText('46 h')).toBeTruthy()
    expect(within(hours).getByText('40 h planejado')).toBeTruthy()

    const cost = card('Custo')
    expect(within(cost).getByText(/^R\$\s2\.070,00$/)).toBeTruthy()
    expect(within(cost).getByText(/^R\$\s1\.800,00 planejado$/)).toBeTruthy()
  })

  it('a tabela diz a situação em texto: Atrasada 3 d, Nova e Removida', async () => {
    renderBaseline()

    const table = await screen.findByRole('table', { name: 'Lista de desvios por tarefa' })
    const late = within(table).getByText('Levantar requisitos').closest('tr')
    expect(late && within(late).getByText('Atrasada 3 d')).toBeTruthy()
    expect(late && within(late).getByText('+6 h')).toBeTruthy()
    expect(late && within(late).getByText(/^\+R\$\s270,00$/)).toBeTruthy()

    const added = within(table).getByText('Desenho da tela').closest('tr')
    expect(added && within(added).getByText('Nova')).toBeTruthy()

    const removed = within(table).getByText('Plano antigo').closest('tr')
    expect(removed && within(removed).getByText('Removida')).toBeTruthy()
  })

  it('quem não vê valores não vê o cartão de custo nem a coluna de custo', async () => {
    renderBaseline({
      data: view({
        summary: { ...view().summary!, plannedCost: null, currentCost: null },
        tasks: view().tasks.map((row) => ({ ...row, costDelta: null })),
        canTake: false,
        costVisible: false,
      }),
    })

    expect(await screen.findByRole('table', { name: 'Lista de desvios por tarefa' })).toBeTruthy()
    expect(screen.queryByRole('region', { name: 'Custo' })).toBeNull()
    expect(screen.queryByRole('columnheader', { name: 'Custo' })).toBeNull()
    expect(screen.queryByText(/R\$/)).toBeNull()
    expect(within(card('Horas')).getByText('46 h')).toBeTruthy()
  })

  it('com o módulo cost desligado, o custo some e as horas seguem', async () => {
    renderBaseline({
      data: view({
        costEnabled: false,
        costVisible: false,
        summary: { ...view().summary!, plannedCost: null, currentCost: null },
      }),
    })
    expect(await screen.findByRole('table', { name: 'Lista de desvios por tarefa' })).toBeTruthy()
    expect(screen.queryByRole('region', { name: 'Custo' })).toBeNull()
    expect(within(card('Horas')).getByText('46 h')).toBeTruthy()
  })

  it('o botão de tirar foto aparece só para quem pode, e pede confirmação antes de gravar', async () => {
    const user = userEvent.setup()
    const { takeSpy } = renderBaseline({
      take: () => Promise.resolve(view({ canTake: true })),
    })

    await user.click(await screen.findByRole('button', { name: 'Tirar nova foto' }))
    expect(screen.getByText(/Tirar a foto agora\?/)).toBeTruthy()
    expect(takeSpy).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(takeSpy).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Tirar nova foto' }))
    await user.click(screen.getByRole('button', { name: 'Sim, tirar foto' }))
    await waitFor(() => expect(takeSpy).toHaveBeenCalledWith({ projectId: PROJECT_ID }))
  })

  it('sem permissão de gestor, não há botão de tirar foto', async () => {
    renderBaseline({ data: view({ canTake: false }) })
    expect(await screen.findByRole('table', { name: 'Lista de desvios por tarefa' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Tirar nova foto' })).toBeNull()
  })

  it('sem foto, o estado vazio explica e o gestor tira a primeira', async () => {
    const user = userEvent.setup()
    const { takeSpy } = renderBaseline({
      data: view({ baseline: null, summary: null, tasks: [] }),
      take: () => Promise.resolve(view()),
    })

    expect(await screen.findByText('Nenhuma linha de base ainda')).toBeTruthy()
    expect(screen.getByText(/Tire a foto quando o plano estiver combinado/)).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Tirar a primeira foto' }))
    await user.click(screen.getByRole('button', { name: 'Sim, tirar foto' }))
    await waitFor(() => expect(takeSpy).toHaveBeenCalledTimes(1))
  })

  it('sem foto e sem permissão, o estado vazio não oferece o botão', async () => {
    renderBaseline({
      data: view({ baseline: null, summary: null, tasks: [], canTake: false }),
    })
    expect(await screen.findByText('Nenhuma linha de base ainda')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Tirar a primeira foto' })).toBeNull()
  })

  it('erro ao carregar mostra a mensagem e tenta de novo', async () => {
    const api = createFakeApi()
    vi.spyOn(api.baseline, 'get').mockRejectedValue(new Error('falha'))
    renderPanel(<BaselineView projectId={PROJECT_ID} projectName="Implantação ERP" />, { api })
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(
      screen.getByText('Não foi possível carregar a linha de base deste projeto.'),
    ).toBeTruthy()
  })

  it('sem projeto selecionado, pede para escolher um', () => {
    const api = createFakeApi()
    renderPanel(<BaselineView projectId={null} projectName={null} />, { api })
    expect(screen.getByText('Escolha um projeto para ver a linha de base.')).toBeTruthy()
  })
})
