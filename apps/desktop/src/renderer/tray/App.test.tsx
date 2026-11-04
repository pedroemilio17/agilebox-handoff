import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { ProjectDto, TaskDto, AgileBoxApi } from '@agilebox/contract'
import { ApiProvider } from '../shared/api/ApiProvider'
import { QueryProvider } from '../shared/query/QueryProvider'
import { createFakeApi } from '../shared/testing/fake-api'
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

function setup(recent: TaskDto[] = [A, B], configure?: (api: AgileBoxApi) => void) {
  const shell = {
    minimize: vi.fn(),
    close: vi.fn(),
    toggleTray: vi.fn(),
    openPanel: vi.fn(),
    setTrayHeight: vi.fn(),
  }
  vi.stubGlobal('agilebox', { shell })
  const api = createFakeApi()
  const listRecent = vi.spyOn(api.tasks, 'listRecent').mockResolvedValue(recent)
  const listFrequent = vi.spyOn(api.tasks, 'listFrequent').mockResolvedValue([B])
  vi.spyOn(api.tasks, 'recordOpen').mockResolvedValue(undefined)
  vi.spyOn(api.timeline, 'list').mockResolvedValue([])
  configure?.(api)
  render(
    <ApiProvider api={api}>
      <QueryProvider>
        <App />
      </QueryProvider>
    </ApiProvider>,
  )
  return { api, shell, listRecent, listFrequent, user: userEvent.setup() }
}

describe('Bandeja: tela inicial', () => {
  it('cria pelo rodapé com projeto e prazo interpretados e abre o detalhe', async () => {
    const { api, user } = setup([A], (api) => {
      vi.spyOn(api.projects, 'list').mockResolvedValue([
        {
          id: A.projectId,
          name: 'Aurora',
          createdBy: '01J8Y4G2XK8Z1S6M3Q9W0A5V01',
          createdAt: A.createdAt,
        },
      ])
      vi.spyOn(api.tasks, 'create').mockResolvedValue(A)
      vi.spyOn(api.tasks, 'get').mockResolvedValue(makeDetail({ id: A.id }))
    })
    const create = vi.mocked(api.tasks.create)
    await user.type(
      screen.getByRole('textbox', { name: 'Criação rápida' }),
      'Preparar entrega #Aurora hoje',
    )
    await user.keyboard('{Enter}')
    await waitFor(() =>
      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Preparar entrega',
          projectId: A.projectId,
          status: 'todo',
        }),
      ),
    )
    expect(create?.mock.calls[0]?.[0]?.deadline).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    await waitFor(() => expect(api.tasks.recordOpen).toHaveBeenCalledWith({ taskId: A.id }))
  })

  it('lista as tarefas recentes e ajusta a altura pelo número de linhas', async () => {
    const { shell } = setup()
    expect(await screen.findByRole('button', { name: /Revisão do relatório/ })).toBeTruthy()
    await waitFor(() => expect(shell.setTrayHeight).toHaveBeenLastCalledWith({ height: 374 }))
  })

  it('com uma tarefa a altura é de uma linha', async () => {
    const { shell } = setup([A])
    await screen.findByRole('button', { name: /Revisão do relatório/ })
    await waitFor(() => expect(shell.setTrayHeight).toHaveBeenLastCalledWith({ height: 310 }))
  })

  it('busca por título e projeto sem acentos e mostra o vazio', async () => {
    const { user } = setup()
    await screen.findByRole('button', { name: /Revisão do relatório/ })
    await user.type(screen.getByLabelText('Buscar tarefa'), 'revisao')
    expect(screen.queryByRole('button', { name: /Publicar versão/ })).toBeNull()
    await user.clear(screen.getByLabelText('Buscar tarefa'))
    await user.type(screen.getByLabelText('Buscar tarefa'), 'boreal')
    expect(screen.getByRole('button', { name: /Publicar versão/ })).toBeTruthy()
    await user.clear(screen.getByLabelText('Buscar tarefa'))
    await user.type(screen.getByLabelText('Buscar tarefa'), 'zzz')
    expect(await screen.findByText('Nenhuma tarefa encontrada.')).toBeTruthy()
  })

  it('mostra o ID de cada tarefa e busca pelo número', async () => {
    const { user } = setup([A, { ...B, number: 7, key: 'AB-7' }])
    expect(await screen.findByText('AB-118')).toBeTruthy()
    expect(screen.getByText('AB-7')).toBeTruthy()
    await user.type(screen.getByLabelText('Buscar tarefa'), '7')
    expect(screen.queryByRole('button', { name: /Revisão do relatório/ })).toBeNull()
    expect(screen.getByRole('button', { name: /Publicar versão/ })).toBeTruthy()
  })

  it('mostra o sinal Alta só nas tarefas de prioridade alta', async () => {
    setup([{ ...A, priority: 'high' }, B])
    expect(await screen.findByText('Alta')).toBeTruthy()
    expect(screen.getAllByText('Alta')).toHaveLength(1)
    expect(screen.getByRole('button', { name: /Revisão do relatório/ })).toBeTruthy()
  })

  it('mostra o sinal Bloqueada só nas tarefas bloqueadas', async () => {
    setup([{ ...A, blockedReason: 'Aguardando GLPI', blockedAt: '2026-11-01T12:00:00.000Z' }, B])
    expect(await screen.findByText('Bloqueada')).toBeTruthy()
    expect(screen.getAllByText('Bloqueada')).toHaveLength(1)
  })

  it('alterna para Frequentes e mostra o vazio quando não há tarefa aberta', async () => {
    const { user, listFrequent } = setup([])
    expect(await screen.findByText('Nenhuma tarefa aberta ainda.')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Frequentes' }))
    await waitFor(() => expect(listFrequent).toHaveBeenCalled())
    expect(await screen.findByRole('button', { name: /Publicar versão/ })).toBeTruthy()
  })
})

