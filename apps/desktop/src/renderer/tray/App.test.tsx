import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { ProjectDto, TaskDto, AgileBoxApi } from '@agilebox/contract'
import { ApiProvider } from '../shared/api/ApiProvider'
import { QueryProvider } from '../shared/query/QueryProvider'
import { boardResponse, createFakeApi } from '../shared/testing/fake-api'
import { makeDetail } from '../panel/task-detail/fixtures'
import { App } from './App'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

// jsdom não traz matchMedia; sem movimento reduzido, a bandeja anima a altura como no app.
beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }),
  })
})

const task = (id: string, title: string, projectName = 'Aurora'): TaskDto => ({
  id,
  number: 118,
  key: 'AB-118',
  projectId: '01J8Y4G2XK8Z1S6M3Q9W0ABCDE',
  projectName,
  title,
  description: '',
  status: 'todo',
  priority: 'normal',
  blockedReason: null,
  blockedAt: null,
  checklistProgress: { done: 0, total: 0, percent: 0 },
  commentCount: 0,
  deadline: null,
  ticketId: null,
  ticketUrl: null,
  createdAt: '2026-10-31T12:00:00.000Z',
  updatedAt: '2026-10-31T12:00:00.000Z',
})

const A = task('01J8Y4G2XK8Z1S6M3Q9W0A5BC1', 'Revisão do relatório')
const B = task('01J8Y4G2XK8Z1S6M3Q9W0A5BC2', 'Publicar versão', 'Boreal')
const ME = '01J8Y4G2XK8Z1S6M3Q9W0A5V01'

function setup(
  tasks: TaskDto[] = [A, B],
  configure?: (api: AgileBoxApi) => void,
  initialScreen: 'prompt' | 'home' = 'home',
) {
  const shell = {
    minimize: vi.fn(),
    close: vi.fn(),
    toggleTray: vi.fn(),
    openPanel: vi.fn(),
    setTrayHeight: vi.fn(),
  }
  vi.stubGlobal('agilebox', { shell })
  const api = createFakeApi()
  vi.spyOn(api.session, 'getCurrent').mockResolvedValue({
    userId: ME,
    organizationId: '01J8Y4G2XK8Z1S6M3Q9W0ABCDE',
    role: 'collaborator',
  })
  vi.spyOn(api.session, 'listUsers').mockResolvedValue([])
  const listBoard = vi.spyOn(api.tasks, 'listBoard').mockResolvedValue(boardResponse(tasks))
  vi.spyOn(api.tasks, 'listRecent').mockResolvedValue(tasks)
  vi.spyOn(api.tasks, 'recordOpen').mockResolvedValue(undefined)
  vi.spyOn(api.timeline, 'list').mockResolvedValue([])
  configure?.(api)
  render(
    <ApiProvider api={api}>
      <QueryProvider>
        <App initialScreen={initialScreen} />
      </QueryProvider>
    </ApiProvider>,
  )
  return { api, shell, listBoard, user: userEvent.setup() }
}

const PROJECT = {
  id: A.projectId,
  name: 'Aurora',
  createdBy: ME,
  createdAt: A.createdAt,
  definitionOfDoneCount: 0,
}

