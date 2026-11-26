import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@agilebox/contract'
import type {
  ProjectModuleHistoryDto,
  ProjectModulesChangeResultDto,
  ProjectModulesViewDto,
} from '@agilebox/contract'
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
  readonly history?: () => Promise<ProjectModuleHistoryDto>
  readonly projectId?: string | null
  readonly archived?: boolean
  readonly startedFromPreset?: 'agil' | null
}

function renderView({
  view = projectModulesView({ enabled: ['backlog'] }),
  get,
  change = () => Promise.resolve(NO_CHANGE),
  history = () => Promise.resolve({ projectId: PROJECT_ID, events: [] }),
  projectId = PROJECT_ID,
  archived = false,
  startedFromPreset = 'agil',
}: RenderOptions = {}) {
  const getMock = vi.fn(get ?? (() => Promise.resolve(view)))
  const changeMock = vi.fn(change)
  const api = createFakeApi({
    projectModules: {
      get: getMock,
      change: changeMock,
      setConfig: (input) =>
        Promise.resolve({ projectId: input.projectId, modules: [], canManage: true }),
      getOrganization: () => Promise.resolve({ modules: [], hasActiveProjects: false }),
      history: () => history(),
    },
  })
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <ApiProvider api={api}>
      <QueryClientProvider client={queryClient}>
        <ModulesView
          projectId={projectId}
          projectName="Projeto Aurora"
          startedFromPreset={startedFromPreset}
          archived={archived}
        />
      </QueryClientProvider>
    </ApiProvider>,
  )
  return { getMock, changeMock }
}

const statusText = () => screen.getByRole('status').textContent ?? ''
const dialog = () => screen.getByRole('dialog')

const HISTORY_ROW_BASE = {
  at: '2026-11-16T12:00:00.000Z',
  actorId: '00000000000000000000000012',
  moduleName: 'Sprints',
  relatedModuleId: null,
  relatedModuleName: null,
  auto: false,
} as const
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
    expect(await screen.findByText('3 de 15 ligados')).toBeTruthy()
    expect(screen.getByText('N1 essencial · N2 intermediário · N3 avançado')).toBeTruthy()
    expect(screen.getByText('Projeto · Projeto Aurora')).toBeTruthy()
  })

  it('mostra o selo "Começou como" com o nome completo da metodologia', async () => {
    renderView({ startedFromPreset: 'agil' })
    expect(await screen.findByText('Começou como Ágil')).toBeTruthy()
  })

  it('sem preset, não mostra o selo', async () => {
    renderView({ startedFromPreset: null })
    await screen.findByRole('switch', { name: 'Desligar Backlog' })
    expect(screen.queryByText(/Começou como/)).toBeNull()
  })

  it('usa o objetivo, a dependência e o sinal de cada linha', async () => {
    renderView({ view: projectModulesView({ enabled: ['sprints'] }) })
    const row = (await screen.findByRole('heading', { name: 'Sprints' })).closest('article')!
    expect(within(row).getByText('Ciclos curtos com meta e capacidade.')).toBeTruthy()
    expect(within(row).getByText('Requer Backlog')).toBeTruthy()
    expect(within(row).getByText('N2')).toBeTruthy()
  })

  it('mostra o selo "Avançado" (N3) e não há diálogo aberto sem conflito/cascata', async () => {
    renderView()
    const risks = (await screen.findByRole('heading', { name: 'Riscos' })).closest('article')!
    expect(within(risks).getByText('Avançado').getAttribute('data-tone')).toBe('adv')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('põe o botão "Como funciona" em cada linha', async () => {
    renderView()
    await screen.findByRole('switch', { name: 'Desligar Backlog' })
    expect(document.querySelectorAll('button[aria-haspopup="dialog"]')).toHaveLength(20)
  })
})

