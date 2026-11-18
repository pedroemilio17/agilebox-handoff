import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GetTaskDto, ImpedimentDto, SessionUserDto } from '@agilebox/contract'
import { ApiProvider } from '../../shared/api/ApiProvider'
import { CapabilitiesProvider } from '../../shared/capabilities/CapabilitiesProvider'
import { QueryProvider } from '../../shared/query/QueryProvider'
import { createFakeApi } from '../../shared/testing/fake-api'
import { presetModules, teamToolsView } from '../../shared/testing/team-tools-fixture'
import { settleCapabilities } from '../../shared/testing/render-panel'
import { impedimentCopy } from '../impediments/impediment-copy'
import { makeDetail, OTHER_USER_ID, TASK_ID, USER_ID } from './fixtures'
import { TaskDetailView } from './TaskDetailView'

const MANAGER = '01J8Y4G2XK8Z1S6M3Q9W0A5V09'
const REASON = 'Aguardando credenciais do ambiente'
const NOW = Date.now()

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const USERS: SessionUserDto[] = [
  { id: USER_ID, name: 'Ana Souza', initials: 'AS', role: 'collaborator', defaultRate: 40 },
  { id: OTHER_USER_ID, name: 'Bruno Lima', initials: 'BL', role: 'collaborator', defaultRate: 40 },
  { id: MANAGER, name: 'Lia Gestora', initials: 'LG', role: 'manager', defaultRate: 0 },
]

const SCRUM = presetModules('scrum')
const KANBAN = presetModules('kanban')
const ENDING = SCRUM.filter((module) => module !== 'impediments')

function openImpediment(overrides: Partial<ImpedimentDto> = {}): ImpedimentDto {
  return {
    id: '01J8Y4G2XK8Z1S6M3Q9W0B1001',
    taskId: TASK_ID,
    status: 'open',
    reason: REASON,
    ownerId: USER_ID,
    ownerName: 'Ana Souza',
    openedBy: USER_ID,
    openedAt: new Date(NOW - 3 * 86_400_000).toISOString(),
    resolvedBy: null,
    resolvedAt: null,
    resolution: null,
    ...overrides,
  }
}

function blockedDetail(overrides: Partial<GetTaskDto> = {}): GetTaskDto {
  return makeDetail({
    blockedReason: REASON,
    blockedAt: '2026-11-01T12:00:00Z',
    impediment: openImpediment(),
    ...overrides,
  })
}

function setup({
  detail = makeDetail(),
  modules = SCRUM,
  level = 'intermediate',
  winding = [],
}: {
  detail?: GetTaskDto
  modules?: readonly string[]
  level?: 'basic' | 'intermediate' | 'advanced'
  winding?: readonly string[]
}) {
  const api = createFakeApi()
  vi.spyOn(api.teamTools, 'get').mockResolvedValue(
    teamToolsView({
      modules: modules as never,
      level,
      role: 'collaborator',
      winding: winding as never,
    }),
  )
  vi.spyOn(api.tasks, 'get').mockResolvedValue(detail)
  vi.spyOn(api.tasks, 'recordOpen').mockResolvedValue(undefined)
  vi.spyOn(api.timeline, 'list').mockResolvedValue([])
  vi.spyOn(api.session, 'listUsers').mockResolvedValue(USERS)
  vi.spyOn(api.contributors, 'list').mockResolvedValue([])
  const block = vi.spyOn(api.tasks, 'block').mockResolvedValue(detail)
  const unblock = vi.spyOn(api.tasks, 'unblock').mockResolvedValue(detail)
  const assign = vi.spyOn(api.impediments, 'assign').mockResolvedValue(openImpediment())
  render(
    <ApiProvider api={api}>
      <QueryProvider>
        <CapabilitiesProvider>
          <TaskDetailView taskId={TASK_ID} onBack={vi.fn()} />
        </CapabilitiesProvider>
      </QueryProvider>
    </ApiProvider>,
  )
  return { api, block, unblock, assign, user: userEvent.setup() }
}