describe('Bandeja: atalhos e atualização entre janelas', () => {
  it('a tecla N foca a criação rápida, mas não rouba letras digitadas na busca', async () => {
    const { user } = setup()
    await screen.findByRole('button', { name: /Revisão do relatório/ })
    const quick = screen.getByRole('textbox', { name: 'Criação rápida' })
    await user.keyboard('n')
    expect(quick).toBe(document.activeElement)
    await user.click(screen.getByLabelText('Buscar tarefa'))
    await user.keyboard('n')
    expect(screen.getByLabelText<HTMLInputElement>('Buscar tarefa').value).toBe('n')
    expect(quick).not.toBe(document.activeElement)
  })

  it('recarrega as tarefas quando outra janela avisa uma mudança', async () => {
    let notify: Parameters<AgileBoxApi['onChanges']>[0] = () => undefined
    const { listRecent } = setup([A], (api) => {
      vi.spyOn(api, 'onChanges').mockImplementation((callback) => {
        notify = callback
        return () => undefined
      })
    })
    await screen.findByRole('button', { name: /Revisão do relatório/ })
    expect(listRecent).toHaveBeenCalledTimes(1)
    act(() => notify({ kind: 'task', ids: [A.id] }))
    await waitFor(() => expect(listRecent).toHaveBeenCalledTimes(2))
  })
})

