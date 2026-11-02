import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@agilebox/contract'
import type { CurrentSessionDto, TaskDto, TeamCapabilitiesDto } from '@agilebox/contract'
import { LEVEL_LABELS, TEAM_SCOPE_NOTICE } from '@agilebox/core'
import { ApiProvider } from '../../shared/api/ApiProvider'
import { QueryProvider } from '../../shared/query/QueryProvider'
import { createFakeApi } from '../../shared/testing/fake-api'
import { WINDOW_OPACITY_KEY } from '../../shared/lib/window-opacity'
import { SettingsView } from './SettingsView'

const ORG = '01J8Y4G2XK8Z1S6M3Q9W0A5G01'
const MANAGER = '01J8Y4G2XK8Z1S6M3Q9W0A5V01'
const COLLABORATOR = '01J8Y4G2XK8Z1S6M3Q9W0A5V02'

const updates = {
  check: () => Promise.resolve({ state: 'up-to-date', commit: 'x' }),
  apply: () => Promise.resolve({ state: 'ready' }),
  restart: () => Promise.resolve({ state: 'started' }),
  lastRun: () => Promise.resolve(null),
  info: () => Promise.resolve({ version: '0.2.0', mode: 'source' }),
  onProgress: () => () => undefined,
}

beforeEach(() => {
  vi.stubGlobal('agilebox', { shell: { setAppearance: vi.fn() }, updates })
})

afterEach(() => {
  cleanup()
  window.localStorage.clear()
  vi.unstubAllGlobals()
  delete document.documentElement.dataset.glass
})

interface SettingsOptions {
  readonly role?: CurrentSessionDto['role']
  readonly level?: TeamCapabilitiesDto['level']
  readonly setLevelError?: ApiError
  readonly archivedTasks?: readonly TaskDto[]
}

/**
 * Renderiza Ajustes com a API falsa. `setLevel` grava no estado da própria API falsa, e `get`
 * devolve o nível atual, como o servidor faria, para o teste ver a tela atualizada.
 */
function renderSettings({
  role = 'collaborator',
  level = 'intermediate',
  setLevelError,
  archivedTasks = [],
}: SettingsOptions = {}) {
  const api = createFakeApi()
  let current = level
  const sessionCall = Promise.resolve<CurrentSessionDto>({
    userId: role === 'manager' ? MANAGER : COLLABORATOR,
    organizationId: ORG,
    role,
  })
  vi.spyOn(api.session, 'getCurrent').mockReturnValue(sessionCall)
  // A seção de arquivados lê a lista de projetos; sem mock, o fake falha e cria outro alerta.
  vi.spyOn(api.projects, 'list').mockResolvedValue([])
  // A seção de tarefas arquivadas lê a lista de arquivadas; sem mock, o fake também falha.
  vi.spyOn(api.tasks, 'listArchived').mockResolvedValue([...archivedTasks])
  const getModules = vi
    .spyOn(api.teamModules, 'get')
    .mockImplementation(() =>
      Promise.resolve({ level: current, screens: ['projects', 'agenda'], statuses: [] }),
    )
  const setLevel = vi.spyOn(api.teamSettings, 'setLevel').mockImplementation(({ level: next }) => {
    if (setLevelError) return Promise.reject(setLevelError)
    current = next
    return Promise.resolve(next)
  })
  render(
    <ApiProvider api={api}>
      <QueryProvider>
        <SettingsView />
      </QueryProvider>
    </ApiProvider>,
  )
  return { api, getModules, setLevel, sessionCall }
}

/** Espera a sessão responder para que a ausência de um bloco não seja só corrida de render. */
async function settleSession(sessionCall: Promise<unknown>) {
  await act(async () => {
    await sessionCall
  })
}

describe('Ajustes: opacidade da janela', () => {
  it('mostra o padrão, salva o novo valor e restaura', async () => {
    renderSettings()
    const slider = screen.getByLabelText<HTMLInputElement>('Opacidade da janela')
    expect(slider.value).toBe('68')
    expect(screen.getByText('68%')).toBeTruthy()

    fireEvent.change(slider, { target: { value: '85' } })
    expect(screen.getByText('85%')).toBeTruthy()
    expect(window.localStorage.getItem(WINDOW_OPACITY_KEY)).toBe('0.85')
    expect(document.documentElement.style.getPropertyValue('--glass-window-alpha')).toBe('0.85')

    await userEvent.setup().click(screen.getByRole('button', { name: 'Restaurar padrão' }))
    expect(slider.value).toBe('68')
  })

  it('abre com o valor salvo antes', () => {
    window.localStorage.setItem(WINDOW_OPACITY_KEY, '0.5')
    renderSettings()
    expect(screen.getByLabelText<HTMLInputElement>('Opacidade da janela').value).toBe('50')
  })
})

describe('Ajustes: tarefas arquivadas (M3.0b)', () => {
  const ARCHIVED_TASK: TaskDto = {
    id: '01J8Y4G2XK8Z1S6M3Q9W0A5T01',
    projectId: '01J8Y4G2XK8Z1S6M3Q9W0A5P01',
    projectName: 'Projeto Alfa',
    title: 'Relatório mensal',
    description: '',
    status: 'done',
    deadline: null,
    ticketId: null,
    ticketUrl: null,
    createdAt: '2026-10-01T10:00:00.000Z',
    updatedAt: '2026-10-01T10:00:00.000Z',
    backlogRank: null,
    onBoard: true,
  }

  it('mostra a seção Tarefas arquivadas como região com o título', async () => {
    const { sessionCall } = renderSettings()
    await settleSession(sessionCall)

    const region = screen.getByRole('region', { name: 'Tarefas arquivadas' })
    expect(within(region).getByRole('heading', { name: 'Tarefas arquivadas' })).toBeTruthy()
    expect(await within(region).findByText('Nenhuma tarefa arquivada.')).toBeTruthy()
  })

  it('mostra a tarefa arquivada com o botão Desarquivar dentro da seção', async () => {
    renderSettings({ archivedTasks: [ARCHIVED_TASK] })

    const region = screen.getByRole('region', { name: 'Tarefas arquivadas' })
    expect(
      await within(region).findByRole('button', { name: 'Desarquivar tarefa Relatório mensal' }),
    ).toBeTruthy()
  })
})