describe('Bandeja: tela inicial', () => {
  it('cria pelo rodapé com projeto e prazo interpretados e volta à lista com aviso', async () => {
    const { api, user } = setup([A], (api) => {
      vi.spyOn(api.projects, 'list').mockResolvedValue([PROJECT])
      vi.spyOn(api.tasks, 'create').mockResolvedValue(A)
    })
    const create = vi.mocked(api.tasks.create)
    await user.type(
      screen.getByRole('textbox', { name: 'Criação rápida' }),
      'Preparar entrega #Aurora hoje',
    )
    await user.click(screen.getByRole('button', { name: 'Criar tarefa rápida' }))
    await waitFor(() =>
      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Preparar entrega',
          projectId: A.projectId,
          status: 'todo',
        }),
      ),
    )
    expect(create.mock.calls[0]?.[0]?.deadline).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(await screen.findByText('Tarefa criada')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Revisão do relatório/ })).toBeTruthy()
  })

  it('mostra o destino do rodapé ("Projeto · A fazer") e a dica de menções', async () => {
    setup([A], (api) => {
      vi.spyOn(api.projects, 'list').mockResolvedValue([PROJECT])
    })
    expect(await screen.findByText('Aurora · A fazer')).toBeTruthy()
    expect(screen.getByText('Use @pessoa #projeto')).toBeTruthy()
    expect(screen.getByPlaceholderText('Nova tarefa rápida... (@pessoa #projeto)')).toBeTruthy()
  })

  it('sugere projetos ao digitar # e aplica a escolha no texto', async () => {
    const { user } = setup([A], (api) => {
      vi.spyOn(api.projects, 'list').mockResolvedValue([PROJECT])
    })
    const quick = screen.getByRole('textbox', { name: 'Criação rápida' })
    await screen.findByText('Aurora · A fazer')
    await user.type(quick, 'Algo #Au')
    await user.click(await screen.findByRole('option', { name: /#Aurora/ }))
    expect((quick as HTMLInputElement).value).toBe('Algo #Aurora ')
  })

  it('lista "Em foco (N)" com ID, projeto, estado e título; sem saudação nem Recentes/Frequentes', async () => {
    setup()
    expect(await screen.findByRole('button', { name: /Revisão do relatório/ })).toBeTruthy()
    expect(screen.getByText('Em foco (2)')).toBeTruthy()
    expect(screen.getAllByText('A fazer').length).toBeGreaterThan(0)
    expect(screen.getByText('+ Detalhada')).toBeTruthy()
    expect(screen.queryByRole('heading', { level: 2 })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Recentes' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Frequentes' })).toBeNull()
    expect(screen.queryByText(/Ver quadro/)).toBeNull()
  })

  it('a janela expandida tem altura fixa de 630 e não tem botão de fechar nem alça', async () => {
    const { shell } = setup()
    await screen.findByRole('button', { name: /Revisão do relatório/ })
    await waitFor(() =>
      expect(shell.setTrayHeight).toHaveBeenLastCalledWith({ height: 630, width: 430 }),
    )
    expect(screen.queryByRole('button', { name: 'Fechar' })).toBeNull()
    expect(screen.queryByRole('separator')).toBeNull()
  })

  it('busca por título e projeto sem acentos e mostra o vazio', async () => {
    const { user } = setup()
    await screen.findByRole('button', { name: /Revisão do relatório/ })
    const search = screen.getByLabelText('Buscar tarefas na bandeja')
    await user.type(search, 'revisao')
    expect(screen.queryByRole('button', { name: /Publicar versão/ })).toBeNull()
    expect(screen.getByText('Resultados (1)')).toBeTruthy()
    await user.clear(search)
    await user.type(search, 'boreal')
    expect(screen.getByRole('button', { name: /Publicar versão/ })).toBeTruthy()
    await user.clear(search)
    await user.type(search, 'zzz')
    expect(await screen.findByText('Nenhuma tarefa encontrada')).toBeTruthy()
    expect(screen.getByText('Use o campo abaixo para criar rapidamente.')).toBeTruthy()
  })

  it('mostra o ID de cada tarefa e busca pelo número', async () => {
    const { user } = setup([A, { ...B, number: 7, key: 'AB-7' }])
    expect(await screen.findByText('AB-118')).toBeTruthy()
    expect(screen.getByText('AB-7')).toBeTruthy()
    await user.type(screen.getByLabelText('Buscar tarefas na bandeja'), '7')
    expect(screen.queryByRole('button', { name: /Revisão do relatório/ })).toBeNull()
    expect(screen.getByRole('button', { name: /Publicar versão/ })).toBeTruthy()
  })

  it('mostra o sinal Bloqueada só nas tarefas bloqueadas', async () => {
    setup([{ ...A, blockedReason: 'Aguardando GLPI', blockedAt: '2026-11-01T12:00:00.000Z' }, B])
    expect(await screen.findByText('Bloqueada')).toBeTruthy()
    expect(screen.getAllByText('Bloqueada')).toHaveLength(1)
  })

  it('não lista tarefas concluídas em foco', async () => {
    setup([A, { ...B, status: 'done' }])
    expect(await screen.findByRole('button', { name: /Revisão do relatório/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Publicar versão/ })).toBeNull()
  })
})