describe('ModulesView: alternância direta e diálogo só para cascata/bloqueio (Opção A)', () => {
  it('gestor liga Sprints: salva na hora sem diálogo e avisa o que ligou junto', async () => {
    const { changeMock } = renderView({
      view: projectModulesView(),
      change: () => Promise.resolve({ ...NO_CHANGE, autoEnabled: ['backlog'] }),
    })
    const user = userEvent.setup()
    await user.click(await screen.findByRole('switch', { name: 'Ligar Sprints' }))

    expect(screen.queryByRole('dialog')).toBeNull()
    await waitFor(() => expect(changeMock).toHaveBeenCalledTimes(1))
    expect(changeMock).toHaveBeenCalledWith({ projectId: PROJECT_ID, enable: ['sprints'] })
    await waitFor(() => expect(statusText()).toBe('Módulos atualizados. Ligado junto: Backlog.'))
  })

  it('desligar módulo sem dependentes salva na hora sem diálogo', async () => {
    const { changeMock } = renderView({
      view: projectModulesView({ enabled: ['wip'] }),
    })
    const user = userEvent.setup()
    await user.click(await screen.findByRole('switch', { name: 'Desligar Limites WIP' }))

    expect(screen.queryByRole('dialog')).toBeNull()
    await waitFor(() => expect(changeMock).toHaveBeenCalledTimes(1))
    expect(changeMock).toHaveBeenCalledWith({ projectId: PROJECT_ID, disable: ['wip'] })
    await waitFor(() => expect(statusText()).toBe('Módulos atualizados.'))
  })

  it('desligar Backlog com Sprints e Burndown ativos abre diálogo central e só grava no Confirmar', async () => {
    const { changeMock } = renderView({
      view: projectModulesView({ enabled: ['backlog', 'sprints', 'estimates.hours', 'burndown'] }),
    })
    const user = userEvent.setup()
    await user.click(await screen.findByRole('switch', { name: 'Desligar Backlog' }))

    expect(within(dialog()).getByText('Sai junto, porque depende de Backlog:')).toBeTruthy()
    expect(within(dialog()).getAllByText('Sprints')).toHaveLength(2)
    expect(within(dialog()).getAllByText('Burndown e velocidade')).toHaveLength(2)
    expect(within(dialog()).getByText('Nada é apagado. Religar restaura os dados.')).toBeTruthy()
    expect(changeMock).not.toHaveBeenCalled()

    await user.click(within(dialog()).getByRole('button', { name: 'Confirmar' }))
    await waitFor(() => expect(changeMock).toHaveBeenCalledTimes(1))
    expect(changeMock).toHaveBeenCalledWith({ projectId: PROJECT_ID, disable: ['backlog'] })
  })

  it('Cancelar no diálogo de cascata não grava e devolve o foco ao interruptor', async () => {
    const { changeMock } = renderView({
      view: projectModulesView({ enabled: ['backlog', 'sprints'] }),
    })
    const user = userEvent.setup()
    const backlogSwitch = await screen.findByRole('switch', { name: 'Desligar Backlog' })
    await user.click(backlogSwitch)
    await user.click(within(dialog()).getByRole('button', { name: 'Cancelar' }))

    expect(changeMock).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(backlogSwitch)
  })

  it('recusa ligar Estimativa em pontos com horas ligadas num diálogo central sem Confirmar', async () => {
    renderView({ view: projectModulesView({ enabled: ['estimates.hours'] }) })
    const user = userEvent.setup()
    await user.click(await screen.findByRole('switch', { name: 'Ligar Estimativa em pontos' }))

    expect(
      within(dialog()).getByText(/Não dá para ligar Estimativa em pontos junto com Estimativa/),
    ).toBeTruthy()
    expect(within(dialog()).queryByRole('button', { name: 'Confirmar' })).toBeNull()
    expect(within(dialog()).getByRole('button', { name: 'Fechar' })).toBeTruthy()
  })

  it('resposta com sprint ativa abre diálogo de aviso e não diz que agendou', async () => {
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

    await waitFor(() =>
      expect(
        within(dialog()).getByText(
          'Não dá para desligar Sprints agora: há uma sprint ativa. Termine a sprint antes.',
        ),
      ).toBeTruthy(),
    )
    expect(dialog().textContent).not.toMatch(/agendad/i)
    expect(within(dialog()).queryByRole('button', { name: 'Confirmar' })).toBeNull()
    expect(changeMock).toHaveBeenCalledWith({ projectId: PROJECT_ID, disable: ['sprints'] })
  })

  it('erro da API aparece em alerta', async () => {
    renderView({
      change: () =>
        Promise.reject(
          new ApiError('CONFLICT', 'Projeto arquivado: as ferramentas não podem ser alteradas'),
        ),
    })
    const user = userEvent.setup()
    await user.click(await screen.findByRole('switch', { name: 'Ligar Limites WIP' }))

    expect((await screen.findByRole('alert')).textContent).toContain(
      'Projeto arquivado: as ferramentas não podem ser alteradas',
    )
    expect(screen.queryByRole('dialog')).toBeNull()
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
    expect(screen.queryByRole('dialog')).toBeNull()
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

describe('ModulesView: histórico de mudanças', () => {
  it('vem recolhido, com o estado vazio "Nenhuma mudança ainda."', async () => {
    renderView()

    const empty = await screen.findByText('Nenhuma mudança ainda.')
    const section = empty.closest('details')
    expect(section).not.toBeNull()
    expect(section?.hasAttribute('open')).toBe(false)
    expect(screen.getByText('Histórico')).toBe(section?.querySelector('summary'))
  })

  it('mostra quando, o que mudou (com o módulo que puxou) e quem fez, com a marca Gestor', async () => {
    renderView({
      history: () =>
        Promise.resolve({
          projectId: PROJECT_ID,
          events: [
            {
              ...HISTORY_ROW_BASE,
              id: 2,
              action: 'disabled',
              moduleId: 'burndown',
              moduleName: 'Burndown',
              auto: true,
              relatedModuleId: 'sprints',
              relatedModuleName: 'Sprints',
              actorName: 'Gestora Ana',
              actorRole: 'manager',
            },
            {
              ...HISTORY_ROW_BASE,
              id: 1,
              action: 'enabled',
              moduleId: 'sprints',
              actorName: 'Bruno',
              actorRole: 'collaborator',
            },
          ],
        }),
    })

    const manager = await screen.findByText('Desligou Burndown (junto com Sprints)')
    const row = manager.closest('li') as HTMLElement
    within(row).getByText('Gestora Ana')
    within(row).getByText('Gestor')
    expect(row.querySelector('time')?.getAttribute('datetime')).toBe(HISTORY_ROW_BASE.at)

    const member = screen.getByText('Ligou Sprints').closest('li') as HTMLElement
    within(member).getByText('Bruno')
    expect(within(member).queryByText('Gestor')).toBeNull()
  })

  it('falha ao carregar mostra aviso dentro da seção, sem derrubar a tela', async () => {
    renderView({ history: () => Promise.reject(new Error('sem conexão')) })

    await screen.findByText('Não foi possível carregar o histórico deste projeto.')
    screen.getByRole('switch', { name: 'Desligar Backlog' })
  })
})
