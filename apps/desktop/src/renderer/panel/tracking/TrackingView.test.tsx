import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { TrackingViewDto } from '@agilebox/contract'
import { getManifest } from '@agilebox/core'
import { createFakeApi } from '../../shared/testing/fake-api'
import { renderPanel } from '../../shared/testing/render-panel'
import { moduleHelpCopy } from '../guide/module-help-copy'
import type { PanelView } from '../layout/PanelShell'
import { TrackingView } from './TrackingView'

const PROJECT_ID = '01J8Y4G2XK8Z1S6M3Q9W0FGHKA'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

/** Acompanhamento de exemplo: números de tela real, com custo visível (gestor). */
function view(overrides: Partial<TrackingViewDto> = {}): TrackingViewDto {
  return {
    projectId: PROJECT_ID,
    costEnabled: true,
    week: { current: 3, total: 13 },
    summary: {
      progress: 34,
      plannedHours: 590,
      loggedHours: 214,
      realizedCost: 9630,
      plannedCost: 26550,
      tasks: { total: 12, done: 4 },
    },
    nextMilestone: {
      id: '01J8Y4G2XK8Z1S6M3Q9W0FGHM1',
      title: 'Configuração aprovada',
      dueOn: '2026-12-18',
      daysLeft: 31,
      status: 'at_risk',
    },
    milestones: [
      {
        id: '01J8Y4G2XK8Z1S6M3Q9W0FGHM0',
        title: 'Escopo fechado',
        dueOn: '2026-11-30',
        criterion: 'Ata assinada',
        deliverableTitle: 'Planejamento',
        status: 'done',
      },
      {
        id: '01J8Y4G2XK8Z1S6M3Q9W0FGHM1',
        title: 'Configuração aprovada',
        dueOn: '2026-12-18',
        criterion: null,
        deliverableTitle: null,
        status: 'at_risk',
      },
      {
        id: '01J8Y4G2XK8Z1S6M3Q9W0FGHM2',
        title: 'Go-live',
        dueOn: '2027-02-01',
        criterion: null,
        deliverableTitle: 'Implantação',
        status: 'on_track',
      },
    ],
    today: '2026-11-18',
    ...overrides,
  }
}

function renderTracking({
  data = view(),
  onNavigate = vi.fn(),
  projectId = PROJECT_ID,
}: {
  readonly data?: TrackingViewDto
  readonly onNavigate?: (view: PanelView) => void
  readonly projectId?: string | null
} = {}) {
  const api = createFakeApi()
  vi.spyOn(api.tracking, 'get').mockResolvedValue(data)
  renderPanel(
    <TrackingView projectId={projectId} projectName="Implantação ERP" onNavigate={onNavigate} />,
    { api },
  )
  return { api, onNavigate }
}

function card(name: string) {
  return screen.getByRole('region', { name })
}

