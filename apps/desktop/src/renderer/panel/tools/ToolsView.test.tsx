import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type {
  CurrentSessionDto,
  TeamCapabilitiesDto,
  TeamModuleStatusDto,
} from '@agilebox/contract'
import { MODULE_IDS, MODULE_LABELS, type ModuleId } from '@agilebox/core'
import { ApiProvider } from '../../shared/api/ApiProvider'
import { useActor } from '../../shared/session/useActor'
import { QueryProvider } from '../../shared/query/QueryProvider'
import { createFakeApi } from '../../shared/testing/fake-api'
import { useTeamCapabilities } from '../hooks/use-team-capabilities'
import { ToolsView } from './ToolsView'
import { TOOL_IDS } from './tool-draft'

const ORG = '01J8Y4G2XK8Z1S6M3Q9W0A5G01'
const MANAGER = '01J8Y4G2XK8Z1S6M3Q9W0A5V01'
const COLLABORATOR = '01J8Y4G2XK8Z1S6M3Q9W0A5V02'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

/** Estados do servidor: `active` e `winding` por módulo; o resto fica desligado (núcleo sempre ativo). */
function statusesOf(active: readonly ModuleId[], winding: readonly ModuleId[] = []) {
  return MODULE_IDS.map((moduleId): TeamModuleStatusDto => ({
    moduleId,
    state: winding.includes(moduleId)
      ? 'winding_down'
      : active.includes(moduleId) || moduleId === 'core'
        ? 'active'
        : 'disabled',
  }))
}

interface RenderOptions {
  readonly role?: CurrentSessionDto['role']
  readonly active?: readonly ModuleId[]
  readonly winding?: readonly ModuleId[]
  readonly getError?: Error
}

/**
 * Sinal positivo: sessão e estado do time já carregaram. Sem ele, "não vê interruptor" pode passar
 * só porque a tela ainda não renderizou. Usa as mesmas consultas da tela.
 */
function LoadProbe() {
  const { actor } = useActor()
  const capabilities = useTeamCapabilities()
  return <p>{actor && capabilities.data ? 'Sessão e estado carregados' : 'Aguardando'}</p>
}

/** Renderiza Ferramentas com a API falsa. As gravações são espiadas: o rascunho não deve chamá-las. */
function renderTools({
  role = 'manager',
  active = ['agenda'],
  winding = [],
  getError,
}: RenderOptions = {}) {
  const api = createFakeApi()
  vi.spyOn(api.session, 'getCurrent').mockResolvedValue({
    userId: role === 'manager' ? MANAGER : COLLABORATOR,
    organizationId: ORG,
    role,
  })
  const get = vi.spyOn(api.teamModules, 'get').mockImplementation(() =>
    getError
      ? Promise.reject(getError)
      : Promise.resolve<TeamCapabilitiesDto>({
          level: 'advanced',
          screens: ['projects'],
          statuses: statusesOf(active, winding),
        }),
  )
  const change = vi.spyOn(api.teamModules, 'change')
  const preview = vi.spyOn(api.teamModules, 'previewImpact')
  render(
    <ApiProvider api={api}>
      <QueryProvider>
        <LoadProbe />
        <ToolsView />
      </QueryProvider>
    </ApiProvider>,
  )
  return { get, change, preview }
}

const card = (name: string) => screen.getByRole('article', { name })
const toggle = (name: string) => screen.getByRole('switch', { name })
const isOn = (name: string) => toggle(name).getAttribute('aria-checked') === 'true'
const preset = (name: string) => screen.getByRole('button', { name })
const pressed = (name: string) => preset(name).getAttribute('aria-pressed') === 'true'

