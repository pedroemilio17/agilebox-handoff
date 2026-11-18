import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiProvider } from '../../shared/api/ApiProvider'
import { QueryProvider } from '../../shared/query/QueryProvider'
import { createFakeApi } from '../../shared/testing/fake-api'
import { DashboardView } from './DashboardView'
import { ANA, BRUNO, CHAMADOS, ERP, dashboardFixture, insightsFixture } from './dashboard-fixtures'

afterEach(cleanup)

function setup(insights = insightsFixture()) {
  const api = createFakeApi()
  vi.spyOn(api.dashboard, 'get').mockResolvedValue(dashboardFixture(insights))
  vi.spyOn(api.daily, 'listForDate').mockResolvedValue([
    { userId: BRUNO, userName: 'Bruno Lima', done: true },
    { userId: ANA, userName: 'Ana Souza', done: false },
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

describe('Dashboard do gestor, layout do desenho (tela 19)', () => {
  it('cabeçalho: título, semana de segunda a sexta e os quatro filtros', async () => {
    setup()
    expect(await screen.findByRole('heading', { level: 1, name: 'Dashboard' })).toBeTruthy()
    expect(screen.getByText(/^Semana \d+ · 02–06 nov$/)).toBeTruthy()
    expect(screen.getByLabelText('Filtrar por projeto')).toBeTruthy()
    expect(screen.getByLabelText('Filtrar por metodologia')).toBeTruthy()
    expect(screen.getByLabelText('Filtrar por pessoa')).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Mini-equipe: todas' }).hasAttribute('disabled'),
    ).toBe(true)
  })

  it('Precisa de você: linha por sinal com tipo, projeto, texto e o botão que leva à tela', async () => {
    const { user, onOpenProject, onOpenTask, onOpenUpdates } = setup()
    const needs = await screen.findByRole('list', { name: 'Precisa de você' })
    const wip = within(needs).getByText('Desenvolvendo está com 4 de 3.').closest('li')!
    expect(within(wip).getByText('WIP e paradas')).toBeTruthy()
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

    await user.click(screen.getByRole('button', { name: 'Ver todas as atualizações' }))
    expect(onOpenUpdates).toHaveBeenCalled()
  })

  it('Projetos: cada cartão com metodologia, situação, indicador e motivo', async () => {
    setup()
    const agile = await screen.findByRole('article', { name: 'App de Chamados' })
    expect(within(agile).getByText('Ágil')).toBeTruthy()
    expect(within(agile).getByText('Atenção')).toBeTruthy()
    expect(within(agile).getByText('Sprint 4 · dia 7 de 10')).toBeTruthy()
    expect(within(agile).getByText('30 h restantes')).toBeTruthy()
    expect(within(agile).getByText('1 tarefa parada há mais de 4 dias')).toBeTruthy()
    const erp = screen.getByRole('article', { name: 'Implantação ERP' })
    expect(within(erp).getByText('Tradicional')).toBeTruthy()
    expect(within(erp).getByText('Risco')).toBeTruthy()
    expect(within(erp).getByText('34%')).toBeTruthy()
    expect(within(erp).getByText('semana 3 de 13 · R$ 9.630 gastos')).toBeTruthy()
  })

  it('filtro de metodologia deixa só os cartões daquela metodologia', async () => {
    const { user } = setup()
    await screen.findByRole('article', { name: 'App de Chamados' })
    await user.selectOptions(screen.getByLabelText('Filtrar por metodologia'), 'tradicional')
    expect(screen.queryByRole('article', { name: 'App de Chamados' })).toBeNull()
    expect(screen.getByRole('article', { name: 'Implantação ERP' })).toBeTruthy()
  })

  it('filtro de projeto também filtra a lista de sinais', async () => {
    const { user } = setup()
    const needs = await screen.findByRole('list', { name: 'Precisa de você' })
    await user.selectOptions(screen.getByLabelText('Filtrar por projeto'), ERP)
    expect(within(needs).queryByText('Desenvolvendo está com 4 de 3.')).toBeNull()
    expect(within(needs).getByText(/Integração bancária/)).toBeTruthy()
  })

  it('Equipe: projetos, em andamento, sinais, diária e carga em horas', async () => {
    const { user, onOpenProjects } = setup()
    const team = await screen.findByRole('region', { name: 'Equipe em todos os projetos' })
    const bruno = within(team).getByText('Bruno Lima').closest('div')!
    expect(within(bruno).getByText('Parada 3d')).toBeTruthy()
    expect(within(bruno).getByText('✓ respondida')).toBeTruthy()
    expect(within(bruno).getByText('26 h')).toBeTruthy()
    const ana = within(team).getByText('Ana Souza').closest('div')!
    expect(within(ana).getByText('+7 dias de atraso')).toBeTruthy()
    expect(within(ana).getByText('Aceite pendente')).toBeTruthy()
    expect(within(ana).getByText('pendente')).toBeTruthy()
    await user.click(within(team).getByRole('button', { name: 'Abrir projetos de Ana Souza' }))
    expect(onOpenProjects).toHaveBeenCalledWith(expect.objectContaining({ id: ANA }))
  })

  it('filtro de pessoa deixa só a linha dela na equipe', async () => {
    const { user } = setup()
    const team = await screen.findByRole('region', { name: 'Equipe em todos os projetos' })
    await user.selectOptions(screen.getByLabelText('Filtrar por pessoa'), ANA)
    expect(within(team).queryByText('Bruno Lima')).toBeNull()
    expect(within(team).getByText('Ana Souza')).toBeTruthy()
  })
})