describe('Bandeja: atalhos e atualização entre janelas', () => {
  it('a tecla N foca a criação rápida, mas não rouba letras digitadas na busca', async () => {
    const { user } = setup()
    await screen.findByRole('button', { name: /Revisão do relatório/ })
    const quick = screen.getByRole('textbox', { name: 'Criação rápida' })
    await user.keyboard('n')
    expect(quick).toBe(document.activeElement)
    await user.click(screen.getByLabelText('Buscar tarefas na bandeja'))
    await user.keyboard('n')
    expect(screen.getByLabelText<HTMLInputElement>('Buscar tarefas na bandeja').value).toBe('n')
    expect(quick).not.toBe(document.activeElement)
  })

  it('recarrega as tarefas quando outra janela avisa uma mudança', async () => {
    let notify: Parameters<AgileBoxApi['onChanges']>[0] = () => undefined
    const { listBoard } = setup([A], (api) => {
      vi.spyOn(api, 'onChanges').mockImplementation((callback) => {
        notify = callback
        return () => undefined
      })
    })
    await screen.findByRole('button', { name: /Revisão do relatório/ })
    expect(listBoard).toHaveBeenCalledTimes(1)
    act(() => notify({ kind: 'task', ids: [A.id] }))
    await waitFor(() => expect(listBoard).toHaveBeenCalledTimes(2))
  })
})

