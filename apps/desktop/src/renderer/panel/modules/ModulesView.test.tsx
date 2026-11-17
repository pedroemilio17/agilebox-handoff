import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@agilebox/contract'
import type { ProjectModulesChangeResultDto, ProjectModulesViewDto } from '@agilebox/contract'
import { ApiProvider } from '../../shared/api/ApiProvider'
import { createFakeApi } from '../../shared/testing/fake-api'
import { projectModulesView } from '../../shared/testing/project-modules-fixture'
import { ModulesView } from './ModulesView'

const PROJECT_ID = '01J8Y4G2XK8Z1S6M3Q9W0ABCDE'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const NO_CHANGE: ProjectModulesChangeResultDto = {
  modules: [],
  autoEnabled: [],
  cascadeDisabled: [],
  scheduled: [],
}

interface RenderOptions {
  readonly view?: ProjectModulesViewDto
  readonly get?: () => Promise<ProjectModulesViewDto>
  readonly change?: () => Promise<ProjectModulesChangeResultDto>
  readonly projectId?: string | null
  readonly archived?: boolean
}

function renderView({
  view = projectModulesView({ enabled: ['backlog'] }),
  get,
  change = () => Promise.resolve(NO_CHANGE),
  projectId = PROJECT_ID,
  archived = false,
}: RenderOptions = {}) {
  const getMock = vi.fn(get ?? (() => Promise.resolve(view)))
  const changeMock = vi.fn(change)
  const api = createFakeApi({
    projectModules: { get: getMock, change: changeMock },
  })
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <ApiProvider api={api}>
      <QueryClientProvider client={queryClient}>
        <ModulesView projectId={projectId} projectName="Projeto Aurora" archived={archived} />
      </QueryClientProvider>
    </ApiProvider>,
  )
  return { getMock, changeMock }
}

const statusText = () => screen.getByRole('status').textContent ?? ''
const isDisabled = (element: HTMLElement) => (element as HTMLButtonElement).disabled

describe('ModulesView: lista e contagem', () => {
  it('mostra os módulos nos quatro grupos, sem núcleo e sem Plug-ins', async () => {
    renderView()
    await screen.findByRole('switch', { name: 'Desligar Backlog' })

    expect(
      screen.getAllByRole('region', { name: /Escopo|Planejamento|Acompanhamento|Outros/ }),
    ).toHaveLength(4)
    const scope = screen.getByRole('region', { name: 'Escopo e qualidade' })
    expect(within(scope).getAllByRole('switch')).toHaveLength(4)
    expect(
      within(screen.getByRole('region', { name: 'Planejamento' })).getAllByRole('switch'),
    ).toHaveLength(5)
    expect(
      within(screen.getByRole('region', { name: 'Acompanhamento' })).getAllByRole('switch'),
    ).toHaveLength(6)
    expect(
      within(screen.getByRole('region', { name: 'Outros' })).getAllByRole('switch'),
    ).toHaveLength(5)
    expect(screen.getAllByRole('switch')).toHaveLength(20)
    expect(screen.queryByRole('switch', { name: /Núcleo|Plug-ins/ })).toBeNull()
    expect(screen.queryByText('Plug-ins')).toBeNull()
  })

  it('conta "N de M ligados" somando ligados e encerrando, e mostra a legenda de níveis', async () => {
    renderView({
      view: projectModulesView({ enabled: ['backlog', 'sprints'], winding: ['cost'] }),
    })
    expect(await screen.findByText('3 de 20 ligados')).toBeTruthy()
    expect(screen.getByText('N1 essencial · N2 intermediário · N3 avançado')).toBeTruthy()
    expect(screen.getByText('Projeto · Projeto Aurora')).toBeTruthy()
  })

  it('usa o objetivo, a dependência e o sinal de cada cartão', async () => {
    renderView({ view: projectModulesView({ enabled: ['sprints'] }) })
    const card = (await screen.findByRole('heading', { name: 'Sprints' })).closest('article')!
    expect(within(card).getByText('Trabalhar em ciclos curtos com meta.')).toBeTruthy()
    expect(within(card).getByText('Requer Backlog · Aproveita Estimativa em horas')).toBeTruthy()
    expect(within(card).getByText('N2')).toBeTruthy()
  })

  it('põe o botão "Como funciona" em cada cartão', async () => {
    renderView()
    await screen.findByRole('switch', { name: 'Desligar Backlog' })
    expect(document.querySelectorAll('button[aria-haspopup="dialog"]')).toHaveLength(20)
  })
})