describe('Ajustes: fundo da janela', () => {
  it('troca para opaco, pede a recriação das janelas e desliga a opacidade', async () => {
    const setAppearance = vi.fn()
    vi.stubGlobal('agilebox', { shell: { setAppearance }, updates })
    document.documentElement.dataset.glass = 'native'
    renderSettings()
    expect(screen.getByRole('button', { name: 'Translúcido' }).getAttribute('aria-pressed')).toBe(
      'true',
    )
    await userEvent.setup().click(screen.getByRole('button', { name: 'Opaco' }))
    expect(setAppearance).toHaveBeenCalledWith({ mode: 'opaque' })
    expect(window.localStorage.getItem('agilebox.reopenSettings')).toBe('1')
    expect(screen.getByLabelText<HTMLInputElement>('Opacidade da janela').disabled).toBe(true)
  })

  it('no modo opaco mostra "Opaco" selecionado', () => {
    document.documentElement.dataset.glass = 'opaque'
    renderSettings()
    expect(screen.getByRole('button', { name: 'Opaco' }).getAttribute('aria-pressed')).toBe('true')
  })
})

describe('Ajustes: nível do time (M2.9b)', () => {
  const groupName = 'Opções de nível do time'

  it('gestor vê as três opções, o nível atual, a descrição e o aviso de escopo', async () => {
    renderSettings({ role: 'manager', level: 'intermediate' })

    const group = await screen.findByRole('group', { name: groupName })
    expect(
      within(group).getByRole('button', { name: 'Essencial' }).getAttribute('aria-pressed'),
    ).toBe('false')
    expect(within(group).getByRole('button', { name: 'Padrão' }).getAttribute('aria-pressed')).toBe(
      'true',
    )
    expect(
      within(group).getByRole('button', { name: 'Avançado' }).getAttribute('aria-pressed'),
    ).toBe('false')
    expect(screen.getByText(LEVEL_LABELS.intermediate.description)).toBeTruthy()
    expect(screen.getByText(TEAM_SCOPE_NOTICE)).toBeTruthy()
  })

  it('colaborador não vê o controle de nível nem o aviso', async () => {
    const { sessionCall } = renderSettings({ role: 'collaborator' })
    await settleSession(sessionCall)

    expect(screen.queryByRole('group', { name: groupName })).toBeNull()
    expect(screen.queryByText(TEAM_SCOPE_NOTICE)).toBeNull()
  })

  it('gestor escolhe Avançado: grava o nível, atualiza o cache de capacidades e marca a opção', async () => {
    const { setLevel, getModules } = renderSettings({ role: 'manager', level: 'intermediate' })
    const group = await screen.findByRole('group', { name: groupName })
    expect(getModules).toHaveBeenCalledTimes(1)

    await userEvent.setup().click(within(group).getByRole('button', { name: 'Avançado' }))

    expect(setLevel).toHaveBeenCalledWith({ level: 'advanced' })
    await waitFor(() => expect(getModules).toHaveBeenCalledTimes(2))
    await waitFor(() =>
      expect(
        within(group).getByRole('button', { name: 'Avançado' }).getAttribute('aria-pressed'),
      ).toBe('true'),
    )
  })

  it('depois do refetch, a seção mostra a descrição e a opção do nível novo (o antigo some)', async () => {
    const { getModules } = renderSettings({ role: 'manager', level: 'intermediate' })
    const group = await screen.findByRole('group', { name: groupName })
    expect(screen.getByText(LEVEL_LABELS.intermediate.description)).toBeTruthy()
    expect(screen.queryByText(LEVEL_LABELS.advanced.description)).toBeNull()

    await userEvent.setup().click(within(group).getByRole('button', { name: 'Avançado' }))

    await waitFor(() => expect(getModules).toHaveBeenCalledTimes(2))
    expect(await screen.findByText(LEVEL_LABELS.advanced.description)).toBeTruthy()
    expect(screen.queryByText(LEVEL_LABELS.intermediate.description)).toBeNull()
    expect(
      within(group).getByRole('button', { name: 'Avançado' }).getAttribute('aria-pressed'),
    ).toBe('true')
  })

  it('escolher o nível que já vale não chama o servidor', async () => {
    const { setLevel } = renderSettings({ role: 'manager', level: 'intermediate' })
    const group = await screen.findByRole('group', { name: groupName })

    await userEvent.setup().click(within(group).getByRole('button', { name: 'Padrão' }))

    expect(setLevel).not.toHaveBeenCalled()
  })

  it('falha ao gravar mostra aviso em texto e mantém o nível anterior marcado', async () => {
    renderSettings({
      role: 'manager',
      level: 'intermediate',
      setLevelError: new ApiError('CONFLICT', 'falhou'),
    })
    const group = await screen.findByRole('group', { name: groupName })

    await userEvent.setup().click(within(group).getByRole('button', { name: 'Essencial' }))

    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.getByRole('alert').textContent).toBe(
      'Não foi possível trocar o nível do time. Tente de novo.',
    )
    expect(within(group).getByRole('button', { name: 'Padrão' }).getAttribute('aria-pressed')).toBe(
      'true',
    )
  })
})
