import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AgileBoxApi, DesktopAiApi, TaskDto } from '@agilebox/contract'
import { ApiProvider } from '../../shared/api/ApiProvider'
import { CapabilitiesProvider } from '../../shared/capabilities/CapabilitiesProvider'
import { QueryProvider } from '../../shared/query/QueryProvider'
import { boardResponse, createFakeApi } from '../../shared/testing/fake-api'
import { forbiddenTermsIn, visibleTextOf } from '../../shared/testing/forbidden-terms'
import { presetModules, teamToolsView } from '../../shared/testing/team-tools-fixture'
import { makeDetail, makeParticipation, USER_ID } from '../../panel/task-detail/fixtures'
import { KanChatScreen } from '../screens/KanChatScreen'

const PROJECT_ID = '01J8Y4G2XK8Z1S6M3Q9W0ABCDE'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const TASK: TaskDto = {
  id: '01J8Y4G2XK8Z1S6M3Q9W0A5BC1',
  number: 5,
  key: 'AB-5',
  projectId: PROJECT_ID,
  projectName: 'Aurora',
  title: 'Ajustar webhook',
  description: '',
  status: 'in_progress',
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
}

function setup(configure?: (api: AgileBoxApi) => void, aiOverride?: Partial<DesktopAiApi>) {
  const ai: DesktopAiApi = {
    getConfig: vi.fn().mockResolvedValue({
      configured: false,
      model: 'gemini-2.5-flash',
      encrypted: false,
    }),
    saveConfig: vi.fn(),
    clearKey: vi.fn(),
    testConnection: vi.fn(),
    complete: vi.fn(),
    ...aiOverride,
  }
  vi.stubGlobal('agilebox', {
    shell: {
      minimize: vi.fn(),
      close: vi.fn(),
      toggleTray: vi.fn(),
      openPanel: vi.fn(),
      setTrayHeight: vi.fn(),
      setAppearance: vi.fn(),
    },
    ai,
  })

  const api = createFakeApi()
  vi.spyOn(api.session, 'getCurrent').mockResolvedValue({
    userId: USER_ID,
    organizationId: '01J8Y4G2XK8Z1S6M3Q9W0ABCDE',
    role: 'collaborator',
  })
  vi.spyOn(api.session, 'listUsers').mockResolvedValue([
    { id: USER_ID, name: 'Ana Souza', initials: 'AS', role: 'collaborator', defaultRate: 40 },
  ])
  vi.spyOn(api.projects, 'list').mockResolvedValue([
    {
      id: PROJECT_ID,
      name: 'Aurora',
      createdBy: USER_ID,
      createdAt: TASK.createdAt,
      definitionOfDoneCount: 0,
      archivedAt: null,
    },
  ])
  vi.spyOn(api.tasks, 'listRecent').mockResolvedValue([TASK])
  vi.spyOn(api.tasks, 'listBoard').mockResolvedValue(boardResponse([TASK]))
  configure?.(api)

  render(
    <ApiProvider api={api}>
      <QueryProvider>
        <CapabilitiesProvider>
          <KanChatScreen onBack={() => undefined} onCollapse={() => undefined} />
        </CapabilitiesProvider>
      </QueryProvider>
    </ApiProvider>,
  )

  return { api, ai, user: userEvent.setup() }
}

