import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { TeamToolsViewDto } from '@agilebox/contract'
import type { ModuleId } from '@agilebox/core'
import { ApiProvider } from '../shared/api/ApiProvider'
import { createFakeApi } from '../shared/testing/fake-api'
import { presetModules, teamToolsView } from '../shared/testing/team-tools-fixture'
import {
  changeResult,
  FLOW_TASK_WITH_PLANNING,
  installFlowApi,
  managerDashboard,
  previewOk,
  stubDesktopBridge,
} from '../shared/testing/flow-backend'
import { App } from './App'
import { panelCopy } from './copy'

/**
 * Trocar nível ou preset não perde dados (PLANO-2.0, critério de pronto do M2). A UI esconde o que
 * o nível ou o módulo não permite; o que já existe continua guardado e volta quando a regra deixa.
 */

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const CARD = /^AB-118 · /
const TASK_ID = FLOW_TASK_WITH_PLANNING.id
/** Scrum completo mais WIP, subtarefas e métricas de fluxo: valido, sem módulos em conflito. */
const ADVANCED_MODULES: ModuleId[] = [
  ...presetModules('scrum-complete'),
  'wip',
  'subtasks',
  'flowMetrics',
]
/** O que o preset Kanban simples desliga a partir de ADVANCED_MODULES. */
const WINDING_DOWN: ModuleId[] = ADVANCED_MODULES.filter(
  (id) => !presetModules('kanban').includes(id),
)

function renderPanel(tools: TeamToolsViewDto) {
  vi.stubGlobal('agilebox', stubDesktopBridge())
  const api = createFakeApi()
  vi.spyOn(api.daily, 'listForDate').mockResolvedValue([])
  const flow = installFlowApi(api, {
    role: 'manager',
    tools,
    tasks: [FLOW_TASK_WITH_PLANNING],
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
  return { user: userEvent.setup(), api, ...flow }
}

async function openTaskDetail(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: CARD }))
  return screen.findByRole('dialog', { name: FLOW_TASK_WITH_PLANNING.title })
}

/** Linha da ferramenta em Ajustes, pelo nome que aparece no texto da linha. */
function toolRow(name: string) {
  return screen.getByText(name, { selector: 'span' }).closest('li') as HTMLElement
}

describe('Trocar nível não perde dados', () => {
  it('Avançado → Básico → Avançado: a UI esconde e mostra, e os dados ficam iguais', async () => {
    const { user, api, backend, spies, serve } = renderPanel(
      teamToolsView({ modules: ADVANCED_MODULES, level: 'advanced', role: 'manager' }),
    )
    const before = structuredClone(backend.get(TASK_ID))

    // Avançado: medidor de WIP, subtarefas e bloqueio com ação.
    await screen.findByRole('region', { name: 'Concluído, tarefas' })
    expect(screen.getByRole('img', { name: /: 1 de 3/ })).toBeTruthy()
    let dialog = await openTaskDetail(user)
    expect(within(dialog).getByRole('region', { name: 'Subtarefas' })).toBeTruthy()
    expect(within(dialog).getByRole('button', { name: 'Desbloquear' })).toBeTruthy()
    await user.keyboard('{Escape}')
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: FLOW_TASK_WITH_PLANNING.title })).toBeNull(),
    )

    // Básico: a equipe troca de nível em Ajustes.
    spies.setLevel.mockImplementation(({ level }) => {
      const basic = teamToolsView({ modules: ADVANCED_MODULES, level, role: 'manager' })
      serve(basic)
      return Promise.resolve(changeResult(basic))
    })
    await user.click(screen.getByRole('button', { name: 'Ajustes' }))
    const team = screen.getByRole('region', { name: panelCopy.teamToolsTitle })
    await user.click(within(team).getByRole('button', { name: panelCopy.levelBasic }))
    expect(spies.setLevel).toHaveBeenCalledWith({ level: 'basic' })

    await user.click(screen.getByRole('button', { name: 'Quadro' }))
    await screen.findByRole('region', { name: 'Concluído, tarefas' })
    expect(screen.queryByRole('img', { name: /: \d+ de \d+/ })).toBeNull()
    expect(screen.getByRole('button', { name: 'Bloqueadas · 1' })).toBeTruthy()
    dialog = await openTaskDetail(user)
    expect(within(dialog).queryByRole('region', { name: 'Subtarefas' })).toBeNull()
    expect(within(dialog).queryByRole('button', { name: 'Desbloquear' })).toBeNull()
    expect(within(dialog).getByText('Aguardando API')).toBeTruthy()
    await user.keyboard('{Escape}')
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: FLOW_TASK_WITH_PLANNING.title })).toBeNull(),
    )

    // As consultas continuam devolvendo o que está guardado.
    expect(backend.get(TASK_ID)).toEqual(before)
    expect((await api.tasks.get({ taskId: TASK_ID })).checklist).toHaveLength(2)
    expect((await api.tasks.listBoard({})).wipLimits).toEqual({ in_progress: 3 })

    // Volta ao Avançado: tudo reaparece como estava.
    spies.setLevel.mockImplementation(({ level }) => {
      const advanced = teamToolsView({ modules: ADVANCED_MODULES, level, role: 'manager' })
      serve(advanced)
      return Promise.resolve(changeResult(advanced))
    })
    await user.click(screen.getByRole('button', { name: 'Ajustes' }))
    await user.click(
      within(screen.getByRole('region', { name: panelCopy.teamToolsTitle })).getByRole('button', {
        name: panelCopy.levelAdvanced,
      }),
    )
    await user.click(screen.getByRole('button', { name: 'Quadro' }))
    await screen.findByRole('region', { name: 'Concluído, tarefas' })
    expect(screen.getByRole('img', { name: /: 1 de 3/ })).toBeTruthy()
    dialog = await openTaskDetail(user)
    expect(within(dialog).getByText('Mapear rotas')).toBeTruthy()
    expect(within(dialog).getByText('Testar com o sandbox')).toBeTruthy()
    expect(within(dialog).getByRole('button', { name: 'Desbloquear' })).toBeTruthy()
    expect(backend.get(TASK_ID)).toEqual(before)
  })
})