describe('TrackingView', () => {
  it('mostra o cabeçalho com o projeto e a semana, e os quatro cartões com os valores', async () => {
    renderTracking()

    expect(await screen.findByRole('heading', { name: 'Acompanhamento', level: 2 })).toBeTruthy()
    expect(screen.getByText('Implantação ERP · semana 3 de 13')).toBeTruthy()

    const progress = card('Concluído')
    expect(within(progress).getByText('34%')).toBeTruthy()
    expect(
      within(progress)
        .getByRole('progressbar', { name: 'Concluído' })
        .getAttribute('aria-valuenow'),
    ).toBe('34')
    expect(within(progress).getByText('4 de 12 tarefas concluídas')).toBeTruthy()

    const hours = card('Horas lançadas')
    expect(within(hours).getByText('214 h')).toBeTruthy()
    expect(within(hours).getByText('de 590 h previstas')).toBeTruthy()

    const cost = card('Custo realizado')
    expect(within(cost).getByText(/^R\$\s9\.630,00$/)).toBeTruthy()
    expect(within(cost).getByText(/^de R\$\s26\.550,00 previstos$/)).toBeTruthy()
  })

  it('custo aparece como "—" para quem não vê valores', async () => {
    renderTracking({
      data: view({ summary: { ...view().summary, realizedCost: null, plannedCost: null } }),
    })
    const cost = await screen.findByRole('region', { name: 'Custo realizado' })
    expect(within(cost).getByText('—')).toBeTruthy()
    expect(within(cost).queryByText(/R\$/)).toBeNull()
    expect(within(cost).getByText('Só o gestor vê os valores')).toBeTruthy()
    // As horas seguem visíveis para quem vê o projeto.
    expect(within(card('Horas lançadas')).getByText('214 h')).toBeTruthy()
  })

  it('com o módulo cost desligado, o cartão de custo e a legenda de gestor somem; as horas seguem', async () => {
    renderTracking({
      data: view({
        costEnabled: false,
        summary: { ...view().summary, realizedCost: null, plannedCost: null },
      }),
    })
    expect(await screen.findByRole('heading', { name: 'Acompanhamento', level: 2 })).toBeTruthy()
    expect(screen.queryByRole('region', { name: 'Custo realizado' })).toBeNull()
    expect(screen.queryByText('Só o gestor vê os valores')).toBeNull()
    expect(within(card('Horas lançadas')).getByText('214 h')).toBeTruthy()
  })

  it('o próximo marco mostra a data, os dias e a marca "Em risco" em texto', async () => {
    renderTracking()
    const next = await screen.findByRole('region', { name: 'Próximo marco' })
    expect(within(next).getByText('Configuração aprovada')).toBeTruthy()
    expect(within(next).getByText(/18\/12 · em 31 dias/)).toBeTruthy()
    expect(within(next).getByText('Em risco')).toBeTruthy()
  })

  it('sem marco pela frente, o cartão diz isso', async () => {
    renderTracking({ data: view({ nextMilestone: null, milestones: [] }) })
    const next = await screen.findByRole('region', { name: 'Próximo marco' })
    expect(within(next).getByText('Nenhum marco pela frente')).toBeTruthy()
  })

  it('lista os marcos na ordem recebida, com status em texto, critério e entrega', async () => {
    renderTracking()
    const list = await screen.findByRole('list', { name: 'Lista de marcos' })
    const items = within(list).getAllByRole('listitem')
    expect(items.map((item) => item.textContent)).toEqual([
      expect.stringMatching(
        /^Escopo fechado.*Critério: Ata assinada.*Entrega: Planejamento.*Cumprido/,
      ),
      expect.stringMatching(/^Configuração aprovada.*Em risco/),
      expect.stringMatching(/^Go-live.*Entrega: Implantação.*No prazo/),
    ])
    expect(items[0]?.getAttribute('data-status')).toBe('done')
    expect(within(items[1]!).getByText('Em risco')).toBeTruthy()
    expect(within(items[2]!).getByText('No prazo')).toBeTruthy()
  })

  it('sem intervalo no cronograma, o cabeçalho não mostra a semana', async () => {
    renderTracking({ data: view({ week: null }) })
    expect(await screen.findByText('Implantação ERP')).toBeTruthy()
    expect(screen.queryByText(/semana/)).toBeNull()
  })

  it('sem marcos mostra o estado vazio com o link para a tela de marcos', async () => {
    const user = userEvent.setup()
    const { onNavigate } = renderTracking({ data: view({ milestones: [], nextMilestone: null }) })
    expect(await screen.findByText('Nenhum marco ainda.')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Abrir os marcos' }))
    expect(onNavigate).toHaveBeenCalledWith('milestones')
  })

  it('o botão de ajuda do módulo do cronograma está no cabeçalho', async () => {
    renderTracking()
    await screen.findByRole('region', { name: 'Concluído' })
    const name = getManifest('schedule').name
    expect(screen.getByRole('button', { name: moduleHelpCopy.buttonLabel(name) })).toBeTruthy()
  })

  it('sem projeto selecionado pede para escolher um e não consulta', () => {
    const { api } = renderTracking({ projectId: null })
    expect(screen.getByText('Escolha um projeto para ver o acompanhamento.')).toBeTruthy()
    expect(api.tracking.get).not.toHaveBeenCalled()
  })

  it('erro de carga mostra a mensagem e deixa tentar de novo', async () => {
    const api = createFakeApi()
    const get = vi
      .spyOn(api.tracking, 'get')
      .mockRejectedValueOnce(new Error('falhou'))
      .mockResolvedValue(view())
    const user = userEvent.setup()
    renderPanel(<TrackingView projectId={PROJECT_ID} projectName="Implantação ERP" />, { api })
    expect(await screen.findByRole('alert')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2))
    expect(await screen.findByRole('heading', { name: 'Acompanhamento', level: 2 })).toBeTruthy()
  })
})