describe('Chat com o Kan', () => {
  it('mostra o botão "Chave AI" do protótipo, sem badge de conexão e sem termos proibidos no modo básico', async () => {
    setup((api) => {
      vi.spyOn(api.teamTools, 'get').mockResolvedValue(
        teamToolsView({ modules: presetModules('kanban'), level: 'basic' }),
      )
    })

    await screen.findByRole('button', { name: 'AB-5 → Revisar' })
    expect(screen.queryByText(/GEMINI ON/i)).toBeNull()
    expect(screen.getByRole('button', { name: 'Chave AI' })).toBeTruthy()
    expect(screen.getByText('Modo local')).toBeTruthy()
    expect(screen.getByPlaceholderText('Peça ao Kan ou tire uma dúvida...')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Daily' })).toBeNull()
    expect(forbiddenTermsIn(visibleTextOf(document.body))).toEqual([])
  })

  it('executa movimentação real, exibe recibo e permite desfazer', async () => {
    const { api, user } = setup((api) => {
      vi.spyOn(api.tasks, 'get').mockResolvedValue(
        makeDetail({ id: TASK.id, key: TASK.key, title: TASK.title, status: 'in_progress' }),
      )
      vi.spyOn(api.tasks, 'move').mockResolvedValue({ ...TASK, status: 'review' })
    })

    await user.click(await screen.findByRole('button', { name: 'AB-5 → Revisar' }))

    await waitFor(() =>
      expect(api.tasks.move).toHaveBeenCalledWith({ taskId: TASK.id, status: 'review' }),
    )
    const log = screen.getByRole('log', { name: 'Conversa com o Kan' })
    expect(await within(log).findByText('AB-5 → Revisar')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Desfazer' }))
    await waitFor(() =>
      expect(api.tasks.move).toHaveBeenLastCalledWith({ taskId: TASK.id, status: 'in_progress' }),
    )
    expect(await screen.findByRole('button', { name: 'Desfeito' })).toBeTruthy()
  })

  it('lança horas reais e desfaz restaurando o valor anterior', async () => {
    const { api, user } = setup((api) => {
      vi.spyOn(api.tasks, 'get').mockResolvedValue(
        makeDetail({
          id: TASK.id,
          key: TASK.key,
          title: TASK.title,
          participations: [makeParticipation({ id: 'part-1', hours: 2 })],
        }),
      )
      vi.spyOn(api.participations, 'setHours').mockResolvedValue(
        makeParticipation({ id: 'part-1', hours: 3 }),
      )
    })

    await user.click(await screen.findByRole('button', { name: '+1h em AB-5' }))

    await waitFor(() =>
      expect(api.participations.setHours).toHaveBeenCalledWith({
        taskId: TASK.id,
        participationId: 'part-1',
        hours: '3',
      }),
    )
    const log = screen.getByRole('log', { name: 'Conversa com o Kan' })
    expect(await within(log).findByText('+1h em AB-5')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Desfazer' }))
    await waitFor(() =>
      expect(api.participations.setHours).toHaveBeenLastCalledWith({
        taskId: TASK.id,
        participationId: 'part-1',
        hours: '2',
      }),
    )
  })

  it('aciona conferência da definição de pronto ao concluir pelo chat', async () => {
    const DOD_ID = '01J8Y4G2XK8Z1S6M3Q9W0DOD01'
    const { api, user } = setup((api) => {
      vi.spyOn(api.tasks, 'get').mockResolvedValue(
        makeDetail({
          id: TASK.id,
          key: TASK.key,
          title: TASK.title,
          status: 'review',
          projectDefinitionOfDone: [
            { id: DOD_ID, projectId: PROJECT_ID, title: 'Testes passando', position: 0 },
          ],
        }),
      )
      vi.spyOn(api.tasks, 'move').mockResolvedValue({ ...TASK, status: 'done' })
    })

    await user.type(screen.getByLabelText('Mensagem para o Kan'), 'Mover AB-5 para concluído')
    await user.click(screen.getByRole('button', { name: 'Enviar' }))

    const dialog = await screen.findByRole('dialog', { name: 'AB-5 · Ajustar webhook' })
    expect(api.tasks.move).not.toHaveBeenCalled()

    await user.click(within(dialog).getByRole('checkbox', { name: 'Testes passando' }))
    await user.click(within(dialog).getByRole('button', { name: 'Concluir' }))

    await waitFor(() =>
      expect(api.tasks.move).toHaveBeenCalledWith({
        taskId: TASK.id,
        status: 'done',
        confirmedDefinitionItemIds: [DOD_ID],
      }),
    )
  })

  it('usa o Gemini quando configurado em Ajustes e executa a ação estruturada retornada', async () => {
    const createdTask: TaskDto = {
      ...TASK,
      id: '01J8Y4G2XK8Z1S6M3Q9W0A5BC9',
      number: 9,
      key: 'AB-9',
      title: 'Revisar logs',
      status: 'todo',
    }
    const complete = vi.fn<DesktopAiApi['complete']>().mockResolvedValue({
      ok: true,
      reply: 'Criei a tarefa no projeto Aurora.',
      actions: [
        { kind: 'create_task', title: 'Revisar logs', projectId: PROJECT_ID, status: 'todo' },
      ],
    })
    const { api, user } = setup(
      (api) => {
        vi.spyOn(api.tasks, 'create').mockResolvedValue(createdTask)
      },
      {
        getConfig: vi.fn().mockResolvedValue({
          configured: true,
          model: 'gemini-2.5-flash',
          encrypted: true,
        }),
        complete,
      },
    )

    await user.type(screen.getByLabelText('Mensagem para o Kan'), 'Anote aí para revisar logs')
    await user.click(screen.getByRole('button', { name: 'Enviar' }))

    await waitFor(() => expect(complete).toHaveBeenCalledTimes(1))
    await waitFor(() =>
      expect(api.tasks.create).toHaveBeenCalledWith({
        projectId: PROJECT_ID,
        title: 'Revisar logs',
        status: 'todo',
      }),
    )
    expect(await screen.findByText('Criei a tarefa no projeto Aurora.')).toBeTruthy()
    expect(await screen.findByText('AB-9 criada')).toBeTruthy()
  })

  it('"Chave AI" abre o painel de chave, salva pela ponte e passa a mostrar Gemini ON', async () => {
    const saveConfig = vi.fn<DesktopAiApi['saveConfig']>().mockResolvedValue({
      configured: true,
      model: 'gemini-2.0-flash',
      encrypted: true,
    })
    const { user } = setup(undefined, { saveConfig })

    await user.click(await screen.findByRole('button', { name: 'Chave AI' }))
    await user.type(screen.getByLabelText('Chave da API Google AI Studio'), 'AIza-teste')
    await user.selectOptions(screen.getByLabelText('Modelo Gemini'), 'gemini-2.0-flash')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() =>
      expect(saveConfig).toHaveBeenCalledWith({ model: 'gemini-2.0-flash', apiKey: 'AIza-teste' }),
    )
    expect(await screen.findByRole('button', { name: 'Gemini ON' })).toBeTruthy()
    expect(screen.getByText('Gemini · gemini-2.0-flash')).toBeTruthy()
  })
})
