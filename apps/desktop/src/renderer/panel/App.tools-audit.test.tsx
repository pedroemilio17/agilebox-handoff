import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EXPERIENCE_LEVEL_LABELS, TEAM_PRESETS, type ExperienceLevel } from '@agilebox/core'
import type { TeamToolsViewDto } from '@agilebox/contract'
import { ApiProvider } from '../shared/api/ApiProvider'
import { createFakeApi } from '../shared/testing/fake-api'
import { presetModules, teamToolsView } from '../shared/testing/team-tools-fixture'
import {
  FLOW_AGING_TASK,
  FLOW_TASK_WITH_PLANNING,
  installFlowApi,
  managerDashboard,
  stubDesktopBridge,
} from '../shared/testing/flow-backend'
import { App } from './App'
import { panelCopy } from './copy'

/**
 * Auditoria dos 4 presets × 3 níveis: o que o colaborador e o gestor veem no menu, no quadro, no
 * detalhe, na Agenda, em Ajustes e no dashboard. O relatório (inline snapshot) muda quando alguma
 * tela muda: a mudança aparece como diff neste teste. Para atualizar de propósito, rode
 * `vitest run -u` neste arquivo e revise o diff.
 *
 * Não cobre a bandeja (ela tem os próprios testes adaptativos) nem o combinado de retro, que só
 * aparece com uma reunião de retro em andamento.
 */

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const CARD = /^AB-118 · /
const LEVELS: ExperienceLevel[] = ['basic', 'intermediate', 'advanced']

/** Itens da barra lateral: botões diretos da navegação (sem a lista de projetos). */
function railItems(): string {
  const nav = screen.getByRole('navigation', { name: 'Navegação principal' })
  const names = Array.from(nav.children)
    .filter((element): element is HTMLButtonElement => element.tagName === 'BUTTON')
    .map((button) => button.getAttribute('aria-label') ?? button.textContent ?? '')
    .filter((name) => !/^(Recolher|Expandir|Início|Buscar ou criar)/.test(name))
  return names.map((name) => name.replace(', Em breve', ' (em breve)')).join(', ')
}

/** Lista de marcadores presentes; "nenhum" quando nada aparece. */
function present(marks: readonly (readonly [string, boolean])[]): string {
  const found = marks.filter(([, on]) => on).map(([label]) => label)
  return found.length > 0 ? found.join(', ') : 'nenhum'
}

function renderPanel(role: 'collaborator' | 'manager', tools: TeamToolsViewDto) {
  vi.stubGlobal('agilebox', stubDesktopBridge())
  const api = createFakeApi()
  vi.spyOn(api.daily, 'listForDate').mockResolvedValue([])
  installFlowApi(api, {
    role,
    tools,
    tasks: [FLOW_TASK_WITH_PLANNING, FLOW_AGING_TASK],
    wipLimits: { in_progress: 3 },
    wipColumns: [{ status: 'in_progress', count: 1, limit: 3, state: 'ok' }],
    dashboard: managerDashboard(),
  })
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <ApiProvider api={api}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </ApiProvider>,
  )
  return userEvent.setup()
}