describe('Bandeja: atualizar tarefa', () => {
  it('abre a tarefa, salva as mudanças e volta à lista com aviso e destaque', async () => {
    const { api, shell, user } = setup()
    vi.spyOn(api.tasks, 'get').mockResolvedValue(makeDetail({ id: A.id, title: A.title }))
    const update = vi.spyOn(api.tasks, 'update').mockResolvedValue(A)
    const move = vi.spyOn(api.tasks, 'move').mockResolvedValue(A)

    await user.click(await screen.findByRole('button', { name: /Revisão do relatório/ }))
    expect(api.tasks.recordOpen).toHaveBeenCalledWith({ taskId: A.id })
    await waitFor(() => expect(shell.setTrayHeight).toHaveBeenLastCalledWith({ height: 560 }))

    const doing = await screen.findByLabelText('O que será feito')
    await user.clear(doing)
    await user.type(doing, 'Feito hoje')
    await user.click(screen.getByRole('button', { name: 'Status' }))
    await user.click(screen.getByRole('menuitemradio', { name: 'Revisar' }))
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() =>
      expect(update).toHaveBeenCalledWith({ taskId: A.id, changes: { description: 'Feito hoje' } }),
    )
    expect(move).toHaveBeenCalledWith({ taskId: A.id, status: 'review' })
    expect(await screen.findByText('Atualização salva')).toBeTruthy()
    expect(
      (await screen.findByRole('button', { name: /Revisão do relatório/ })).getAttribute(
        'data-highlighted',
      ),
    ).toBe('true')
  })

  it('não salva nada quando a tarefa é somente leitura', async () => {
    const { api, user } = setup()
    vi.spyOn(api.tasks, 'get').mockResolvedValue(
      makeDetail({ id: A.id, title: A.title, canEdit: false, readOnly: true }),
    )
    await user.click(await screen.findByRole('button', { name: /Revisão do relatório/ }))
    expect(await screen.findByText('Somente leitura')).toBeTruthy()
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Salvar' }).disabled).toBe(true)
    expect(screen.getByLabelText<HTMLTextAreaElement>('O que será feito').disabled).toBe(true)
  })
})

describe('Bandeja: nova tarefa', () => {
  it('interpreta projeto e data também no formulário de criação', async () => {
    const { api, user } = setup([], (api) => {
      vi.spyOn(api.projects, 'list').mockResolvedValue([
        { id: A.projectId, name: 'Aurora', createdBy: A.id, createdAt: A.createdAt },
      ])
      vi.spyOn(api.tasks, 'create').mockResolvedValue(A)
      vi.spyOn(api.tasks, 'get').mockResolvedValue(makeDetail({ id: A.id }))
    })
    await user.click(screen.getByRole('button', { name: 'Nova tarefa' }))
    await user.type(screen.getByLabelText('Título'), 'Revisar #Aurora hoje')
    await user.click(screen.getByRole('button', { name: 'Criar tarefa' }))
    await waitFor(() =>
      expect(api.tasks.create).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Revisar', projectId: A.projectId, status: 'todo' }),
      ),
    )
    expect(vi.mocked(api.tasks.create).mock.calls[0]?.[0]?.deadline).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('cria, abre a tarefa e ao voltar mostra "Tarefa criada"', async () => {
    const { api, shell, user } = setup()
    const projects: ProjectDto[] = [
      { id: '01J8Y4G2XK8Z1S6M3Q9W0A5P01', name: 'Aurora', createdBy: A.id, createdAt: A.createdAt },
      { id: '01J8Y4G2XK8Z1S6M3Q9W0A5P02', name: 'Boreal', createdBy: A.id, createdAt: A.createdAt },
    ]
    vi.spyOn(api.projects, 'list').mockResolvedValue(projects)
    const created = task('01J8Y4G2XK8Z1S6M3Q9W0A5BC3', 'Nova coisa')
    const create = vi.spyOn(api.tasks, 'create').mockResolvedValue(created)
    vi.spyOn(api.tasks, 'get').mockResolvedValue(
      makeDetail({ id: created.id, title: created.title }),
    )

    await user.click(await screen.findByRole('button', { name: 'Nova tarefa' }))
    await waitFor(() => expect(shell.setTrayHeight).toHaveBeenLastCalledWith({ height: 316 }))
    const submit = screen.getByRole<HTMLButtonElement>('button', { name: 'Criar tarefa' })
    expect(submit.disabled).toBe(true)
    await user.type(screen.getByLabelText('Título'), 'Nova coisa')
    await user.click(screen.getByRole('button', { name: 'Boreal' }))
    await user.click(submit)

    await waitFor(() =>
      expect(create).toHaveBeenCalledWith({ projectId: projects[1]!.id, title: 'Nova coisa' }),
    )
    expect(await screen.findByLabelText('O que será feito')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: /Voltar/ }))
    expect(await screen.findByText('Tarefa criada')).toBeTruthy()
  })
})