describe('Aplicar preset que desliga módulos não apaga nada', () => {
  it('as ferramentas entram em Encerrando; o quadro segue com os dados e a ação de desbloquear', async () => {
    const { user, backend, spies, serve } = renderPanel(
      teamToolsView({ modules: ADVANCED_MODULES, level: 'advanced', role: 'manager' }),
    )
    const before = structuredClone(backend.get(TASK_ID))

    spies.previewChange.mockResolvedValue(previewOk({ windingDown: WINDING_DOWN }))
    spies.applyPreset.mockImplementation(() => {
      const winding = teamToolsView({
        modules: presetModules('kanban'),
        winding: WINDING_DOWN,
        level: 'advanced',
        role: 'manager',
      })
      serve(winding)
      return Promise.resolve(changeResult(winding, { windingDown: WINDING_DOWN }))
    })

    await user.click(await screen.findByRole('button', { name: 'Ajustes' }))
    const team = screen.getByRole('region', { name: panelCopy.teamToolsTitle })
    await user.click(
      within(team).getByRole('button', { name: panelCopy.teamPresetApply('Kanban simples') }),
    )
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Confirmar' }))
    expect(spies.applyPreset).toHaveBeenCalledWith(expect.objectContaining({ presetId: 'kanban' }))

    for (const name of ['Sprints', 'Subtarefas e dependências', 'Limites de WIP']) {
      expect(within(toolRow(name)).getByText('Encerrando')).toBeTruthy()
    }
    // Ferramenta em encerramento ainda existe: o que já está nela segue visível e editável.
    await user.click(screen.getByRole('button', { name: 'Quadro' }))
    await screen.findByRole('region', { name: 'Concluído, tarefas' })
    expect(screen.getByRole('img', { name: /: 1 de 3/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Bloqueadas · 1' })).toBeTruthy()
    const dialog2 = await openTaskDetail(user)
    expect(within(dialog2).getByRole('region', { name: 'Subtarefas' })).toBeTruthy()
    expect(within(dialog2).getByRole('button', { name: 'Desbloquear' })).toBeTruthy()
    expect(backend.get(TASK_ID)).toEqual(before)
    await user.keyboard('{Escape}')
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: FLOW_TASK_WITH_PLANNING.title })).toBeNull(),
    )

    // Concluir o encerramento de subtarefas: o módulo vira desativado, e os itens continuam salvos.
    spies.completeWindDown.mockImplementation(({ moduleId }) => {
      const remaining = WINDING_DOWN.filter((id) => id !== moduleId)
      const next = teamToolsView({
        modules: presetModules('kanban'),
        winding: remaining,
        level: 'advanced',
        role: 'manager',
      })
      serve(next)
      return Promise.resolve(changeResult(next))
    })
    await user.click(screen.getByRole('button', { name: 'Ajustes' }))
    const subtasksRow = toolRow('Subtarefas e dependências')
    await user.click(
      within(subtasksRow).getByRole('button', { name: panelCopy.teamToolWindDownComplete }),
    )
    await user.click(within(subtasksRow).getByRole('button', { name: 'Confirmar' }))
    expect(spies.completeWindDown).toHaveBeenCalledWith({ moduleId: 'subtasks' })
    expect(within(toolRow('Subtarefas e dependências')).getByText('Desativada')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Quadro' }))
    await screen.findByRole('region', { name: 'Concluído, tarefas' })
    const dialog3 = await openTaskDetail(user)
    expect(within(dialog3).queryByRole('region', { name: 'Subtarefas' })).toBeNull()
    expect(backend.get(TASK_ID)).toEqual(before)
  })
})