async function auditCollaborator(user: ReturnType<typeof userEvent.setup>): Promise<string[]> {
  await screen.findByRole('region', { name: 'Concluído, tarefas' })
  const lines: string[] = []
  lines.push(`  menu: ${railItems()}`)

  const card = screen.getByRole('button', { name: CARD })
  const cardLabel = card.getAttribute('aria-label') ?? ''
  lines.push(
    `  quadro: ${present([
      ['filtro Bloqueadas', screen.queryByRole('button', { name: /^Bloqueadas/ }) !== null],
      ['filtro Paradas', screen.queryByRole('button', { name: /^Paradas/ }) !== null],
      ['badge parada no card', screen.queryByText(/^parada \d+d$/) !== null],
      ['filtro Sprint ativa', screen.queryByRole('button', { name: /^Sprint ativa/ }) !== null],
      ['medidor WIP', screen.queryByRole('img', { name: /: \d+ de \d+/ }) !== null],
      ['ciclo médio', screen.queryByText(/Ciclo médio desta semana/) !== null],
      ['marcador de bloqueio no card', cardLabel.includes('bloqueada')],
      ['progresso de subtarefas no card', cardLabel.includes('subtarefas')],
      ['marcador de critérios no card', cardLabel.includes('critérios')],
      ['estimativa no card', cardLabel.includes('Estimativa')],
    ])}`,
  )

  await user.click(card)
  const dialog = await screen.findByRole('dialog', { name: FLOW_TASK_WITH_PLANNING.title })
  lines.push(
    `  detalhe: ${present([
      ['motivo do bloqueio', within(dialog).queryByText('Aguardando API') !== null],
      ['Bloquear', within(dialog).queryByRole('button', { name: 'Bloquear' }) !== null],
      [
        'Resolver impedimento',
        within(dialog).queryByRole('button', { name: 'Resolver impedimento' }) !== null,
      ],
      [
        'Histórico de impedimentos',
        within(dialog).queryByRole('region', { name: 'Histórico de impedimentos' }) !== null,
      ],
      ['Subtarefas', within(dialog).queryByRole('region', { name: 'Subtarefas' }) !== null],
      [
        'Critérios de aceitação',
        within(dialog).queryByRole('region', { name: 'Critérios de aceitação' }) !== null,
      ],
      ['Estimativa (h)', within(dialog).queryByRole('group', { name: 'Estimativa (h)' }) !== null],
    ])}`,
  )
  await user.keyboard('{Escape}')
  await waitFor(() =>
    expect(screen.queryByRole('dialog', { name: FLOW_TASK_WITH_PLANNING.title })).toBeNull(),
  )

  if (screen.queryByRole('button', { name: 'Backlog' })) {
    await user.click(screen.getByRole('button', { name: 'Backlog' }))
    lines.push(
      `  backlog: ${screen.queryByRole('region', { name: 'Backlog' }) ? 'aberto' : 'sem tela'}`,
    )
    await user.click(screen.getByRole('button', { name: 'Quadro' }))
  } else {
    lines.push('  backlog: fora do menu')
  }

  if (screen.queryByRole('button', { name: 'Agenda' })) {
    await user.click(screen.getByRole('button', { name: 'Agenda' }))
    lines.push(
      `  agenda: ${screen.queryByRole('heading', { name: 'Agenda' }) ? 'aberta' : 'sem tela'}`,
    )
  } else {
    lines.push('  agenda: fora do menu')
  }

  await user.click(screen.getByRole('button', { name: 'Ajustes' }))
  const team = screen.getByRole('region', { name: panelCopy.teamToolsTitle })
  const notes = within(team)
    .queryAllByRole('note')
    .map((note) => (note.textContent ?? '').split(' aparece')[0])
  lines.push(
    `  ajustes: ${within(team).queryByText(panelCopy.teamToolsReadOnly) ? 'somente leitura' : 'editável'}; avisos de nível: ${notes.length > 0 ? notes.join(', ') : 'nenhum'}`,
  )
  return lines
}

async function auditManager(user: ReturnType<typeof userEvent.setup>): Promise<string[]> {
  await screen.findByRole('region', { name: 'Concluído, tarefas' })
  const lines: string[] = []
  await user.click(screen.getByRole('button', { name: 'Dashboard' }))
  await screen.findByRole('region', { name: 'Quadro em dia' })
  lines.push(
    `  dashboard: ${present([
      ['Bloqueadas', screen.queryByRole('button', { name: /^Bloqueadas/ }) !== null],
      ['Paradas', screen.queryByRole('button', { name: /^Paradas/ }) !== null],
      [
        'colunas acima do limite',
        screen.queryByRole('list', { name: 'Colunas acima do limite' }) !== null,
      ],
      [
        'fluxo de seis semanas',
        screen.queryByRole('region', { name: 'Fluxo de seis semanas' }) !== null,
      ],
      ['daily de hoje', screen.queryByText(/Daily de hoje/) !== null],
    ])}`,
  )
  await user.click(screen.getByRole('button', { name: 'Ajustes' }))
  const team = screen.getByRole('region', { name: panelCopy.teamToolsTitle })
  const applyButtons = within(team).queryAllByRole('button', { name: /^Aplicar preset/ }).length
  lines.push(
    `  ajustes (gestor): ${applyButtons} presets para aplicar; ${within(team).queryByRole('group', { name: panelCopy.teamToolsLevelGroup }) ? 'controle de nível' : 'sem controle de nível'}`,
  )
  return lines
}