describe('Bandeja: janela', () => {
  it('expandir abre o painel e fechar esconde a bandeja', async () => {
    const { shell, user } = setup()
    await user.click(await screen.findByRole('button', { name: 'Expandir' }))
    await user.click(screen.getByRole('button', { name: 'Fechar' }))
    expect(shell.openPanel).toHaveBeenCalledTimes(1)
    expect(shell.close).toHaveBeenCalledTimes(1)
  })

  it('minimizar recolhe para o cabeçalho de 52 px e restaura', async () => {
    const { shell, user } = setup()
    await screen.findByRole('button', { name: /Revisão do relatório/ })
    await user.click(screen.getByRole('button', { name: 'Minimizar' }))
    await waitFor(() => expect(shell.setTrayHeight).toHaveBeenLastCalledWith({ height: 52 }))
    expect(screen.queryByRole('button', { name: 'Nova tarefa' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Minimizar' }))
    await waitFor(() => expect(shell.setTrayHeight).toHaveBeenLastCalledWith({ height: 374 }))
  })

  it('a barrinha ajusta a altura pelo teclado e volta ao automático com Home', async () => {
    const { shell, user } = setup()
    await screen.findByRole('button', { name: /Revisão do relatório/ })
    const handle = screen.getByRole('separator')
    handle.focus()
    await user.keyboard('{ArrowUp}')
    await waitFor(() => expect(shell.setTrayHeight).toHaveBeenLastCalledWith({ height: 398 }))
    await user.keyboard('{ArrowDown}{ArrowDown}')
    await waitFor(() => expect(shell.setTrayHeight).toHaveBeenLastCalledWith({ height: 350 }))
    await user.keyboard('{Home}')
    await waitFor(() => expect(shell.setTrayHeight).toHaveBeenLastCalledWith({ height: 374 }))
  })

  it('respeita os limites de 260 e 600 px', async () => {
    const { shell, user } = setup()
    await screen.findByRole('button', { name: /Revisão do relatório/ })
    screen.getByRole('separator').focus()
    for (let i = 0; i < 20; i += 1) await user.keyboard('{ArrowUp}')
    await waitFor(() => expect(shell.setTrayHeight).toHaveBeenLastCalledWith({ height: 600 }))
    for (let i = 0; i < 30; i += 1) await user.keyboard('{ArrowDown}')
    await waitFor(() => expect(shell.setTrayHeight).toHaveBeenLastCalledWith({ height: 260 }))
  })
})

describe('Bandeja: progresso das subtarefas', () => {
  it('mostra 2/5 na linha da tarefa sem editar nada', async () => {
    setup([{ ...A, checklistProgress: { done: 2, total: 5, percent: 40 } }, B])
    expect(await screen.findByText('2/5')).toBeTruthy()
    expect(screen.queryByText('0/0')).toBeNull()
    expect(screen.queryByRole('checkbox')).toBeNull()
  })
})

describe('Bandeja: contador de comentários', () => {
  it('mostra o balão com a contagem na linha, sem editar nada', async () => {
    setup([{ ...A, commentCount: 3 }, B])
    expect(await screen.findByRole('img', { name: '3 comentários' })).toBeTruthy()
    expect(screen.queryByRole('img', { name: '0 comentários' })).toBeNull()
    expect(screen.queryByRole('checkbox')).toBeNull()
  })
})