describe('Bandeja: atualizar tarefa', () => {
  const ITEM_1 = '01J8Y4G2XK8Z1S6M3Q9W0A5CK1'
  const ITEM_2 = '01J8Y4G2XK8Z1S6M3Q9W0A5CK2'
  const checklist = [
    {
      id: ITEM_1,
      taskId: A.id,
      title: 'Conferir cláusulas',
      done: true,
      position: 0,
      createdAt: A.createdAt,
      doneAt: A.createdAt,
    },
    {
      id: ITEM_2,
      taskId: A.id,
      title: 'Validar anexo',
      done: false,
      position: 1,
      createdAt: A.createdAt,
      doneAt: null,
    },
  ]

  it('abre a tarefa com ID, projeto, título, estado e subtarefas como no protótipo', async () => {
    const { api, user } = setup()
    vi.spyOn(api.tasks, 'get').mockResolvedValue(
      makeDetail({ id: A.id, title: A.title, checklist }),
    )
    await user.click(await screen.findByRole('button', { name: /Revisão do relatório/ }))
    expect(api.tasks.recordOpen).toHaveBeenCalledWith({ taskId: A.id })
    expect(await screen.findByRole('heading', { name: 'Revisão do relatório' })).toBeTruthy()
    expect(screen.getByText('Estado')).toBeTruthy()
    expect(screen.getByText('Subtarefas')).toBeTruthy()
    expect(screen.getByText('1/2')).toBeTruthy()
    expect(screen.getByText('Horas registradas')).toBeTruthy()
    expect(screen.getByRole('button', { name: '+0,5h' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '+1h' })).toBeTruthy()
    expect(screen.getByText('Nota e impedimento')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Salvar alterações' })).toBeTruthy()
  })

  it('salva estado, subtarefa, horas e nota pela application e volta com aviso', async () => {
    const { api, shell, user } = setup()
    vi.spyOn(api.tasks, 'get').mockResolvedValue(
      makeDetail({ id: A.id, title: A.title, checklist }),
    )
    const toggle = vi.spyOn(api.tasks.checklist, 'toggle').mockResolvedValue(A)
    const move = vi.spyOn(api.tasks, 'move').mockResolvedValue(A)
    const comment = vi
      .spyOn(api.tasks.comments, 'add')
      .mockResolvedValue({} as Awaited<ReturnType<AgileBoxApi['tasks']['comments']['add']>>)
    const setHours = vi
      .spyOn(api.participations, 'setHours')
      .mockResolvedValue({} as Awaited<ReturnType<AgileBoxApi['participations']['setHours']>>)

    await user.click(await screen.findByRole('button', { name: /Revisão do relatório/ }))
    await waitFor(() =>
      expect(shell.setTrayHeight).toHaveBeenLastCalledWith({ height: 630, width: 430 }),
    )
    await user.selectOptions(await screen.findByLabelText('Estado da tarefa'), 'review')
    await user.click(screen.getByRole('checkbox', { name: 'Validar anexo' }))
    await user.click(screen.getByRole('button', { name: '+1h' }))
    await user.click(screen.getByRole('button', { name: '+0,5h' }))
    await user.type(screen.getByLabelText('Nota e impedimento'), 'Alinhado com o cliente')
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }))

    await waitFor(() => expect(move).toHaveBeenCalledWith({ taskId: A.id, status: 'review' }))
    expect(toggle).toHaveBeenCalledWith({ taskId: A.id, itemId: ITEM_2, done: true })
    expect(setHours).toHaveBeenCalledWith(expect.objectContaining({ hours: '4' }))
    expect(comment).toHaveBeenCalledWith({ taskId: A.id, body: 'Alinhado com o cliente' })
    expect(await screen.findByText('Atualização salva')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Revisão do relatório/ })).toBeTruthy()
  })

  it('pede confirmação ao voltar com alterações não salvas (Continuar / Descartar)', async () => {
    const { api, user } = setup()
    vi.spyOn(api.tasks, 'get').mockResolvedValue(
      makeDetail({ id: A.id, title: A.title, checklist }),
    )
    const move = vi.spyOn(api.tasks, 'move').mockResolvedValue(A)
    await user.click(await screen.findByRole('button', { name: /Revisão do relatório/ }))
    await user.selectOptions(await screen.findByLabelText('Estado da tarefa'), 'review')
    await user.click(screen.getByRole('button', { name: 'Voltar para início' }))

    const dialog = await screen.findByRole('dialog', { name: 'Alterações não salvas' })
    await user.click(within(dialog).getByRole('button', { name: 'Continuar' }))
    expect(screen.queryByRole('dialog', { name: 'Alterações não salvas' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Salvar alterações' })).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Voltar para início' }))
    await user.click(
      within(await screen.findByRole('dialog', { name: 'Alterações não salvas' })).getByRole(
        'button',
        { name: 'Descartar' },
      ),
    )
    expect(await screen.findByText('Em foco (2)')).toBeTruthy()
    expect(move).not.toHaveBeenCalled()
  })

  it('volta direto, sem confirmação, quando nada mudou', async () => {
    const { api, user } = setup()
    vi.spyOn(api.tasks, 'get').mockResolvedValue(makeDetail({ id: A.id, title: A.title }))
    await user.click(await screen.findByRole('button', { name: /Revisão do relatório/ }))
    await screen.findByRole('heading', { name: 'Revisão do relatório' })
    await user.click(screen.getByRole('button', { name: 'Voltar para início' }))
    expect(await screen.findByText('Em foco (2)')).toBeTruthy()
  })

  it('não salva nada quando a tarefa é somente leitura', async () => {
    const { api, user } = setup()
    vi.spyOn(api.tasks, 'get').mockResolvedValue(
      makeDetail({ id: A.id, title: A.title, canEdit: false, readOnly: true }),
    )
    await user.click(await screen.findByRole('button', { name: /Revisão do relatório/ }))
    expect(await screen.findByText('Somente leitura')).toBeTruthy()
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'Salvar alterações' }).disabled,
    ).toBe(true)
    expect(screen.getByLabelText<HTMLTextAreaElement>('Nota e impedimento').disabled).toBe(true)
  })
})

