import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@agilebox/contract'
import type {
  CurrentSessionDto,
  TeamCapabilitiesDto,
  TeamModuleImpactDto,
  TeamModuleStatusDto,
} from '@agilebox/contract'
import {
  MODULE_IDS,
  MODULE_LABELS,
  TEAM_SCOPE_NOTICE,
  resolveModuleSet,
  type ModuleId,
} from '@agilebox/core'
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

/** Preferência de movimento do sistema, simulada. Sem ela, `useReducedMotion` não encontra `matchMedia`. */
function stubMotion(reduced: boolean): void {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      matches: reduced,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  )
}

beforeEach(() => {
  stubMotion(false)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
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
  readonly changeError?: Error
  /** Prévia que o servidor devolve para cada módulo pedido para desligar. */
  readonly impacts?: readonly TeamModuleImpactDto[]
  /** A prévia de impacto nunca termina (carregamento). */
  readonly impactPending?: boolean
  /** A prévia de impacto falha. */
  readonly impactError?: Error
  /** A gravação só termina quando o teste liberar (`releaseChange`). */
  readonly holdChange?: boolean
  /** Recusa do servidor ao concluir o encerramento (outro módulo ainda depende dele). */
  readonly finishError?: Error
  /** O encerramento só termina quando o teste liberar (`releaseFinish`). */
  readonly holdFinish?: boolean
}

/** Recusa no formato que o servidor usa (`describeRefusal` em team-modules.ts). */
function refusalOf(blockedBy: readonly ModuleId[]): string {
  return `Mudança recusada: ${blockedBy.join(', ')} ficaria sem o que precisa`
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

/**
 * Renderiza Ferramentas com a API falsa. O servidor fica em memória: `change` aplica a diferença,
 * e a consulta de estado devolve o resultado, como o servidor real faria depois de invalidar.
 */
function renderTools({
  role = 'manager',
  active = ['agenda'],
  winding = [],
  getError,
  changeError,
  impacts = [],
  impactPending = false,
  impactError,
  holdChange = false,
  finishError,
  holdFinish = false,
}: RenderOptions = {}) {
  const api = createFakeApi()
  vi.spyOn(api.session, 'getCurrent').mockResolvedValue({
    userId: role === 'manager' ? MANAGER : COLLABORATOR,
    organizationId: ORG,
    role,
  })
  // Servidor em memória. Os módulos encerrando (`winding`) ficam fora de `active`, como no servidor.
  let server: readonly ModuleId[] = active
  let windingNow: readonly ModuleId[] = winding
  const get = vi.spyOn(api.teamModules, 'get').mockImplementation(() =>
    getError
      ? Promise.reject(getError)
      : Promise.resolve<TeamCapabilitiesDto>({
          level: 'advanced',
          screens: ['projects'],
          statuses: statusesOf(server, windingNow),
        }),
  )
  // Aplica a mesma regra do servidor: a resolução inclui encerrando; recusa se algo ficaria sem o que
  // precisa. Não reproduz a reativação silenciosa do servidor (ver relatório da M2.10b-fix).
  function applyOnServer({ enable, disable }: { enable: ModuleId[]; disable: ModuleId[] }) {
    const inSet = MODULE_IDS.filter(
      (id) => id === 'core' || server.includes(id) || windingNow.includes(id),
    )
    const resolution = resolveModuleSet(inSet, { enable, disable })
    if (!resolution.ok)
      return Promise.reject(new ApiError('VALIDATION', refusalOf(resolution.blockedBy)))
    server = resolution.enabled.filter((id) => !windingNow.includes(id) || enable.includes(id))
    windingNow = windingNow.filter((id) => !enable.includes(id))
    return Promise.resolve({ statuses: statusesOf(server, windingNow), windingDown: [] })
  }
  let releaseChange = () => {}
  const gate = new Promise<void>((resolve) => {
    releaseChange = resolve
  })
  const change = vi
    .spyOn(api.teamModules, 'change')
    .mockImplementation(({ enable = [], disable = [] }) => {
      if (changeError) return Promise.reject(changeError)
      const run = () => applyOnServer({ enable: [...enable], disable: [...disable] })
      return holdChange ? gate.then(run) : run()
    })
  let releaseFinish = () => {}
  const finishGate = new Promise<void>((resolve) => {
    releaseFinish = resolve
  })
  // Encerramento: tira o módulo de `windingNow` e devolve o estado, como o servidor faz.
  const finish = vi
    .spyOn(api.teamModules, 'finishWindingDown')
    .mockImplementation(({ moduleId }) => {
      if (finishError) return Promise.reject(finishError)
      const run = () => {
        windingNow = windingNow.filter((id) => id !== moduleId)
        return Promise.resolve(statusesOf(server, windingNow))
      }
      return holdFinish ? finishGate.then(run) : run()
    })
  const preview = vi
    .spyOn(api.teamModules, 'previewImpact')
    .mockImplementation(({ disable = [] }) => {
      if (impactError) return Promise.reject(impactError)
      if (impactPending) return new Promise<TeamModuleImpactDto[]>(() => {})
      return Promise.resolve(impacts.filter((impact) => disable.includes(impact.moduleId)))
    })
  render(
    <ApiProvider api={api}>
      <QueryProvider>
        <LoadProbe />
        <ToolsView />
      </QueryProvider>
    </ApiProvider>,
  )
  return { get, change, finish, preview, releaseChange, releaseFinish }
}

const card = (name: string) => screen.getByRole('article', { name })
const toggle = (name: string) => screen.getByRole('switch', { name })
const isOn = (name: string) => toggle(name).getAttribute('aria-checked') === 'true'
const preset = (name: string) => screen.getByRole('button', { name })
const pressed = (name: string) => preset(name).getAttribute('aria-pressed') === 'true'
const preview = () => screen.getByRole('complementary', { name: 'Impacto da mudança' })
const applyButton = () => screen.getByRole('button', { name: 'Aplicar mudança' })
const cancelButton = () => screen.getByRole('button', { name: 'Cancelar' })

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

  it('mostra a dependência do quadro em texto, em cada cartão', async () => {
    renderTools()
    await screen.findByRole('switch', { name: 'Sprints' })

    expect(within(card('Sprints')).getByText('Precisa de Backlog')).toBeTruthy()
    expect(within(card('Check-ins')).getByText('Precisa de Sprints')).toBeTruthy()
    expect(within(card('Agenda')).getByText('Independente')).toBeTruthy()
    expect(within(card('Quadro')).getByText('Base')).toBeTruthy()
  })

  it('cada cartão traz a descrição do quadro', async () => {
    renderTools()
    await screen.findByRole('switch', { name: 'Backlog' })

    expect(
      within(card('Backlog')).getByText('Lista priorizada do que ainda não entrou em andamento.'),
    ).toBeTruthy()
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

    expect(described).toEqual(['Precisa de Backlog', 'Desligada'])
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
  it('mexer no rascunho e trocar presets não chama alteração', async () => {
    const { change } = renderTools({ active: ['agenda'] })
    const user = userEvent.setup()
    await screen.findByRole('switch', { name: 'Agenda' })

    await user.click(toggle('Sprints'))
    await user.click(preset('Completo'))
    await user.click(toggle('Agenda'))

    expect(change).not.toHaveBeenCalled()
  })
})

describe('Ferramentas: prévia em vidro (M2.10b)', () => {
  it('mostra o título, a escolha e o que entra por dependência', async () => {
    renderTools({ active: [] })
    const user = userEvent.setup()
    await screen.findByRole('switch', { name: 'Sprints' })

    await user.click(toggle('Sprints'))

    const panel = preview()
    expect(within(panel).getByRole('heading', { name: 'Ligar Sprints' })).toBeTruthy()
    expect(within(panel).getByText('Também entra por dependência:')).toBeTruthy()
    expect(within(panel).getByText('Backlog')).toBeTruthy()
  })

  it('mostra o aviso de escopo do time, mesmo sem mudança', async () => {
    renderTools()
    await screen.findByRole('switch', { name: 'Agenda' })

    expect(within(preview()).getByText(TEAM_SCOPE_NOTICE)).toBeTruthy()
    expect(within(preview()).getByRole('heading', { name: 'Nada a aplicar' })).toBeTruthy()
  })

  it('consulta o impacto no servidor e mostra o destino por tipo', async () => {
    const impacts: TeamModuleImpactDto[] = [
      {
        moduleId: 'agenda',
        counts: { tasks: 0, projects: 0, participations: 0, meetings: 3 },
        items: [{ kind: 'meetings', destination: 'hidden', count: 3 }],
      },
    ]
    const { preview: previewSpy } = renderTools({ active: ['agenda', 'backlog'], impacts })
    const user = userEvent.setup()
    await screen.findByRole('switch', { name: 'Agenda' })

    await user.click(toggle('Agenda'))

    expect(previewSpy).toHaveBeenCalledWith({ disable: ['agenda'] })
    const panel = preview()
    expect(await within(panel).findByText('Reuniões')).toBeTruthy()
    expect(within(panel).getByText('3 · escondidas')).toBeTruthy()
  })

  it('módulo sem cartão que sai junto aparece como "Também sai"', async () => {
    renderTools({ active: ['agenda', 'backlog', 'estimates.points'] })
    const user = userEvent.setup()
    await screen.findByRole('switch', { name: 'Agenda' })

    await user.click(preset('Quadro simples'))

    const panel = preview()
    expect(within(panel).getByText('Também sai')).toBeTruthy()
    expect(within(panel).getByText('Estimativa por pontos')).toBeTruthy()
    expect(screen.queryByRole('switch', { name: 'Estimativa por pontos' })).toBeNull()
  })

  it('Aplicar fica desabilitado enquanto não há mudança', async () => {
    renderTools({ active: ['agenda'] })
    await screen.findByRole('switch', { name: 'Agenda' })

    expect((applyButton() as HTMLButtonElement).disabled).toBe(true)
    expect((cancelButton() as HTMLButtonElement).disabled).toBe(true)
  })

  it('Aplicar envia só a diferença, grava, confirma e refaz o estado do time', async () => {
    const { change, get } = renderTools({ active: ['agenda'] })
    const user = userEvent.setup()
    await screen.findByRole('switch', { name: 'Agenda' })

    await user.click(toggle('Sprints'))
    await user.click(applyButton())

    expect(change).toHaveBeenCalledWith({ enable: ['backlog', 'sprints'], disable: [] })
    expect(await screen.findByText('Mudança aplicada ao time.')).toBeTruthy()
    await waitFor(() => expect(get.mock.calls.length).toBeGreaterThan(1))
    await waitFor(() => expect(isOn('Sprints')).toBe(true))
    expect((applyButton() as HTMLButtonElement).disabled).toBe(true)
  })

  it('Cancelar descarta o rascunho e não chama alteração', async () => {
    const { change } = renderTools({ active: ['agenda'] })
    const user = userEvent.setup()
    await screen.findByRole('switch', { name: 'Agenda' })

    await user.click(toggle('Sprints'))
    await user.click(cancelButton())

    expect(isOn('Sprints')).toBe(false)
    expect(change).not.toHaveBeenCalled()
    expect(within(preview()).getByRole('heading', { name: 'Nada a aplicar' })).toBeTruthy()
  })

  it('falha ao aplicar mostra alerta em texto e mantém o rascunho', async () => {
    renderTools({
      active: ['agenda'],
      changeError: new ApiError('CONFLICT', 'Conflito de teste'),
    })
    const user = userEvent.setup()
    await screen.findByRole('switch', { name: 'Agenda' })

    await user.click(toggle('Sprints'))
    await user.click(applyButton())

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('Não foi possível aplicar')
    expect(isOn('Sprints')).toBe(true)
    expect(screen.queryByText('Mudança aplicada ao time.')).toBeNull()
  })

  it('Esc cancela a prévia sem gravar e devolve o foco à prévia', async () => {
    const { change } = renderTools({ active: ['agenda'] })
    const user = userEvent.setup()
    await screen.findByRole('switch', { name: 'Agenda' })

    await user.click(toggle('Sprints'))
    await user.keyboard('{Escape}')

    expect(change).not.toHaveBeenCalled()
    expect(isOn('Sprints')).toBe(false)
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Nada a aplicar' }))
  })

  it('com movimento reduzido, a prévia não entra com animação', async () => {
    stubMotion(true)
    renderTools({ active: ['agenda'] })
    await screen.findByRole('switch', { name: 'Agenda' })

    expect(preview().classList.contains('motion-fade-enter')).toBe(false)
  })

  it('sem movimento reduzido, a prévia entra com a animação de vidro', async () => {
    renderTools({ active: ['agenda'] })
    await screen.findByRole('switch', { name: 'Agenda' })

    expect(preview().classList.contains('motion-fade-enter')).toBe(true)
  })
})

describe('Ferramentas: módulo encerrando na aplicação (B1)', () => {
  it('desligar Sprints com Check-ins encerrando mostra Check-ins na prévia e o servidor aceita', async () => {
    const { change } = renderTools({
      active: ['agenda', 'backlog', 'sprints'],
      winding: ['checkins'],
    })
    const user = userEvent.setup()
    await screen.findByRole('switch', { name: 'Sprints' })

    await user.click(toggle('Sprints'))

    // Interruptor de Check-ins continua mostrando "Encerrando", fora do rascunho.
    expect(isOn('Check-ins')).toBe(false)
    expect(within(card('Check-ins')).getByText('Encerrando')).toBeTruthy()
    expect(within(preview()).getByText('Check-ins')).toBeTruthy()
    expect(screen.getByRole('status').textContent).toContain('Check-ins')

    await user.click(applyButton())

    expect(change).toHaveBeenCalledWith({ enable: [], disable: ['sprints', 'checkins'] })
    expect(await screen.findByText('Mudança aplicada ao time.')).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('recusa do servidor aparece com a razão, não só como "Não foi possível aplicar"', async () => {
    renderTools({
      active: ['agenda', 'backlog', 'sprints'],
      changeError: new ApiError('VALIDATION', refusalOf(['checkins'])),
    })
    const user = userEvent.setup()
    await screen.findByRole('switch', { name: 'Sprints' })

    await user.click(toggle('Sprints'))
    await user.click(applyButton())

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('Não foi possível aplicar')
    expect(alert.textContent).toContain('Mudança recusada: checkins ficaria sem o que precisa')
  })
})

describe('Ferramentas: prévia de impacto carregando ou falhando (B2)', () => {
  it('com a prévia carregando, mostra "Calculando…" e não diz que não há itens', async () => {
    renderTools({ active: ['agenda', 'backlog'], impactPending: true })
    const user = userEvent.setup()
    await screen.findByRole('switch', { name: 'Backlog' })

    await user.click(toggle('Backlog'))

    expect(await within(preview()).findByText('Calculando…')).toBeTruthy()
    expect(screen.queryByText('Nenhum item depende destas ferramentas.')).toBeNull()
    expect((applyButton() as HTMLButtonElement).disabled).toBe(true)
  })

  it('com a prévia falhando, mostra alerta em texto e Aplicar fica desabilitado', async () => {
    renderTools({ active: ['agenda', 'backlog'], impactError: new Error('offline') })
    const user = userEvent.setup()
    await screen.findByRole('switch', { name: 'Backlog' })

    await user.click(toggle('Backlog'))

    const alert = await within(preview()).findByRole('alert')
    expect(alert.textContent).toContain('Não foi possível calcular o impacto')
    expect(screen.queryByText('Nenhum item depende destas ferramentas.')).toBeNull()
    expect((applyButton() as HTMLButtonElement).disabled).toBe(true)
  })

  it('com a prévia pronta e sem itens, diz que nenhum item depende e libera Aplicar', async () => {
    renderTools({ active: ['agenda', 'backlog'] })
    const user = userEvent.setup()
    await screen.findByRole('switch', { name: 'Backlog' })

    await user.click(toggle('Backlog'))

    expect(
      await within(preview()).findByText('Nenhum item depende destas ferramentas.'),
    ).toBeTruthy()
    expect((applyButton() as HTMLButtonElement).disabled).toBe(false)
  })
})

describe('Ferramentas: gravação em andamento (B3)', () => {
  it('enquanto aplica, interruptores, presets e Cancelar ficam desabilitados, e o retorno chega', async () => {
    const { releaseChange } = renderTools({ active: ['agenda', 'backlog'], holdChange: true })
    const user = userEvent.setup()
    await screen.findByRole('switch', { name: 'Backlog' })

    await user.click(toggle('Backlog'))
    await user.click(applyButton())

    await waitFor(() => expect((applyButton() as HTMLButtonElement).disabled).toBe(true))
    expect((toggle('Agenda') as HTMLButtonElement).disabled).toBe(true)
    expect((toggle('Sprints') as HTMLButtonElement).disabled).toBe(true)
    expect((preset('Completo') as HTMLButtonElement).disabled).toBe(true)
    expect((preset('Quadro simples') as HTMLButtonElement).disabled).toBe(true)
    expect((cancelButton() as HTMLButtonElement).disabled).toBe(true)

    releaseChange()

    expect(await screen.findByText('Mudança aplicada ao time.')).toBeTruthy()
    await waitFor(() => expect(isOn('Backlog')).toBe(false))
  })
})

describe('Ferramentas: acesso e carregamento', () => {
  it('colaborador não vê os interruptores, só depois que sessão e estado carregaram', async () => {
    renderTools({ role: 'collaborator', active: ['agenda', 'backlog'] })

    // Espera o sinal positivo: sem ele, a ausência de interruptores poderia ser só corrida.
    await screen.findByText('Sessão e estado carregados')

    expect(screen.queryAllByRole('switch')).toHaveLength(0)
    expect(screen.queryByRole('button', { name: 'Completo' })).toBeNull()
    expect(screen.queryByRole('complementary', { name: 'Impacto da mudança' })).toBeNull()
  })

  it('falha ao carregar mostra alerta em texto', async () => {
    renderTools({ getError: new Error('offline') })

    expect(await screen.findByRole('alert')).toBeTruthy()
    await waitFor(() => expect(screen.queryAllByRole('switch')).toHaveLength(0))
  })
})

describe('Ferramentas: concluir encerramento (M3.0)', () => {
  const finishButton = (name: string) =>
    screen.getByRole('button', { name: `Concluir encerramento de ${name}` })

  it('só o cartão de módulo encerrando tem o botão, com o nome da ferramenta', async () => {
    renderTools({ active: ['agenda'], winding: ['checkins'] })
    await screen.findByRole('switch', { name: 'Agenda' })

    expect(finishButton('Check-ins').textContent).toBe('Concluir encerramento')
    expect(screen.getAllByRole('button', { name: /Concluir encerramento/ })).toHaveLength(1)
    expect(within(card('Agenda')).queryByRole('button', { name: /Concluir/ })).toBeNull()
  })

  it('concluir chama finishWindingDown, avisa com GlassToast e tira o botão depois da releitura', async () => {
    const { finish, get } = renderTools({ active: ['agenda'], winding: ['checkins'] })
    const user = userEvent.setup()
    await screen.findByRole('switch', { name: 'Agenda' })
    const readsBefore = get.mock.calls.length

    await user.click(finishButton('Check-ins'))

    expect(finish).toHaveBeenCalledWith({ moduleId: 'checkins' })
    expect(await screen.findByText('Encerramento concluído: Check-ins.')).toBeTruthy()
    await waitFor(() => expect(within(card('Check-ins')).getByText('Desligada')).toBeTruthy())
    expect(screen.queryByRole('button', { name: 'Concluir encerramento de Check-ins' })).toBeNull()
    expect(get.mock.calls.length).toBeGreaterThan(readsBefore)
    expect(screen.queryByRole('alert')).toBeNull()
    // O botão sumiu; o foco não pode cair no body (WCAG 2.4.3): vai à prévia, como os outros fluxos.
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Nada a aplicar' }))
  })

  it('recusa do servidor aparece em alerta com a razão, e o botão continua disponível', async () => {
    const reason = 'Mudança recusada: sprints ficaria sem o que precisa'
    renderTools({
      active: ['agenda'],
      winding: ['checkins'],
      finishError: new ApiError('VALIDATION', reason),
    })
    const user = userEvent.setup()
    await screen.findByRole('switch', { name: 'Agenda' })

    await user.click(finishButton('Check-ins'))

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('Não foi possível concluir o encerramento.')
    expect(alert.textContent).toContain(reason)
    expect(screen.queryByText(/Encerramento concluído/)).toBeNull()
    expect((finishButton('Check-ins') as HTMLButtonElement).disabled).toBe(false)
    expect(finishButton('Check-ins').getAttribute('aria-disabled')).toBeNull()
  })

  it('durante o envio o botão continua com o foco, marcado como ocupado, sem o atributo disabled', async () => {
    const { releaseFinish } = renderTools({
      active: ['agenda'],
      winding: ['checkins'],
      holdFinish: true,
    })
    const user = userEvent.setup()
    await screen.findByRole('switch', { name: 'Agenda' })

    await user.click(finishButton('Check-ins'))

    const button = finishButton('Check-ins')
    expect(button.getAttribute('aria-disabled')).toBe('true')
    expect(button.hasAttribute('disabled')).toBe(false)
    expect(document.activeElement).toBe(button)

    releaseFinish()

    expect(await screen.findByText('Encerramento concluído: Check-ins.')).toBeTruthy()
  })

  it('dois cliques seguidos enquanto envia chamam o servidor uma vez só', async () => {
    const { finish, releaseFinish } = renderTools({
      active: ['agenda'],
      winding: ['checkins'],
      holdFinish: true,
    })
    await screen.findByRole('switch', { name: 'Agenda' })
    const button = finishButton('Check-ins')

    // Dois cliques disparados em sequência, sem esperar a tela redesenhar: só a guarda os separa.
    fireEvent.click(button)
    fireEvent.click(button)
    await waitFor(() => expect(finish).toHaveBeenCalled())
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(finish).toHaveBeenCalledTimes(1)

    releaseFinish()

    expect(await screen.findByText('Encerramento concluído: Check-ins.')).toBeTruthy()
  })

  it('com uma gravação de mudança em andamento, o botão de concluir também fica ocupado e não envia', async () => {
    const { finish, releaseChange } = renderTools({
      active: ['agenda'],
      winding: ['checkins'],
      holdChange: true,
    })
    const user = userEvent.setup()
    await screen.findByRole('switch', { name: 'Agenda' })

    await user.click(toggle('Sprints'))
    await user.click(applyButton())

    expect(finishButton('Check-ins').getAttribute('aria-disabled')).toBe('true')
    await user.click(finishButton('Check-ins'))
    expect(finish).not.toHaveBeenCalled()

    releaseChange()

    expect(await screen.findByText('Mudança aplicada ao time.')).toBeTruthy()
  })

  it('recusa do encerramento some ao cancelar a prévia', async () => {
    renderTools({
      active: ['agenda'],
      winding: ['checkins'],
      finishError: new ApiError('VALIDATION', 'Mudança recusada: teste'),
    })
    const user = userEvent.setup()
    await screen.findByRole('switch', { name: 'Agenda' })

    // Rascunho com mudança pendente, depois a recusa do encerramento, e então Cancelar.
    await user.click(toggle('Sprints'))
    await user.click(finishButton('Check-ins'))
    expect(await screen.findByRole('alert')).toBeTruthy()

    await user.click(cancelButton())

    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('recusa do encerramento some ao aplicar a prévia', async () => {
    renderTools({
      active: ['agenda'],
      winding: ['checkins'],
      finishError: new ApiError('VALIDATION', 'Mudança recusada: teste'),
    })
    const user = userEvent.setup()
    await screen.findByRole('switch', { name: 'Agenda' })

    await user.click(toggle('Sprints'))
    await user.click(finishButton('Check-ins'))
    expect(await screen.findByRole('alert')).toBeTruthy()

    await user.click(applyButton())

    expect(await screen.findByText('Mudança aplicada ao time.')).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('colaborador não vê a tela de ferramentas, então não vê o botão, mesmo com módulo encerrando', async () => {
    renderTools({ role: 'collaborator', active: ['agenda'], winding: ['checkins'] })

    await screen.findByText('Sessão e estado carregados')

    expect(screen.queryByRole('button', { name: /Concluir encerramento/ })).toBeNull()
  })
})