describe('Bloquear com "Quem resolve"', () => {
  it('lista participantes e gestor, e grava o responsável escolhido', async () => {
    const { api, block, user } = setup({})
    await settleCapabilities(api)
    await user.click(await screen.findByRole('button', { name: 'Bloquear' }))
    const select = screen.getByLabelText(impedimentCopy.whoResolves)
    await waitFor(() =>
      expect(within(select).getByRole('option', { name: 'Ana Souza' })).toBeTruthy(),
    )
    expect(
      within(select)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Sem responsável', 'Ana Souza', 'Lia Gestora'])
    await user.type(screen.getByLabelText('Motivo do bloqueio'), REASON)
    await user.selectOptions(select, MANAGER)
    await user.click(screen.getByRole('button', { name: 'Confirmar' }))
    expect(block).toHaveBeenCalledWith({ taskId: TASK_ID, reason: REASON, ownerId: MANAGER })
  })

  it('sem escolher, a chamada segue como antes (sem responsável)', async () => {
    const { api, block, user } = setup({})
    await settleCapabilities(api)
    await user.click(await screen.findByRole('button', { name: 'Bloquear' }))
    await user.type(screen.getByLabelText('Motivo do bloqueio'), REASON)
    await user.click(screen.getByRole('button', { name: 'Confirmar' }))
    expect(block).toHaveBeenCalledWith({ taskId: TASK_ID, reason: REASON })
  })
})

describe('Impedimento aberto no detalhe', () => {
  it('mostra estado, motivo, responsável e tempo aberto', async () => {
    const { api } = setup({ detail: blockedDetail() })
    await settleCapabilities(api)
    const strip = await screen.findByRole('region', { name: 'Bloqueio' })
    expect(within(strip).getByText('Aberto')).toBeTruthy()
    expect(within(strip).getByText(REASON)).toBeTruthy()
    expect(within(strip).getByText('Responsável: Ana Souza')).toBeTruthy()
    expect(within(strip).getByText('Aberto há 3 dias')).toBeTruthy()
  })

  it('"Atribuir" troca o responsável, inclusive para "Sem responsável"', async () => {
    const { api, assign, user } = setup({ detail: blockedDetail() })
    await settleCapabilities(api)
    const strip = await screen.findByRole('region', { name: 'Bloqueio' })
    await user.click(within(strip).getByRole('button', { name: 'Atribuir' }))
    const select = within(strip).getByLabelText(impedimentCopy.assignSelect)
    await user.selectOptions(select, '')
    await user.click(within(strip).getByRole('button', { name: 'Salvar' }))
    expect(assign).toHaveBeenCalledWith({
      impedimentId: '01J8Y4G2XK8Z1S6M3Q9W0B1001',
      ownerId: null,
    })
  })

  it('"Resolver impedimento" pede a nota opcional e desbloqueia com ela', async () => {
    const { api, unblock, user } = setup({ detail: blockedDetail() })
    await settleCapabilities(api)
    const strip = await screen.findByRole('region', { name: 'Bloqueio' })
    await user.click(within(strip).getByRole('button', { name: 'Resolver impedimento' }))
    await user.type(within(strip).getByLabelText(impedimentCopy.resolutionLabel), 'Acesso liberado')
    await user.click(within(strip).getByRole('button', { name: 'Resolver' }))
    expect(unblock).toHaveBeenCalledWith({ taskId: TASK_ID, resolution: 'Acesso liberado' })
  })

  it('"Resolver impedimento" sem nota desbloqueia sem campo de resolução', async () => {
    const { api, unblock, user } = setup({ detail: blockedDetail() })
    await settleCapabilities(api)
    const strip = await screen.findByRole('region', { name: 'Bloqueio' })
    await user.click(within(strip).getByRole('button', { name: 'Resolver impedimento' }))
    await user.click(within(strip).getByRole('button', { name: 'Resolver' }))
    expect(unblock).toHaveBeenCalledWith({ taskId: TASK_ID })
  })

  it('a nota acima de 280 caracteres não grava', async () => {
    const { api, unblock, user } = setup({ detail: blockedDetail() })
    await settleCapabilities(api)
    const strip = await screen.findByRole('region', { name: 'Bloqueio' })
    await user.click(within(strip).getByRole('button', { name: 'Resolver impedimento' }))
    await user.click(within(strip).getByLabelText(impedimentCopy.resolutionLabel))
    await user.paste('a'.repeat(281))
    await user.click(within(strip).getByRole('button', { name: 'Resolver' }))
    expect(within(strip).getByRole('alert').textContent).toBe(impedimentCopy.resolutionTooLong)
    expect(unblock).not.toHaveBeenCalled()
  })

  it('histórico com resolvidos e abertos, datas e nota', async () => {
    const detail = blockedDetail({
      impedimentHistory: [
        {
          id: '01J8Y4G2XK8Z1S6M3Q9W0B0901',
          taskId: TASK_ID,
          status: 'resolved',
          reason: 'Falta de acesso',
          ownerId: USER_ID,
          ownerName: 'Ana Souza',
          openedBy: USER_ID,
          openedAt: '2026-11-02T10:00:00.000Z',
          resolvedBy: USER_ID,
          resolvedAt: '2026-11-04T10:00:00.000Z',
          resolution: 'Acesso liberado',
        },
        {
          id: '01J8Y4G2XK8Z1S6M3Q9W0B1001',
          taskId: TASK_ID,
          status: 'open',
          reason: REASON,
          ownerId: USER_ID,
          ownerName: 'Ana Souza',
          openedBy: USER_ID,
          openedAt: '2026-11-10T10:00:00.000Z',
          resolvedBy: null,
          resolvedAt: null,
          resolution: null,
        },
      ],
    })
    const { api } = setup({ detail })
    await settleCapabilities(api)
    const history = await screen.findByRole('region', { name: impedimentCopy.historyTitle })
    expect(within(history).getByText(/Falta de acesso · Resolvido/)).toBeTruthy()
    expect(within(history).getByText(/Resolvido em/)).toBeTruthy()
    expect(within(history).getByText('Nota: Acesso liberado')).toBeTruthy()
    expect(within(history).getByText(new RegExp(`${REASON} · Aberto`))).toBeTruthy()
  })
})

describe('Níveis e módulos', () => {
  it('Básico: o histórico aparece (é tela), mas a faixa só mostra o motivo, sem resolver ou atribuir', async () => {
    const { api } = setup({ detail: blockedDetail(), modules: SCRUM, level: 'basic' })
    await settleCapabilities(api)
    const strip = await screen.findByRole('region', { name: 'Bloqueio' })
    expect(within(strip).getByText(REASON)).toBeTruthy()
    expect(within(strip).queryByRole('button')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Resolver impedimento' })).toBeNull()
    expect(screen.getByRole('region', { name: impedimentCopy.historyTitle })).toBeTruthy()
  })

  it('módulo desligado: nem o motivo aparece', async () => {
    const { api } = setup({ detail: blockedDetail(), modules: KANBAN })
    await settleCapabilities(api)
    expect(await screen.findByDisplayValue('Revisar integração')).toBeTruthy()
    expect(screen.queryByRole('region', { name: 'Bloqueio' })).toBeNull()
    expect(screen.queryByText(REASON)).toBeNull()
    expect(screen.queryByRole('region', { name: impedimentCopy.historyTitle })).toBeNull()
  })

  it('encerrando: some o abrir (Bloquear), mas resolver e atribuir seguem', async () => {
    // Em encerramento o módulo sai da lista de ativos e entra na de encerrando.
    const { api } = setup({ detail: makeDetail(), modules: ENDING, winding: ['impediments'] })
    await settleCapabilities(api)
    expect(await screen.findByDisplayValue('Revisar integração')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Bloquear' })).toBeNull()
  })

  it('encerrando com impedimento aberto: atribuir e resolver seguem', async () => {
    const { api } = setup({
      detail: blockedDetail(),
      modules: ENDING,
      winding: ['impediments'],
    })
    await settleCapabilities(api)
    const strip = await screen.findByRole('region', { name: 'Bloqueio' })
    expect(within(strip).getByRole('button', { name: 'Atribuir' })).toBeTruthy()
    expect(within(strip).getByRole('button', { name: 'Resolver impedimento' })).toBeTruthy()
  })

  it('somente leitura: atribuir e resolver ficam desabilitados', async () => {
    const { api } = setup({
      detail: blockedDetail({ canEdit: false, readOnly: true }),
    })
    await settleCapabilities(api)
    const strip = await screen.findByRole('region', { name: 'Bloqueio' })
    expect(within(strip).getByRole('button', { name: 'Atribuir' }).hasAttribute('disabled')).toBe(
      true,
    )
    expect(
      within(strip).getByRole('button', { name: 'Resolver impedimento' }).hasAttribute('disabled'),
    ).toBe(true)
  })
})
