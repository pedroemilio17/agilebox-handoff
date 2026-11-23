import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DailyEntryDto, ImpedimentListItemDto, TaskDto } from '@agilebox/contract'
import { ApiProvider } from '../shared/api/ApiProvider'
import { QueryProvider } from '../shared/query/QueryProvider'
import { createFakeApi, boardResponse } from '../shared/testing/fake-api'
import { presetModules, teamToolsView } from '../shared/testing/team-tools-fixture'
import { todayDateOnly } from '../shared/lib/today'
import { impedimentCopy } from '../panel/impediments/impediment-copy'
import { App } from './App'

/**
 * Passo 3 da daily ("Algo te bloqueia?"): o painel "Seus impedimentos abertos" só existe com o
 * módulo `impediments` ativo. "Usar" preenche o campo, sem gravar; "Concluir" é que grava.
 */

const ME = '01J8Y4G2XK8Z1S6M3Q9W0A5V01'
const ORG = '01J8Y4G2XK8Z1S6M3Q9W0ABCDE'
const TODAY = todayDateOnly()
const SCRUM = presetModules('scrum')
const SCRUM_NO_IMPEDIMENTS = SCRUM.filter((module) => module !== 'impediments')

const task = (id: string, title: string): TaskDto => ({
  id,
  number: 118,
  key: 'AB-118',
  projectId: '01J8Y4G2XK8Z1S6M3Q9W0ABCDE',
  projectName: 'Aurora',
  title,
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
})

const A = task('01J8Y4G2XK8Z1S6M3Q9W0A5BC1', 'Revisão do relatório')

const IMPEDIMENT: ImpedimentListItemDto = {
  id: '01J8Y4G2XK8Z1S6M3Q9W0B1001',
  taskId: A.id,
  status: 'open',
  reason: 'Aguardo acesso ao servidor',
  ownerId: ME,
  ownerName: 'Pedro',
  openedBy: ME,
  openedAt: '2026-11-10T10:00:00.000Z',
  resolvedBy: null,
  resolvedAt: null,
  resolution: null,
  taskKey: 'AB-118',
  taskTitle: 'Revisão do relatório',
  projectId: A.projectId,
  projectName: 'Aurora',
}

