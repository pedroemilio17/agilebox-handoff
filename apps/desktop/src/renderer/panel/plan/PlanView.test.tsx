import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiProvider } from '../../shared/api/ApiProvider'
import { createFakeApi } from '../../shared/testing/fake-api'
import { PlanView } from './PlanView'
import { PlanSprintView } from './PlanSprintView'
import { DELIVERABLE_1, PLAN_PROJECT_ID, SPRINT_2, planExample } from './plan-fixtures'
import { wbsId } from '../wbs/wbs-fixtures'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

function renderWith(ui: React.ReactElement, api: ReturnType<typeof createFakeApi>) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <ApiProvider api={api}>
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
    </ApiProvider>,
  )
  return { user: userEvent.setup() }
}

/** API com a EAP, as sprints e os itens do exemplo (hoje fixado em 18/11/2026). */
function planApi() {
  const example = planExample()
  const api = createFakeApi()
  vi.useFakeTimers({ toFake: ['Date'], now: new Date(2026, 10, 18, 12) })
  vi.spyOn(api.wbs, 'get').mockResolvedValue(example.wbs)
  vi.spyOn(api.sprints, 'list').mockResolvedValue(example.sprints)
  vi.spyOn(api.sprints, 'get').mockImplementation(({ sprintId }) => {
    const sprint = example.sprints.find((entry) => entry.id === sprintId)!
    return Promise.resolve({
      sprint,
      items: [...(example.itemsById[sprintId] ?? [])],
      history: [] as never[],
    })
  })
  return { api, example }
}

describe('PlanView (tela 17)', () => {
  it('pede um projeto quando não há nenhum selecionado', () => {
    const api = createFakeApi()
    renderWith(<PlanView projectId={null} onOpenSprint={vi.fn()} />, api)
    expect(screen.getByText('Escolha um projeto para ver o plano.')).toBeTruthy()
  })

  it('mostra o título, o nome do projeto e as entregas na linha do tempo', async () => {
    const { api } = planApi()
    renderWith(
      <PlanView projectId={PLAN_PROJECT_ID} projectName="Portal do Aluno" onOpenSprint={vi.fn()} />,
      api,
    )

    expect(await screen.findByRole('heading', { name: 'Plano', level: 2 })).toBeTruthy()
    expect(screen.getByText('Portal do Aluno')).toBeTruthy()

    const timeline = screen.getByRole('region', { name: 'Linha do tempo do projeto' })
    expect(within(timeline).getByText('1 · Acesso e perfil')).toBeTruthy()
    expect(within(timeline).getByText('03/11 – 28/11 · 58%')).toBeTruthy()
    expect(within(timeline).getByText('Acesso no ar')).toBeTruthy()
    expect(within(timeline).getByText('S1')).toBeTruthy()
    expect(within(timeline).getByText('S2')).toBeTruthy()
    expect(within(timeline).getByText('S3')).toBeTruthy()
  })

  it('mostra a entrega atual com as sprints que a atravessam e o que falta', async () => {
    const { api } = planApi()
    renderWith(<PlanView projectId={PLAN_PROJECT_ID} onOpenSprint={vi.fn()} />, api)

    const current = await screen.findByRole('region', { name: '1 · Acesso e perfil' })
    expect(within(current).getByText('Entrega atual')).toBeTruthy()
    expect(within(current).getByText('Concluída · 8 h')).toBeTruthy()
    expect(within(current).getByText('Em andamento · termina no marco')).toBeTruthy()
    expect(within(current).getByText('3 itens · 14 h')).toBeTruthy()
  })

  it('o botão da sprint ativa abre a sprint dentro da entrega', async () => {
    const { api } = planApi()
    const onOpenSprint = vi.fn()
    const { user } = renderWith(
      <PlanView projectId={PLAN_PROJECT_ID} onOpenSprint={onOpenSprint} />,
      api,
    )

    await user.click(await screen.findByRole('button', { name: 'Abrir Sprint 2' }))
    expect(onOpenSprint).toHaveBeenCalledWith(SPRINT_2, DELIVERABLE_1)
  })

  it('o número da sprint na entrega atual também abre a sprint', async () => {
    const { api } = planApi()
    const onOpenSprint = vi.fn()
    const { user } = renderWith(
      <PlanView projectId={PLAN_PROJECT_ID} onOpenSprint={onOpenSprint} />,
      api,
    )

    await user.click(await screen.findByRole('button', { name: 'Sprint 2' }))
    expect(onOpenSprint).toHaveBeenCalledWith(SPRINT_2, DELIVERABLE_1)
  })

  it('mostra o texto do design no painel "Como o híbrido funciona"', async () => {
    const { api } = planApi()
    renderWith(<PlanView projectId={PLAN_PROJECT_ID} onOpenSprint={vi.fn()} />, api)

    const how = await screen.findByRole('complementary')
    expect(within(how).getByText('Como o híbrido funciona')).toBeTruthy()
    expect(within(how).getByText('Em cima é planejado.')).toBeTruthy()
  })

  it('mostra o erro com ação de tentar de novo', async () => {
    const api = createFakeApi()
    vi.spyOn(api.wbs, 'get').mockRejectedValue(new Error('falhou'))
    vi.spyOn(api.sprints, 'list').mockResolvedValue([])
    renderWith(<PlanView projectId={PLAN_PROJECT_ID} onOpenSprint={vi.fn()} />, api)

    expect((await screen.findByRole('alert')).textContent).toContain(
      'Não foi possível carregar o plano deste projeto.',
    )
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeTruthy()
  })
})