describe('Bandeja: nova tarefa', () => {
  const projects: ProjectDto[] = [
    { ...PROJECT, id: '01J8Y4G2XK8Z1S6M3Q9W0A5P01', name: 'Aurora' },
    { ...PROJECT, id: '01J8Y4G2XK8Z1S6M3Q9W0A5P02', name: 'Boreal' },
  ]

  it('mostra título, projeto, estado inicial e responsável com Cancelar e Criar tarefa', async () => {
    const { api, shell, user } = setup()
    vi.spyOn(api.projects, 'list').mockResolvedValue(projects)
    await user.click(await screen.findByRole('button', { name: '+ Detalhada' }))
    await waitFor(() =>
      expect(shell.setTrayHeight).toHaveBeenLastCalledWith({ height: 630, width: 430 }),
    )
    expect(screen.getByLabelText('O que precisa ser feito?')).toBeTruthy()
    expect(screen.getByLabelText('Projeto')).toBeTruthy()
    expect(screen.getByLabelText('Estado inicial')).toBeTruthy()
    expect(screen.getByLabelText('Responsável')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(await screen.findByText('Em foco (2)')).toBeTruthy()
  })

  it('cria com o projeto e o estado escolhidos e volta ao início com "Tarefa criada"', async () => {
    const { api, user } = setup()
    vi.spyOn(api.projects, 'list').mockResolvedValue(projects)
    vi.spyOn(api.session, 'listUsers').mockResolvedValue([
      { id: ME, name: 'Pedro', initials: 'PE', role: 'collaborator' } as Awaited<
        ReturnType<AgileBoxApi['session']['listUsers']>
      >[number],
    ])
    const created = task('01J8Y4G2XK8Z1S6M3Q9W0A5BC3', 'Nova coisa')
    const create = vi.spyOn(api.tasks, 'create').mockResolvedValue(created)

    await user.click(await screen.findByRole('button', { name: '+ Detalhada' }))
    await user.type(await screen.findByLabelText('O que precisa ser feito?'), 'Nova coisa')
    await user.selectOptions(screen.getByLabelText('Projeto'), projects[1]!.id)
    await user.selectOptions(screen.getByLabelText('Estado inicial'), 'in_progress')
    await user.click(screen.getByRole('button', { name: 'Criar tarefa' }))

    await waitFor(() =>
      expect(create).toHaveBeenCalledWith({
        projectId: projects[1]!.id,
        title: 'Nova coisa',
        status: 'in_progress',
        responsibleId: ME,
      }),
    )
    expect(await screen.findByText('Tarefa criada')).toBeTruthy()
    expect(screen.getByText('Em foco (2)')).toBeTruthy()
  })
})

describe('Bandeja: aviso inicial compacto e Chat com o Kan', () => {
  it('abre compacta (340×62), expande para 430×630 e entra no Kan com "Chave AI"', async () => {
    const { shell, user } = setup([A, B], undefined, 'prompt')

    expect(await screen.findByText('Vamos atualizar as atividades de hoje?')).toBeTruthy()
    expect(await screen.findByText('2 tarefas em foco · clique para abrir')).toBeTruthy()
    await waitFor(() =>
      expect(shell.setTrayHeight).toHaveBeenLastCalledWith({ height: 62, width: 340 }),
    )

    const openPanelCompact = screen.getByRole('button', { name: 'Abrir sistema completo' })
    expect(openPanelCompact.textContent).toBe('')
    await user.click(openPanelCompact)
    expect(shell.openPanel).toHaveBeenCalledTimes(1)

    await user.click(
      screen.getByRole('button', { name: 'Expandir bandeja para atualizar atividades' }),
    )
    expect(await screen.findByRole('button', { name: /Revisão do relatório/ })).toBeTruthy()
    await waitFor(() =>
      expect(shell.setTrayHeight).toHaveBeenLastCalledWith({ height: 630, width: 430 }),
    )
    expect(screen.getByText('AgileBox Bandeja')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Abrir sistema completo' }).textContent).toBe('')

    await user.click(screen.getByRole('button', { name: 'Abrir chat com o Kan' }))
    expect(await screen.findByRole('log', { name: 'Conversa com o Kan' })).toBeTruthy()
    expect(screen.getByText('Modo local')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Chave AI' })).toBeTruthy()
    expect(screen.getByPlaceholderText('Peça ao Kan ou tire uma dúvida...')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Abrir sistema completo' }).textContent).toBe('')

    await user.click(screen.getByRole('button', { name: 'Recolher para aviso' }))
    await waitFor(() =>
      expect(shell.setTrayHeight).toHaveBeenLastCalledWith({ height: 62, width: 340 }),
    )
    expect(await screen.findByText('Como estão as entregas de hoje?')).toBeTruthy()
  })
})

describe('Bandeja: janela', () => {
  it('abrir sistema completo (↗) abre o painel', async () => {
    const { shell, user } = setup()
    await user.click(await screen.findByRole('button', { name: 'Abrir sistema completo' }))
    expect(shell.openPanel).toHaveBeenCalledTimes(1)
  })

  it('recolher volta para o aviso compacto de 340×62 e clicar expande de novo', async () => {
    const { shell, user } = setup()
    await screen.findByRole('button', { name: /Revisão do relatório/ })
    await user.click(screen.getByRole('button', { name: 'Recolher para aviso' }))
    await waitFor(() =>
      expect(shell.setTrayHeight).toHaveBeenLastCalledWith({ height: 62, width: 340 }),
    )
    expect(screen.queryByRole('button', { name: '+ Detalhada' })).toBeNull()
    await user.click(
      screen.getByRole('button', { name: 'Expandir bandeja para atualizar atividades' }),
    )
    await waitFor(() =>
      expect(shell.setTrayHeight).toHaveBeenLastCalledWith({ height: 630, width: 430 }),
    )
  })

  it('com movimento reduzido, a troca de tamanho não passa por valores intermediários', async () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: (query: string) => ({
        matches: true,
        media: query,
        onchange: null,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false,
      }),
    })
    const { shell, user } = setup([A, B], undefined, 'prompt')
    await user.click(
      await screen.findByRole('button', { name: 'Expandir bandeja para atualizar atividades' }),
    )
    await screen.findByRole('button', { name: /Revisão do relatório/ })
    await waitFor(() =>
      expect(shell.setTrayHeight).toHaveBeenLastCalledWith({ height: 630, width: 430 }),
    )
    const heights = shell.setTrayHeight.mock.calls.map(
      (call) => (call[0] as { height: number }).height,
    )
    expect(new Set(heights)).toEqual(new Set([62, 630]))
  })
})

describe('Bandeja: conferência da definição de pronto ao concluir', () => {
  const ITEM_TESTS = '01J8Y4G2XK8Z1S6M3Q9W0A5DF1'
  const ITEM_REVIEW = '01J8Y4G2XK8Z1S6M3Q9W0A5DF2'
  const definition = [
    { id: ITEM_TESTS, projectId: A.projectId, title: 'Testes passando', position: 0 },
    { id: ITEM_REVIEW, projectId: A.projectId, title: 'Revisado por par', position: 1 },
  ]

  async function openToDone(user: ReturnType<typeof userEvent.setup>) {
    await user.click(await screen.findByRole('button', { name: /Revisão do relatório/ }))
    await user.selectOptions(await screen.findByLabelText('Estado da tarefa'), 'done')
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }))
  }

  it('concluir pela atualização rápida abre a conferência e só salva com todos marcados', async () => {
    const { api, user } = setup()
    vi.spyOn(api.tasks, 'get').mockResolvedValue(
      makeDetail({ id: A.id, title: A.title, status: 'todo', projectDefinitionOfDone: definition }),
    )
    const move = vi.spyOn(api.tasks, 'move').mockResolvedValue(A)

    await openToDone(user)
    const dialog = await screen.findByRole('dialog', { name: /^AB-\d+ · / })
    expect(move).not.toHaveBeenCalled()
    const confirm = within(dialog).getByRole<HTMLButtonElement>('button', { name: 'Concluir' })
    await user.click(within(dialog).getByRole('checkbox', { name: 'Testes passando' }))
    expect(confirm.disabled).toBe(true)
    await user.click(within(dialog).getByRole('checkbox', { name: 'Revisado por par' }))
    await user.click(confirm)

    await waitFor(() =>
      expect(move).toHaveBeenCalledWith({
        taskId: A.id,
        status: 'done',
        confirmedDefinitionItemIds: [ITEM_TESTS, ITEM_REVIEW],
      }),
    )
  })

  it('cancelar a conferência mantém o estado anterior e não salva', async () => {
    const { api, user } = setup()
    vi.spyOn(api.tasks, 'get').mockResolvedValue(
      makeDetail({ id: A.id, title: A.title, status: 'todo', projectDefinitionOfDone: definition }),
    )
    const move = vi.spyOn(api.tasks, 'move').mockResolvedValue(A)

    await openToDone(user)
    const dialog = await screen.findByRole('dialog', { name: /^AB-\d+ · / })
    await user.click(within(dialog).getByRole('button', { name: 'Voltar para A fazer' }))

    expect(screen.queryByRole('dialog', { name: /^AB-\d+ · / })).toBeNull()
    expect(move).not.toHaveBeenCalled()
    expect(screen.getByLabelText<HTMLSelectElement>('Estado da tarefa').value).toBe('todo')
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