describe('Ferramentas: interruptores e estado', () => {
  it('gestor vê um interruptor por ferramenta, marcado conforme o servidor', async () => {
    renderTools({ active: ['agenda', 'backlog'] })
    await screen.findByRole('switch', { name: 'Agenda' })

    for (const id of TOOL_IDS) {
      expect(toggle(MODULE_LABELS[id]).getAttribute('role')).toBe('switch')
    }
    expect(isOn('Agenda')).toBe(true)
    expect(isOn('Backlog')).toBe(true)
    expect(isOn('Sprints')).toBe(false)
  })

  it('Quadro é sempre ligado: o interruptor fica marcado e desabilitado', async () => {
    renderTools()
    await screen.findByRole('switch', { name: 'Quadro' })

    expect(isOn('Quadro')).toBe(true)
    expect(toggle('Quadro').hasAttribute('disabled')).toBe(true)
  })

  it('não mostra estimativa por pontos (D8), mesmo que o servidor a devolva ligada', async () => {
    renderTools({ active: ['agenda', 'estimates.points'] })
    await screen.findByRole('switch', { name: 'Agenda' })

    expect(screen.queryByRole('switch', { name: 'Estimativa por pontos' })).toBeNull()
    expect(screen.queryByText('Estimativa por pontos')).toBeNull()
  })

  it('mostra a dependência declarada em texto, em cada cartão', async () => {
    renderTools()
    await screen.findByRole('switch', { name: 'Sprints' })

    expect(within(card('Sprints')).getByText('Depende de Backlog.')).toBeTruthy()
    expect(within(card('Check-ins')).getByText('Depende de Sprints.')).toBeTruthy()
    expect(within(card('Agenda')).getByText('Sem dependências.')).toBeTruthy()
    expect(within(card('Quadro')).getByText('Base do time, sempre ligada.')).toBeTruthy()
  })

  it('o estado aparece em texto: Ligada, Desligada e Encerrando', async () => {
    renderTools({ active: ['agenda', 'checkins'], winding: ['checkins'] })
    await screen.findByRole('switch', { name: 'Agenda' })

    expect(within(card('Agenda')).getByText('Ligada')).toBeTruthy()
    expect(within(card('Sprints')).getByText('Desligada')).toBeTruthy()
    // Encerrando: em encerramento e o rascunho já a tira, então o sinal diz isso em texto.
    expect(within(card('Check-ins')).getByText('Encerrando')).toBeTruthy()
    expect(isOn('Check-ins')).toBe(false)
  })
})

describe('Ferramentas: rascunho com dependências', () => {
  it('ligar Sprints no rascunho puxa Backlog e avisa em texto', async () => {
    renderTools({ active: [] })
    const user = userEvent.setup()
    await screen.findByRole('switch', { name: 'Sprints' })

    await user.click(toggle('Sprints'))

    expect(isOn('Sprints')).toBe(true)
    expect(isOn('Backlog')).toBe(true)
    expect(screen.getByRole('status').textContent).toContain(
      'Também entra por dependência: Backlog.',
    )
  })

  it('desligar Backlog com Sprints ligada tira as duas e avisa quem saiu junto', async () => {
    renderTools({ active: ['backlog', 'sprints'] })
    const user = userEvent.setup()
    await screen.findByRole('switch', { name: 'Backlog' })

    await user.click(toggle('Backlog'))

    expect(isOn('Backlog')).toBe(false)
    expect(isOn('Sprints')).toBe(false)
    expect(screen.getByRole('status').textContent).toContain('Também sai por dependência: Sprints.')
  })

  it('ligar horas com pontos ativos no servidor funciona, sem erro nem aviso de conflito', async () => {
    renderTools({ active: ['estimates.points'] })
    const user = userEvent.setup()
    await screen.findByRole('switch', { name: 'Estimativa por horas' })

    await user.click(toggle('Estimativa por horas'))

    expect(isOn('Estimativa por horas')).toBe(true)
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByRole('status').textContent).toBe('Entra no rascunho: Estimativa por horas.')
  })

  it('desligar Sprints com Retro ativa funciona e a mensagem não cita Retro', async () => {
    renderTools({ active: ['backlog', 'sprints', 'reviewRetro'] })
    const user = userEvent.setup()
    await screen.findByRole('switch', { name: 'Sprints' })

    await user.click(toggle('Sprints'))

    expect(isOn('Sprints')).toBe(false)
    expect(isOn('Backlog')).toBe(true)
    expect(screen.getByRole('status').textContent).toBe('Sai do rascunho: Sprints.')
    expect(screen.getByRole('status').textContent).not.toContain('Retro')
  })

  it('o interruptor aponta a dependência e o sinal de estado por aria-describedby', async () => {
    renderTools({ active: ['backlog'] })
    await screen.findByRole('switch', { name: 'Sprints' })

    const ids = (toggle('Sprints').getAttribute('aria-describedby') ?? '').split(' ')
    const described = ids.map((id) => document.getElementById(id)?.textContent)

    expect(described).toEqual(['Depende de Backlog.', 'Desligada'])
  })
})