describe('PlanSprintView (tela 18)', () => {
  function sprintScreen(
    api: ReturnType<typeof createFakeApi>,
    overrides: Partial<React.ComponentProps<typeof PlanSprintView>> = {},
  ) {
    const props: React.ComponentProps<typeof PlanSprintView> = {
      projectId: PLAN_PROJECT_ID,
      sprintId: SPRINT_2,
      deliverableId: DELIVERABLE_1,
      showEstimates: true,
      onBack: vi.fn(),
      onOpenTask: vi.fn(),
      onNewTask: vi.fn(),
      ...overrides,
    }
    return renderWith(<PlanSprintView {...props} />, api)
  }

  it('mostra a trilha da entrega, o título da sprint e as datas com o dia útil', async () => {
    const { api } = planApi()
    const onBack = vi.fn()
    const { user } = sprintScreen(api, { onBack })

    expect(await screen.findByRole('heading', { name: 'Sprint 2', level: 2 })).toBeTruthy()
    expect(screen.getByText('17/11 → 28/11 · dia 2 de 9')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: '1 · Acesso e perfil' }))
    expect(onBack).toHaveBeenCalled()
  })

  it('mostra o contexto: entrega com progresso, marco e meta da sprint', async () => {
    const { api } = planApi()
    sprintScreen(api)

    const context = await screen.findByRole('region', { name: 'Contexto' })
    expect(within(context).getByText('Entrega 1')).toBeTruthy()
    expect(within(context).getByText('Sprints desta entrega: S1, S2')).toBeTruthy()
    expect(
      within(context).getByText('Acesso no ar · sáb 28/11 · mesmo dia do fim da sprint'),
    ).toBeTruthy()
    expect(within(context).getByText('Aluno entra e edita o próprio perfil')).toBeTruthy()
  })

  it('cada cartão leva o selo da entrega dele', async () => {
    const { api } = planApi()
    sprintScreen(api)

    // Tarefas da Entrega 1 levam "E1"; a da Entrega 2, que está nesta sprint, leva "E2".
    expect(await screen.findAllByText('E1')).toHaveLength(2)
    expect(screen.getAllByText('E2')).toHaveLength(1)
  })

  it('avisa do item que não é da entrega e deixa devolvê-lo ao backlog', async () => {
    const { api } = planApi()
    const sendBack = vi.spyOn(api.backlog, 'sendBack').mockResolvedValue({} as never)
    const { user } = sprintScreen(api)

    const alert = await screen.findByRole('alert')
    expect(within(alert).getByText('Item fora da entrega')).toBeTruthy()
    await user.click(
      within(alert).getByRole('button', { name: 'Devolver Login Google ao backlog' }),
    )
    expect(sendBack).toHaveBeenCalledWith({ taskId: wbsId('406') })
  })

  it('sem entrega no contexto, não há alerta de item fora da entrega', async () => {
    const { api } = planApi()
    sprintScreen(api, { deliverableId: null })

    expect(await screen.findByRole('heading', { name: 'Sprint 2', level: 2 })).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(
      screen.getByText('Sem entrega: os itens desta sprint não estão ligados à EAP.'),
    ).toBeTruthy()
  })

  it('"Nova tarefa" abre a criação de tarefa', async () => {
    const { api } = planApi()
    const onNewTask = vi.fn()
    const { user } = sprintScreen(api, { onNewTask })

    await user.click(await screen.findByRole('button', { name: 'Nova tarefa' }))
    expect(onNewTask).toHaveBeenCalled()
  })
})
