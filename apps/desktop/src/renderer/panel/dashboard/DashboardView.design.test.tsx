import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiProvider } from '../../shared/api/ApiProvider'
import { QueryProvider } from '../../shared/query/QueryProvider'
import { createFakeApi } from '../../shared/testing/fake-api'
import { DashboardView } from './DashboardView'
import { ANA, BRUNO, CHAMADOS, ERP, dashboardFixture, insightsFixture } from './dashboard-fixtures'

afterEach(cleanup)

function setup(
  insights = insightsFixture(),
  distribution?: Parameters<typeof dashboardFixture>[1],
) {
  const api = createFakeApi()
  vi.spyOn(api.dashboard, 'get').mockResolvedValue(dashboardFixture(insights, distribution))
  vi.spyOn(api.daily, 'listForDate').mockResolvedValue([
    { userId: BRUNO, userName: 'Bruno Lima', done: true },
    { userId: ANA, userName: 'Ana Souza', done: false },
  ])
  vi.spyOn(api.session, 'listUsers').mockResolvedValue([
    { id: BRUNO, name: 'Bruno Lima', initials: 'BL', role: 'collaborator', defaultRate: 95 },
    { id: ANA, name: 'Ana Souza', initials: 'AS', role: 'collaborator', defaultRate: 120.5 },
  ])
  const handlers = {
    onOpenProjects: vi.fn(),
    onOpenProject: vi.fn(),
    onOpenTask: vi.fn(),
    onOpenUpdates: vi.fn(),
    onNotice: vi.fn(),
  }
  render(
    <ApiProvider api={api}>
      <QueryProvider>
        <DashboardView {...handlers} />
      </QueryProvider>
    </ApiProvider>,
  )
  return { ...handlers, user: userEvent.setup() }
}