describe('Ferramentas: presets', () => {
  it('Quadro simples desliga o que não está nele e fica marcado', async () => {
    renderTools({ active: ['agenda', 'backlog', 'sprints', 'integrations'] })
    const user = userEvent.setup()
    await screen.findByRole('switch', { name: 'Sprints' })

    await user.click(preset('Quadro simples'))

    expect(pressed('Quadro simples')).toBe(true)
    expect(isOn('Sprints')).toBe(false)
    expect(isOn('Integrações')).toBe(false)
    expect(isOn('Backlog')).toBe(true)
  })

  it('Completo liga integrações, estimativa por horas e aceite', async () => {
    renderTools({ active: ['agenda'] })
    const user = userEvent.setup()
    await screen.findByRole('switch', { name: 'Agenda' })

    await user.click(preset('Completo'))

    expect(pressed('Completo')).toBe(true)
    expect(isOn('Integrações')).toBe(true)
    expect(isOn('Estimativa por horas')).toBe(true)
    expect(isOn('Aceite')).toBe(true)
    expect(isOn('Sprints')).toBe(true)
  })

  it('o preset só fica marcado enquanto o rascunho bate com ele', async () => {
    renderTools({ active: ['agenda', 'backlog'] })
    const user = userEvent.setup()
    await screen.findByRole('switch', { name: 'Agenda' })
    expect(pressed('Quadro simples')).toBe(true)

    await user.click(toggle('Agenda'))

    expect(pressed('Quadro simples')).toBe(false)
    expect(pressed('Scrum do time')).toBe(false)
    expect(pressed('Completo')).toBe(false)
  })
})

describe('Ferramentas: rascunho não grava nada', () => {
  it('mexer no rascunho e trocar presets não chama alteração nem prévia do servidor', async () => {
    const { get, change, preview } = renderTools({ active: ['agenda'] })
    const user = userEvent.setup()
    await screen.findByRole('switch', { name: 'Agenda' })

    await user.click(toggle('Sprints'))
    await user.click(preset('Completo'))
    await user.click(toggle('Agenda'))

    expect(change).not.toHaveBeenCalled()
    expect(preview).not.toHaveBeenCalled()
    expect(get).toHaveBeenCalledTimes(1)
  })
})

describe('Ferramentas: acesso e carregamento', () => {
  it('colaborador não vê os interruptores, só depois que sessão e estado carregaram', async () => {
    renderTools({ role: 'collaborator', active: ['agenda', 'backlog'] })

    // Espera o sinal positivo: sem ele, a ausência de interruptores poderia ser só corrida.
    await screen.findByText('Sessão e estado carregados')

    expect(screen.queryAllByRole('switch')).toHaveLength(0)
    expect(screen.queryByRole('button', { name: 'Completo' })).toBeNull()
  })

  it('falha ao carregar mostra alerta em texto', async () => {
    renderTools({ getError: new Error('offline') })

    expect(await screen.findByRole('alert')).toBeTruthy()
    await waitFor(() => expect(screen.queryAllByRole('switch')).toHaveLength(0))
  })
})