describe('ModulesView: ligar e desligar com prévia', () => {
  it('gestor liga Sprints: mostra o aviso e só grava no Confirmar', async () => {
    const { changeMock } = renderView({
      view: projectModulesView(),
      change: () => Promise.resolve({ ...NO_CHANGE, autoEnabled: ['backlog'] }),
    })
    const user = userEvent.setup()
    await user.click(await screen.findByRole('switch', { name: 'Ligar Sprints' }))

    expect(screen.getByText('Ligar Sprints?')).toBeTruthy()
    expect(statusText()).toContain('Sprints precisa de Backlog. Ligamos junto?')
    expect(changeMock).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Confirmar' }))
    await waitFor(() => expect(changeMock).toHaveBeenCalledTimes(1))
    expect(changeMock).toHaveBeenCalledWith({ projectId: PROJECT_ID, enable: ['sprints'] })
    await waitFor(() => expect(statusText()).toBe('Módulos atualizados. Ligado junto: Backlog.'))
  })

  it('desligar Backlog avisa que Sprints e Burndown saem junto, e só grava no Confirmar', async () => {
    const { changeMock } = renderView({
      view: projectModulesView({ enabled: ['backlog', 'sprints', 'estimates.hours', 'burndown'] }),
    })
    const user = userEvent.setup()
    await user.click(await screen.findByRole('switch', { name: 'Desligar Backlog' }))

    expect(statusText()).toContain(
      'Sai junto, porque depende de Backlog: Sprints, Burndown e velocidade.',
    )
    expect(statusText()).toContain('Nada é apagado. Religar restaura os dados.')
    expect(changeMock).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Confirmar' }))
    await waitFor(() => expect(changeMock).toHaveBeenCalledTimes(1))
    expect(changeMock).toHaveBeenCalledWith({ projectId: PROJECT_ID, disable: ['backlog'] })
  })

  it('Cancelar não grava e devolve o foco ao interruptor', async () => {
    const { changeMock } = renderView()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('switch', { name: 'Ligar Sprints' }))
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(changeMock).not.toHaveBeenCalled()
    expect(screen.queryByText('Ligar Sprints?')).toBeNull()
    expect(document.activeElement).toBe(screen.getByRole('switch', { name: 'Ligar Sprints' }))
  })

  it('recusa ligar Estimativa em pontos com horas ligadas e não oferece Confirmar', async () => {
    renderView({ view: projectModulesView({ enabled: ['estimates.hours'] }) })
    const user = userEvent.setup()
    await user.click(await screen.findByRole('switch', { name: 'Ligar Estimativa em pontos' }))

    expect(statusText()).toContain(
      'Não dá para ligar Estimativa em pontos junto com Estimativa em horas',
    )
    expect(screen.queryByRole('button', { name: 'Confirmar' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeTruthy()
  })

  it('resposta com sprint ativa mostra o aviso e não diz que agendou', async () => {
    const { changeMock } = renderView({
      view: projectModulesView({ enabled: ['backlog', 'sprints'] }),
      change: () =>
        Promise.resolve({
          ...NO_CHANGE,
          scheduled: [{ moduleId: 'sprints', reason: 'active_sprint' }],
        }),
    })
    const user = userEvent.setup()
    await user.click(await screen.findByRole('switch', { name: 'Desligar Sprints' }))
    await user.click(screen.getByRole('button', { name: 'Confirmar' }))

    await waitFor(() =>
      expect(statusText()).toBe(
        'Não dá para desligar Sprints agora: há uma sprint ativa. Termine a sprint antes.',
      ),
    )
    expect(statusText()).not.toMatch(/agendad/i)
    expect(changeMock).toHaveBeenCalledWith({ projectId: PROJECT_ID, disable: ['sprints'] })
  })

  it('erro da API aparece em alerta e fecha a prévia', async () => {
    renderView({
      change: () =>
        Promise.reject(
          new ApiError('CONFLICT', 'Projeto arquivado: as ferramentas não podem ser alteradas'),
        ),
    })
    const user = userEvent.setup()
    await user.click(
      await screen.findByRole('switch', { name: 'Ligar Limite de tarefas em andamento (WIP)' }),
    )
    await user.click(screen.getByRole('button', { name: 'Confirmar' }))

    expect((await screen.findByRole('alert')).textContent).toContain(
      'Projeto arquivado: as ferramentas não podem ser alteradas',
    )
    expect(screen.queryByRole('button', { name: 'Confirmar' })).toBeNull()
  })
})

describe('ModulesView: permissões e estados', () => {
  it('colaborador vê os interruptores desabilitados e a nota', async () => {
    renderView({
      view: projectModulesView({ enabled: ['backlog'], canManage: false }),
    })
    const user = userEvent.setup()
    const sprints = await screen.findByRole('switch', { name: 'Ligar Sprints' })

    expect(isDisabled(sprints)).toBe(true)
    expect(isDisabled(screen.getByRole('switch', { name: 'Desligar Backlog' }))).toBe(true)
    expect(screen.getByRole('note').textContent).toContain(
      'Só o gestor muda os módulos do projeto.',
    )
    await user.click(sprints)
    expect(screen.queryByRole('button', { name: 'Confirmar' })).toBeNull()
  })

  it('projeto arquivado não deixa mudar, mesmo para o gestor', async () => {
    renderView({ archived: true })
    const sprints = await screen.findByRole('switch', { name: 'Ligar Sprints' })

    expect(isDisabled(sprints)).toBe(true)
    expect(
      screen.getByText('Projeto arquivado: as ferramentas não podem ser alteradas.'),
    ).toBeTruthy()
  })

  it('sem projeto selecionado pede para escolher e não consulta módulos', () => {
    const { getMock } = renderView({ projectId: null })
    expect(screen.getByText('Escolha um projeto para ver os módulos.')).toBeTruthy()
    expect(getMock).not.toHaveBeenCalled()
  })

  it('mostra o carregamento enquanto a lista não chega', () => {
    renderView({ get: () => new Promise<ProjectModulesViewDto>(() => undefined) })
    expect(screen.getByRole('status').textContent).toContain('Carregando os módulos…')
  })

  it('erro ao carregar mostra alerta e nova tentativa', async () => {
    let calls = 0
    renderView({
      get: () => {
        calls += 1
        return calls === 1
          ? Promise.reject(new Error('falhou'))
          : Promise.resolve(projectModulesView({ enabled: ['backlog'] }))
      },
    })
    const user = userEvent.setup()
    expect((await screen.findByRole('alert')).textContent).toContain(
      'Não foi possível carregar os módulos deste projeto.',
    )
    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(await screen.findByRole('switch', { name: 'Desligar Backlog' })).toBeTruthy()
  })
})