describe('Dashboard do gestor, layout do desenho (dashboard.html)', () => {
  it('cabeçalho: título, subtítulo, alternador e o botão Resumo do dia', async () => {
    setup()
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Dashboard do Gestor' }),
    ).toBeTruthy()
    expect(
      screen.getByText('Panorama consolidado de ritmo, estados, projetos, equipe e custos.'),
    ).toBeTruthy()
    const tabs = screen.getByRole('tablist', { name: 'Modo do dashboard' })
    expect(
      within(tabs).getByRole('tab', { name: 'Visão geral' }).getAttribute('aria-selected'),
    ).toBe('true')
    expect(within(tabs).getByRole('tab', { name: 'Atualizações' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Resumo do dia' })).toBeTruthy()
    // O desenho não tem filtros nem o chip estático "Mini-equipe".
    expect(screen.queryByLabelText('Filtrar por projeto')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Mini-equipe: todas' })).toBeNull()
  })

  it('faixa de indicadores: só o que o contrato traz (tempo, concluídas na semana, custo)', async () => {
    setup()
    const strip = await screen.findByRole('region', { name: 'Indicadores principais' })
    expect(within(strip).getByText('Tempo médio')).toBeTruthy()
    expect(within(strip).getByText('5 dias')).toBeTruthy()
    expect(within(strip).getByText('3 dias em execução')).toBeTruthy()
    expect(within(strip).getByText('Concluídas (sem.)')).toBeTruthy()
    expect(within(strip).getByText('Custo dos projetos')).toBeTruthy()
    expect(within(strip).getByText(/^R\$\s9\.630,00$/)).toBeTruthy()
    expect(within(strip).queryByText('Tarefas ativas')).toBeNull()
    expect(within(strip).queryByText('Horas lançadas')).toBeNull()
  })

  it('Precisa de você: linha por sinal, com ponto, título, meta e o link que leva à tela', async () => {
    const { user, onOpenProject, onOpenTask } = setup()
    const needs = await screen.findByRole('list', { name: 'Precisa de você' })
    expect(screen.getByText('3 pontos de atenção')).toBeTruthy()
    const wip = within(needs).getByText('Desenvolvendo está com 4 de 3.').closest('li')!
    expect(within(wip).getByText(/App de Chamados · WIP e paradas/)).toBeTruthy()
    await user.click(within(wip).getByRole('button', { name: 'Ver quadro' }))
    expect(onOpenProject).toHaveBeenCalledWith(CHAMADOS, 'board')

    const milestone = within(needs)
      .getByText(/Integração bancária/)
      .closest('li')!
    await user.click(within(milestone).getByRole('button', { name: 'Abrir cronograma' }))
    expect(onOpenProject).toHaveBeenCalledWith(ERP, 'schedule')

    const acceptance = within(needs)
      .getByText(/AB-140/)
      .closest('li')!
    await user.click(within(acceptance).getByRole('button', { name: 'Revisar' }))
    expect(onOpenTask).toHaveBeenCalledWith('01HZTASKAB140000000000000')
  })

  it('Projetos: cada coluna com indicador da metodologia, situação, motivo e custo', async () => {
    setup()
    const agile = await screen.findByRole('article', { name: 'App de Chamados' })
    expect(within(agile).getByText('30 h restantes')).toBeTruthy()
    expect(within(agile).getByText(/Ágil · Sprint 4 · dia 7 de 10/)).toBeTruthy()
    expect(within(agile).getByText('Atenção')).toBeTruthy()
    expect(within(agile).getByText('1 tarefa parada há mais de 4 dias')).toBeTruthy()
    const erp = screen.getByRole('article', { name: 'Implantação ERP' })
    expect(within(erp).getByText('34%')).toBeTruthy()
    expect(within(erp).getByText(/Tradicional · 9 de 26 tarefas concluídas/)).toBeTruthy()
    expect(within(erp).getByText('Risco')).toBeTruthy()
    expect(within(erp).getByText(/^R\$\s9\.630,00$/)).toBeTruthy()
    expect(screen.getByText('2 ativos · clique para abrir o quadro')).toBeTruthy()
  })

  it('Colaboradores: em andamento, sinais, diária, carga, valor/h e Abrir quadro', async () => {
    const { user, onOpenProjects } = setup()
    const team = await screen.findByRole('region', { name: 'Colaboradores' })
    const bruno = within(team).getByText('Bruno Lima').closest('tr')!
    expect(within(bruno).getByText('Parada 3d')).toBeTruthy()
    expect(within(bruno).getByText('✓ respondida')).toBeTruthy()
    expect(within(bruno).getByText('26 h')).toBeTruthy()
    expect(within(bruno).getByText(/^R\$\s95,00$/)).toBeTruthy()
    const ana = within(team).getByText('Ana Souza').closest('tr')!
    expect(within(ana).getByText('+7 dias de atraso')).toBeTruthy()
    expect(within(ana).getByText('Aceite pendente')).toBeTruthy()
    expect(within(ana).getByText('pendente')).toBeTruthy()
    expect(within(ana).getByText(/^R\$\s120,50$/)).toBeTruthy()
    await user.click(within(team).getByRole('button', { name: 'Abrir projetos de Ana Souza' }))
    expect(onOpenProjects).toHaveBeenCalledWith(expect.objectContaining({ id: ANA }))
  })

  it('valor/hora sem permissão (nulo) não aparece: a coluna some', async () => {
    const api = createFakeApi()
    vi.spyOn(api.dashboard, 'get').mockResolvedValue(dashboardFixture())
    vi.spyOn(api.daily, 'listForDate').mockResolvedValue([])
    vi.spyOn(api.session, 'listUsers').mockResolvedValue([
      { id: BRUNO, name: 'Bruno Lima', initials: 'BL', role: 'collaborator', defaultRate: null },
    ])
    render(
      <ApiProvider api={api}>
        <QueryProvider>
          <DashboardView
            onOpenProjects={vi.fn()}
            onOpenProject={vi.fn()}
            onOpenTask={vi.fn()}
            onOpenUpdates={vi.fn()}
          />
        </QueryProvider>
      </ApiProvider>,
    )
    const team = await screen.findByRole('region', { name: 'Colaboradores' })
    expect(within(team).queryByText('Valor/h (R$)')).toBeNull()
  })

  it('Tarefas por estado: barra e uma linha por estado, com a porcentagem de cada um', async () => {
    setup(insightsFixture(), { planning: 10, todo: 20, in_progress: 30, review: 15, done: 25 })
    const section = await screen.findByRole('region', { name: 'Tarefas por estado' })
    const legend = within(section).getByRole('list', { name: 'Estados' })
    const items = within(legend).getAllByRole('listitem')
    expect(items.map((item) => item.textContent)).toEqual([
      'Planejamento10%—',
      'A fazer20%—',
      'Desenvolvendo30%—',
      'Revisar15%—',
      'Concluído25%ciclo 3d',
    ])
  })

  it('Tarefas por estado: sem tarefas mostra o aviso vazio, sem barra', async () => {
    setup()
    const section = await screen.findByRole('region', { name: 'Tarefas por estado' })
    expect(within(section).getByText('Ainda não há tarefas para mostrar.')).toBeTruthy()
    expect(within(section).queryByRole('list', { name: 'Estados' })).toBeNull()
  })

  it('coluna do projeto tem o botão Abrir quadro, que leva ao quadro dele', async () => {
    const { user, onOpenProject } = setup()
    const agile = await screen.findByRole('article', { name: 'App de Chamados' })
    await user.click(within(agile).getByRole('button', { name: 'Abrir quadro de App de Chamados' }))
    expect(onOpenProject).toHaveBeenCalledWith(CHAMADOS, 'board')
  })

  it('aba Atualizações: feed com chips por pessoa e o selo Gestor nas edições do gestor', async () => {
    const { user, onOpenTask, onOpenUpdates } = setup()
    await user.click(await screen.findByRole('tab', { name: 'Atualizações' }))
    expect(screen.queryByRole('region', { name: 'Tarefas por estado' })).toBeNull()
    expect(screen.getByText('3 registros')).toBeTruthy()
    const feed = screen.getByRole('list', { name: 'Atualizações recentes da equipe' })
    const manager = within(feed).getByText('alterou o prazo de 10/11 para 18/11').closest('li')!
    expect(within(manager).getByText('Gestor')).toBeTruthy()
    const chips = screen.getByRole('group', { name: 'Filtrar por pessoa' })
    await user.click(within(chips).getByRole('button', { name: 'Ana Souza' }))
    expect(screen.getByText('2 registros')).toBeTruthy()
    expect(within(feed).queryByText('alterou o prazo de 10/11 para 18/11')).toBeNull()
    await user.click(
      within(feed).getAllByRole('button', { name: /^Abrir Estimativa do módulo/ })[0]!,
    )
    expect(onOpenTask).toHaveBeenCalledWith('01HZTASKAB151000000000000')
    await user.click(screen.getByRole('button', { name: /Filtros avançados/ }))
    expect(onOpenUpdates).toHaveBeenCalled()
  })

  it('Resumo do dia: lista da equipe com quem registrou e quem está pendente', async () => {
    const { user } = setup()
    await user.click(await screen.findByRole('button', { name: 'Resumo do dia' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Resumo do dia · Equipe', { selector: 'h2' })).toBeTruthy()
    expect(await within(dialog).findByText('Registrou hoje')).toBeTruthy()
    expect(within(dialog).getByText('Pendente')).toBeTruthy()
    expect(within(dialog).getByText('Ainda não registrou a atualização de hoje.')).toBeTruthy()
  })
})

describe('Dashboard: guarda do colaborador', () => {
  it('mostra o selo Exclusivo do Gestor e não pede os dados do painel', async () => {
    const api = createFakeApi()
    const get = vi.spyOn(api.dashboard, 'get')
    const onOpenBoard = vi.fn()
    render(
      <ApiProvider api={api}>
        <QueryProvider>
          <DashboardView
            isManager={false}
            onOpenBoard={onOpenBoard}
            onOpenProjects={vi.fn()}
            onOpenProject={vi.fn()}
            onOpenTask={vi.fn()}
            onOpenUpdates={vi.fn()}
          />
        </QueryProvider>
      </ApiProvider>,
    )
    expect(screen.getByText('Exclusivo do Gestor')).toBeTruthy()
    expect(screen.queryByRole('tablist')).toBeNull()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Ir para o meu Quadro' }))
    expect(onOpenBoard).toHaveBeenCalled()
    expect(get).not.toHaveBeenCalled()
  })
})