async function auditCombo(presetId: string, level: ExperienceLevel): Promise<string[]> {
  const preset = TEAM_PRESETS.find((item) => item.id === presetId)!
  const modules = presetModules(preset.id)
  const header = `${preset.label} · ${EXPERIENCE_LEVEL_LABELS[level]}`

  const collaborator = renderPanel('collaborator', teamToolsView({ modules, level }))
  const collaboratorLines = await auditCollaborator(collaborator)
  cleanup()
  vi.unstubAllGlobals()

  const manager = renderPanel('manager', teamToolsView({ modules, level, role: 'manager' }))
  const managerLines = await auditManager(manager)
  cleanup()
  vi.unstubAllGlobals()

  return [header, '  colaborador', ...collaboratorLines, '  gestor', ...managerLines]
}

describe('Auditoria de ferramentas × nível (4 presets × 3 níveis)', () => {
  it('relatório de telas visíveis por preset e nível', async () => {
    const report: string[] = []
    for (const preset of TEAM_PRESETS) {
      for (const level of LEVELS) {
        report.push(...(await auditCombo(preset.id, level)))
      }
    }
    expect(report.join('\n')).toMatchInlineSnapshot(`
      "Kanban simples · Básico
        colaborador
        menu: Quadro, Agenda, Plug-ins (em breve), Ajustes
        quadro: badge parada no card
        detalhe: nenhum
        backlog: fora do menu
        agenda: aberta
        ajustes: somente leitura; avisos de nível: nenhum
        gestor
        dashboard: Paradas
        ajustes (gestor): 4 presets para aplicar; controle de nível
      Kanban simples · Intermediário
        colaborador
        menu: Quadro, Agenda, Plug-ins (em breve), Ajustes
        quadro: badge parada no card
        detalhe: nenhum
        backlog: fora do menu
        agenda: aberta
        ajustes: somente leitura; avisos de nível: nenhum
        gestor
        dashboard: Paradas
        ajustes (gestor): 4 presets para aplicar; controle de nível
      Kanban simples · Avançado
        colaborador
        menu: Quadro, Agenda, Plug-ins (em breve), Ajustes
        quadro: badge parada no card
        detalhe: nenhum
        backlog: fora do menu
        agenda: aberta
        ajustes: somente leitura; avisos de nível: nenhum
        gestor
        dashboard: Paradas
        ajustes (gestor): 4 presets para aplicar; controle de nível
      Scrum · Básico
        colaborador
        menu: Quadro, Backlog, Sprints, Impedimentos, Agenda, Plug-ins (em breve), Ajustes
        quadro: filtro Bloqueadas, badge parada no card, marcador de bloqueio no card, marcador de critérios no card, estimativa no card
        detalhe: motivo do bloqueio, Histórico de impedimentos, Critérios de aceitação, Estimativa (h)
        backlog: aberto
        agenda: aberta
        ajustes: somente leitura; avisos de nível: Backlog, Sprints, Check-ins, Impedimentos, Estimativas em horas, Critérios de aceitação
        gestor
        dashboard: Bloqueadas, Paradas
        ajustes (gestor): 4 presets para aplicar; controle de nível
      Scrum · Intermediário
        colaborador
        menu: Quadro, Backlog, Sprints, Impedimentos, Agenda, Plug-ins (em breve), Ajustes
        quadro: filtro Bloqueadas, badge parada no card, filtro Sprint ativa, marcador de bloqueio no card, marcador de critérios no card, estimativa no card
        detalhe: motivo do bloqueio, Resolver impedimento, Histórico de impedimentos, Critérios de aceitação, Estimativa (h)
        backlog: aberto
        agenda: aberta
        ajustes: somente leitura; avisos de nível: nenhum
        gestor
        dashboard: Bloqueadas, Paradas, daily de hoje
        ajustes (gestor): 4 presets para aplicar; controle de nível
      Scrum · Avançado
        colaborador
        menu: Quadro, Backlog, Sprints, Impedimentos, Agenda, Plug-ins (em breve), Ajustes
        quadro: filtro Bloqueadas, badge parada no card, filtro Sprint ativa, marcador de bloqueio no card, marcador de critérios no card, estimativa no card
        detalhe: motivo do bloqueio, Resolver impedimento, Histórico de impedimentos, Critérios de aceitação, Estimativa (h)
        backlog: aberto
        agenda: aberta
        ajustes: somente leitura; avisos de nível: nenhum
        gestor
        dashboard: Bloqueadas, Paradas, daily de hoje
        ajustes (gestor): 4 presets para aplicar; controle de nível
      Kanban com fluxo · Básico
        colaborador
        menu: Quadro, Agenda, Plug-ins (em breve), Ajustes
        quadro: badge parada no card, progresso de subtarefas no card
        detalhe: nenhum
        backlog: fora do menu
        agenda: aberta
        ajustes: somente leitura; avisos de nível: Limites de WIP, Subtarefas e dependências, Métricas de fluxo
        gestor
        dashboard: Paradas, colunas acima do limite
        ajustes (gestor): 4 presets para aplicar; controle de nível
      Kanban com fluxo · Intermediário
        colaborador
        menu: Quadro, Agenda, Plug-ins (em breve), Ajustes
        quadro: badge parada no card, progresso de subtarefas no card
        detalhe: nenhum
        backlog: fora do menu
        agenda: aberta
        ajustes: somente leitura; avisos de nível: Limites de WIP, Subtarefas e dependências, Métricas de fluxo
        gestor
        dashboard: Paradas, colunas acima do limite
        ajustes (gestor): 4 presets para aplicar; controle de nível
      Kanban com fluxo · Avançado
        colaborador
        menu: Quadro, Agenda, Plug-ins (em breve), Ajustes
        quadro: filtro Paradas, badge parada no card, medidor WIP, ciclo médio, progresso de subtarefas no card
        detalhe: Subtarefas
        backlog: fora do menu
        agenda: aberta
        ajustes: somente leitura; avisos de nível: nenhum
        gestor
        dashboard: Paradas, colunas acima do limite, fluxo de seis semanas
        ajustes (gestor): 4 presets para aplicar; controle de nível
      Scrum completo · Básico
        colaborador
        menu: Quadro, Backlog, Sprints, Impedimentos, Agenda, Plug-ins (em breve), Ajustes
        quadro: filtro Bloqueadas, badge parada no card, marcador de bloqueio no card, marcador de critérios no card, estimativa no card
        detalhe: motivo do bloqueio, Histórico de impedimentos, Critérios de aceitação, Estimativa (h)
        backlog: aberto
        agenda: aberta
        ajustes: somente leitura; avisos de nível: Backlog, Sprints, Check-ins, Impedimentos, Estimativas em horas, Critérios de aceitação, Review e retro, Burndown e velocity
        gestor
        dashboard: Bloqueadas, Paradas
        ajustes (gestor): 4 presets para aplicar; controle de nível
      Scrum completo · Intermediário
        colaborador
        menu: Quadro, Backlog, Sprints, Impedimentos, Agenda, Plug-ins (em breve), Ajustes
        quadro: filtro Bloqueadas, badge parada no card, filtro Sprint ativa, marcador de bloqueio no card, marcador de critérios no card, estimativa no card
        detalhe: motivo do bloqueio, Resolver impedimento, Histórico de impedimentos, Critérios de aceitação, Estimativa (h)
        backlog: aberto
        agenda: aberta
        ajustes: somente leitura; avisos de nível: Review e retro, Burndown e velocity
        gestor
        dashboard: Bloqueadas, Paradas, daily de hoje
        ajustes (gestor): 4 presets para aplicar; controle de nível
      Scrum completo · Avançado
        colaborador
        menu: Quadro, Backlog, Sprints, Impedimentos, Agenda, Plug-ins (em breve), Ajustes
        quadro: filtro Bloqueadas, badge parada no card, filtro Sprint ativa, marcador de bloqueio no card, marcador de critérios no card, estimativa no card
        detalhe: motivo do bloqueio, Resolver impedimento, Histórico de impedimentos, Critérios de aceitação, Estimativa (h)
        backlog: aberto
        agenda: aberta
        ajustes: somente leitura; avisos de nível: nenhum
        gestor
        dashboard: Bloqueadas, Paradas, daily de hoje
        ajustes (gestor): 4 presets para aplicar; controle de nível"
    `)
  }, 120_000)
})