beforeEach(() => {
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

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function setup({
  modules,
  impediments = [IMPEDIMENT],
  recent = [A],
}: {
  modules: readonly string[]
  impediments?: ImpedimentListItemDto[]
  recent?: TaskDto[]
}) {
  vi.stubGlobal('agilebox', {
    shell: {
      minimize: vi.fn(),
      close: vi.fn(),
      toggleTray: vi.fn(),
      openPanel: vi.fn(),
      setTrayHeight: vi.fn(),
    },
  })
  const api = createFakeApi()
  vi.spyOn(api.session, 'getCurrent').mockResolvedValue({
    userId: ME,
    organizationId: ORG,
    role: 'collaborator',
  })
  vi.spyOn(api.teamTools, 'get').mockResolvedValue(
    teamToolsView({ modules: modules as never, level: 'intermediate' }),
  )
  vi.spyOn(api.tasks, 'listRecent').mockResolvedValue(recent)
  vi.spyOn(api.tasks, 'listFrequent').mockResolvedValue([])
  vi.spyOn(api.tasks, 'recordOpen').mockResolvedValue(undefined)
  // A tela inicial prefere a versão do quadro (listBoard) quando ela existe.
  vi.spyOn(api.tasks, 'listBoard').mockResolvedValue(boardResponse(recent))
  vi.spyOn(api.daily, 'suggestSummary').mockResolvedValue({
    advanced: [],
    nextCandidates: [],
    blockers: [],
  })
  const impedimentList = vi
    .spyOn(api.impediments, 'list')
    .mockImplementation(() => Promise.resolve(impediments))
  let stored: DailyEntryDto | null = null
  vi.spyOn(api.daily, 'getToday').mockImplementation(({ date }) =>
    Promise.resolve({ date, due: stored === null, entry: stored }),
  )
  const save = vi.spyOn(api.daily, 'save').mockImplementation((input) => {
    stored = {
      id: '01J8Y4G2XK8Z1S6M3Q9W0DAY01',
      userId: ME,
      userName: 'Pedro',
      date: TODAY,
      answers: input.answers,
      noNews: input.noNews ?? false,
      taskRefs: input.taskRefs ?? [],
      createdAt: '2026-11-16T12:00:00.000Z',
      updatedAt: '2026-11-16T12:00:00.000Z',
    }
    return Promise.resolve(stored)
  })
  render(
    <ApiProvider api={api}>
      <QueryProvider>
        <App initialScreen="home" />
      </QueryProvider>
    </ApiProvider>,
  )
  return { api, impedimentList, save, user: userEvent.setup() }
}

/** Abre a daily e avança até o passo 3 ("Algo te bloqueia?"). */
async function goToStepThree(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Atualizar agora' }))
  await screen.findByRole('heading', { name: 'O que você avançou hoje?' })
  await user.click(screen.getByRole('button', { name: 'Próximo' }))
  await user.click(screen.getByRole('button', { name: 'Próximo' }))
  await screen.findByRole('heading', { name: 'Algo te bloqueia?' })
}

describe('Bandeja · Seus impedimentos abertos (passo 3)', () => {
  it('lista os abertos do usuário e "Usar" só preenche o campo, sem gravar', async () => {
    const { impedimentList, save, user } = setup({ modules: SCRUM })
    await goToStepThree(user)
    const panel = await screen.findByRole('region', { name: impedimentCopy.trayTitle })
    expect(impedimentList).toHaveBeenCalledWith({ ownerId: ME })
    await waitFor(() => expect(within(panel).getByText(/AB-118 · Aguardo acesso/)).toBeTruthy())

    await user.click(within(panel).getByRole('button', { name: 'Usar' }))
    const field = screen.getByLabelText<HTMLTextAreaElement>('Impedimento')
    expect(field.value).toBe('AB-118 · Aguardo acesso ao servidor')
    expect(save).not.toHaveBeenCalled()

    // Usar de novo não duplica a linha.
    await user.click(within(panel).getByRole('button', { name: 'Usar' }))
    expect(field.value).toBe('AB-118 · Aguardo acesso ao servidor')
  })

  it('o texto preenchido é editável e só o Concluir grava', async () => {
    const { save, user } = setup({ modules: SCRUM })
    await goToStepThree(user)
    const panel = await screen.findByRole('region', { name: impedimentCopy.trayTitle })
    await user.click(await within(panel).findByRole('button', { name: 'Usar' }))
    const field = screen.getByLabelText('Impedimento')
    await user.type(field, ' (já pedi)')
    expect((field as HTMLTextAreaElement).value).toContain('(já pedi)')
    expect(save).not.toHaveBeenCalled()
    // Do passo 3 vai ao resumo; Concluir grava.
    await user.click(screen.getByRole('button', { name: 'Próximo' }))
    await user.click(screen.getByRole('button', { name: 'Concluir' }))
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1))
    expect(save.mock.calls[0]![0].answers.blocker).toContain('(já pedi)')
  })

  it('sem impedimentos abertos mostra o estado vazio', async () => {
    const { user } = setup({ modules: SCRUM, impediments: [] })
    await goToStepThree(user)
    const panel = await screen.findByRole('region', { name: impedimentCopy.trayTitle })
    expect(await within(panel).findByText('Nenhum impedimento aberto.')).toBeTruthy()
    expect(within(panel).queryByRole('button', { name: 'Usar' })).toBeNull()
  })

  it('com o módulo impedimentos desligado (check-ins ligado) o painel não aparece e nada é consultado', async () => {
    const { impedimentList, user } = setup({ modules: SCRUM_NO_IMPEDIMENTS })
    await goToStepThree(user)
    expect(screen.queryByRole('region', { name: impedimentCopy.trayTitle })).toBeNull()
    expect(screen.queryByText(impedimentCopy.trayTitle)).toBeNull()
    expect(impedimentList).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Usar' })).toBeNull()
  })

  it('erro ao carregar mostra o aviso e não bloqueia o campo', async () => {
    const { impedimentList, user } = setup({ modules: SCRUM })
    impedimentList.mockRejectedValue(new Error('falhou'))
    await goToStepThree(user)
    const panel = await screen.findByRole('region', { name: impedimentCopy.trayTitle })
    expect(await within(panel).findByRole('alert')).toBeTruthy()
    expect(screen.getByLabelText('Impedimento')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Impedimento'), { target: { value: 'livre' } })
    expect(screen.getByLabelText<HTMLTextAreaElement>('Impedimento').value).toBe('livre')
  })

  it('a linha da tela inicial mostra "Bloqueada" com o responsável no title', async () => {
    setup({
      modules: SCRUM,
      recent: [
        {
          ...A,
          blockedReason: 'Aguardo acesso ao servidor',
          blockedAt: '2026-11-10T10:00:00.000Z',
          impediment: {
            id: IMPEDIMENT.id,
            status: 'open',
            reason: IMPEDIMENT.reason,
            ownerId: ME,
            ownerName: 'Pedro',
            openedAt: IMPEDIMENT.openedAt,
          },
        },
      ],
    })
    const row = (await screen.findByText('Revisão do relatório')).closest('button') as HTMLElement
    const marker = within(row).getByText('Bloqueada')
    expect(marker.parentElement?.getAttribute('title')).toBe(
      'Bloqueada: Aguardo acesso ao servidor · Responsável: Pedro',
    )
  })
})
