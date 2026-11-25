import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ApiError,
  type TeamToolsChangeResultDto,
  type TeamToolsPreviewDto,
  type TeamToolsViewDto,
} from '@agilebox/contract'
import {
  effectiveCapabilities,
  getModule,
  MODULE_IDS,
  MODULE_LABELS,
  TEAM_PRESETS,
  type ExperienceLevel,
  type ModuleId,
  type UserRole,
} from '@agilebox/core'
import { ApiProvider } from '../../shared/api/ApiProvider'
import { queryKeys } from '../../shared/query/keys'
import { createFakeApi } from '../../shared/testing/fake-api'
import { TeamToolsSection } from './TeamToolsSection'

afterEach(cleanup)

interface ViewOptions {
  readonly active?: readonly ModuleId[]
  readonly winding?: readonly ModuleId[]
  readonly level?: ExperienceLevel
  readonly role?: UserRole
  readonly levelWarnings?: TeamToolsViewDto['levelWarnings']
}

/** Visão de `teamTools.get` com o cálculo de capacidades do servidor. */
function viewOf({
  active = [],
  winding = [],
  level = 'advanced',
  role = 'manager',
  levelWarnings = [],
}: ViewOptions = {}): TeamToolsViewDto {
  const modules = [...active, ...winding]
  return {
    level,
    modules: MODULE_IDS.map((id) => ({
      id,
      label: MODULE_LABELS[id],
      state: active.includes(id) ? 'active' : winding.includes(id) ? 'winding_down' : 'disabled',
      minLevel: getModule(id).minLevel,
    })),
    presets: TEAM_PRESETS.map((preset) => ({
      id: preset.id,
      label: preset.label,
      modules: [...preset.modules],
      suggestedLevel: preset.suggestedLevel,
    })),
    capabilities: effectiveCapabilities({ modules: modules, level, role }),
    levelWarnings,
    canManage: role === 'manager',
  }
}

function preview(overrides: Partial<TeamToolsPreviewDto> = {}): TeamToolsPreviewDto {
  return {
    ok: true,
    message: null,
    autoEnabled: [],
    activated: [],
    windingDown: [],
    disabled: [],
    conflicts: [],
    blockedBy: [],
    dependents: [],
    impact: [],
    ...overrides,
  }
}

function resultOf(view: TeamToolsViewDto, extra: Partial<TeamToolsChangeResultDto> = {}) {
  return { view, autoEnabled: [], windingDown: [], disabled: [], ...extra }
}

interface PreviewInput {
  readonly enable?: string[]
  readonly disable?: string[]
  readonly presetId?: string
}

function setup({
  view,
  previewFor = () => preview(),
}: {
  view: TeamToolsViewDto
  previewFor?: (input: PreviewInput) => TeamToolsPreviewDto | Promise<TeamToolsPreviewDto>
}) {
  const api = createFakeApi()
  const get = vi.spyOn(api.teamTools, 'get').mockResolvedValue(view)
  const previewChange = vi
    .spyOn(api.teamTools, 'previewChange')
    .mockImplementation((input) => Promise.resolve(previewFor(input as PreviewInput)))
  const applyChange = vi.spyOn(api.teamTools, 'applyChange').mockResolvedValue(resultOf(view))
  const completeWindDown = vi
    .spyOn(api.teamTools, 'completeWindDown')
    .mockResolvedValue(resultOf(view))
  const setLevel = vi.spyOn(api.teamTools, 'setLevel').mockResolvedValue(resultOf(view))
  const applyPreset = vi.spyOn(api.teamTools, 'applyPreset').mockResolvedValue(resultOf(view))
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
  render(
    <ApiProvider api={api}>
      <QueryClientProvider client={queryClient}>
        <TeamToolsSection />
      </QueryClientProvider>
    </ApiProvider>,
  )
  return {
    get,
    previewChange,
    applyChange,
    completeWindDown,
    setLevel,
    applyPreset,
    invalidate,
    queryClient,
  }
}

const rowOf = async (name: string) => (await screen.findByText(name)).closest('li') as HTMLElement

describe('Ferramentas da equipe: permissões', () => {
  it('gestor vê controles e nenhum selo de somente leitura', async () => {
    setup({ view: viewOf({ active: ['core', 'agenda'] }) })
    expect(await screen.findByRole('switch', { name: 'Ligar Sprints' })).toBeTruthy()
    expect(screen.queryByText('Somente leitura')).toBeNull()
    expect(screen.getByRole('button', { name: 'Aplicar preset Scrum' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Intermediário' })).toBeTruthy()
  })

  it('colaborador vê o selo, o nível e nenhum controle de mudança', async () => {
    setup({ view: viewOf({ active: ['core', 'agenda'], role: 'collaborator' }) })
    expect(await screen.findByText('Somente leitura')).toBeTruthy()
    expect(screen.getByRole('switch', { name: 'Ligar Sprints' }).hasAttribute('disabled')).toBe(
      true,
    )
    expect(screen.queryByRole('button', { name: 'Aplicar preset Scrum' })).toBeNull()
    expect(screen.queryByRole('group', { name: 'Nível da equipe' })).toBeNull()
    expect(screen.getByText('Nível atual: Avançado')).toBeTruthy()
    expect(
      within(await rowOf('Sprints'))
        .getByRole('switch')
        .hasAttribute('disabled'),
    ).toBe(true)
  })
})

describe('Ferramentas da equipe: lista', () => {
  it('estimativas em pontos e plug-ins aparecem em breve, com interruptor desabilitado', async () => {
    setup({ view: viewOf({ active: ['core'] }) })
    const points = await rowOf('Estimativas em pontos')
    expect(within(points).getByText(/Em breve/)).toBeTruthy()
    expect(
      within(points)
        .getByRole('switch', { name: 'Ligar Estimativas em pontos' })
        .hasAttribute('disabled'),
    ).toBe(true)
    const plugins = await rowOf('Plug-ins')
    expect(
      within(plugins).getByRole('switch', { name: 'Ligar Plug-ins' }).hasAttribute('disabled'),
    ).toBe(true)
  })

  it('o Núcleo não tem interruptor: é sempre ativo', async () => {
    setup({ view: viewOf({ active: ['core'] }) })
    const core = await rowOf('Núcleo')
    expect(within(core).queryByRole('switch')).toBeNull()
    expect(within(core).getByText('Sempre ativa')).toBeTruthy()
  })
})

describe('Ferramentas da equipe: ligar e desligar com prévia', () => {
  it('ligar Sprints sem Backlog mostra a prévia com o que também será ativado e aplica', async () => {
    const user = userEvent.setup()
    const s = setup({
      view: viewOf({ active: ['core', 'agenda'] }),
      previewFor: (input) =>
        input.enable?.[0] === 'sprints'
          ? preview({ autoEnabled: ['backlog'], activated: ['backlog', 'sprints'] })
          : preview(),
    })
    s.applyChange.mockResolvedValue(
      resultOf(viewOf({ active: ['core', 'agenda', 'backlog', 'sprints'] }), {
        autoEnabled: ['backlog'],
      }),
    )
    await user.click(await screen.findByRole('switch', { name: 'Ligar Sprints' }))
    const dialog = await screen.findByRole('dialog', { name: 'Prévia de impacto' })
    expect(await within(dialog).findByText('Também será ativado: Backlog.')).toBeTruthy()
    await user.click(within(dialog).getByRole('button', { name: 'Confirmar' }))
    await waitFor(() => expect(s.applyChange).toHaveBeenCalledWith({ enable: ['sprints'] }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(screen.getByRole('status').textContent).toContain('Também foi ativado: Backlog.')
  })

  it('desligar Backlog com Sprints ativo recusa, lista quem depende e inclui os dependentes', async () => {
    const user = userEvent.setup()
    const s = setup({
      view: viewOf({ active: ['core', 'agenda', 'backlog', 'sprints'] }),
      previewFor: (input) => {
        const disable = input.disable
        if (disable?.length === 2) return preview({ windingDown: ['backlog', 'sprints'] })
        return preview({
          ok: false,
          message: 'Não dá para desligar Backlog: Sprints depende de Backlog.',
          blockedBy: ['backlog'],
          dependents: [{ module: 'backlog', requiredBy: ['sprints'] }],
        })
      },
    })
    await user.click(await screen.findByRole('switch', { name: 'Ligar Backlog' }))
    const dialog = await screen.findByRole('dialog', { name: 'Prévia de impacto' })
    expect(await within(dialog).findByText('Sprints depende de Backlog.')).toBeTruthy()
    expect(within(dialog).getByRole('button', { name: 'Confirmar' }).hasAttribute('disabled')).toBe(
      true,
    )
    await user.click(within(dialog).getByRole('button', { name: 'Incluir os dependentes' }))
    await waitFor(() =>
      expect(s.previewChange).toHaveBeenLastCalledWith({ disable: ['backlog', 'sprints'] }),
    )
    await user.click(await within(dialog).findByRole('button', { name: 'Confirmar' }))
    await waitFor(() =>
      expect(s.applyChange).toHaveBeenCalledWith({ disable: ['backlog', 'sprints'] }),
    )
  })

  it('desligar uma ferramenta com dados mostra as contagens e a leva a Encerrando', async () => {
    const user = userEvent.setup()
    const after = viewOf({ active: ['core', 'agenda'], winding: ['subtasks'] })
    const s = setup({
      view: viewOf({ active: ['core', 'agenda', 'subtasks'] }),
      previewFor: () =>
        preview({
          windingDown: ['subtasks'],
          impact: [
            {
              module: 'subtasks',
              count: 3,
              description: '3 subtarefas em tarefas não arquivadas',
            },
          ],
        }),
    })
    s.applyChange.mockResolvedValue(resultOf(after, { windingDown: ['subtasks'] }))
    s.get.mockResolvedValue(after)
    await user.click(await screen.findByRole('switch', { name: 'Ligar Subtarefas e dependências' }))
    const dialog = await screen.findByRole('dialog', { name: 'Prévia de impacto' })
    expect(await within(dialog).findByText('3 subtarefas em tarefas não arquivadas')).toBeTruthy()
    await user.click(within(dialog).getByRole('button', { name: 'Confirmar' }))
    await waitFor(() => expect(s.applyChange).toHaveBeenCalledWith({ disable: ['subtasks'] }))
    expect(
      await within(await rowOf('Subtarefas e dependências')).findByText('Encerrando'),
    ).toBeTruthy()
  })

  it('erro do servidor aparece e a tela continua de pé', async () => {
    const user = userEvent.setup()
    const s = setup({
      view: viewOf({ active: ['core', 'agenda'] }),
      previewFor: () => preview({ autoEnabled: ['backlog'], activated: ['backlog', 'sprints'] }),
    })
    s.applyChange.mockRejectedValue(new Error('falha de rede'))
    await user.click(await screen.findByRole('switch', { name: 'Ligar Sprints' }))
    const dialog = await screen.findByRole('dialog', { name: 'Prévia de impacto' })
    await user.click(await within(dialog).findByRole('button', { name: 'Confirmar' }))
    expect(await within(dialog).findByText('Não foi possível salvar a mudança.')).toBeTruthy()
    expect(screen.getByRole('heading', { name: /ferramentas ativas/ })).toBeTruthy()
  })
})

describe('Ferramentas da equipe: encerramento', () => {
  const winding = viewOf({ active: ['core', 'agenda'], winding: ['subtasks'] })

  it('mostra Reativar, Antecipar e Concluir no lugar do interruptor', async () => {
    setup({ view: winding })
    const row = await rowOf('Subtarefas e dependências')
    expect(within(row).queryByRole('switch')).toBeNull()
    expect(within(row).getByRole('button', { name: 'Reativar' })).toBeTruthy()
    expect(within(row).getByRole('button', { name: 'Antecipar encerramento' })).toBeTruthy()
    expect(within(row).getByRole('button', { name: 'Concluir encerramento' })).toBeTruthy()
  })

  it('antecipar pede confirmação curta e chama applyChange com finalize', async () => {
    const user = userEvent.setup()
    const s = setup({ view: winding })
    const row = await rowOf('Subtarefas e dependências')
    await user.click(within(row).getByRole('button', { name: 'Antecipar encerramento' }))
    const confirm = within(row).getByRole('group')
    await user.click(within(confirm).getByRole('button', { name: 'Confirmar' }))
    await waitFor(() =>
      expect(s.applyChange).toHaveBeenCalledWith({
        disable: ['subtasks'],
        finalize: ['subtasks'],
      }),
    )
  })

  it('concluir pede confirmação curta e chama completeWindDown', async () => {
    const user = userEvent.setup()
    const s = setup({ view: winding })
    const row = await rowOf('Subtarefas e dependências')
    await user.click(within(row).getByRole('button', { name: 'Concluir encerramento' }))
    await user.click(
      within(within(row).getByRole('group')).getByRole('button', { name: 'Confirmar' }),
    )
    await waitFor(() => expect(s.completeWindDown).toHaveBeenCalledWith({ moduleId: 'subtasks' }))
  })

  it('reativar passa pela prévia e liga a ferramenta de volta', async () => {
    const user = userEvent.setup()
    const s = setup({
      view: winding,
      previewFor: () => preview(),
    })
    const row = await rowOf('Subtarefas e dependências')
    await user.click(within(row).getByRole('button', { name: 'Reativar' }))
    const dialog = await screen.findByRole('dialog', { name: 'Prévia de impacto' })
    await user.click(await within(dialog).findByRole('button', { name: 'Confirmar' }))
    await waitFor(() => expect(s.applyChange).toHaveBeenCalledWith({ enable: ['subtasks'] }))
  })
})

describe('Ferramentas da equipe: presets e nível', () => {
  it('aplicar preset abre a prévia; sem o nível sugerido, a aplicação não sobe o nível', async () => {
    const user = userEvent.setup()
    const s = setup({ view: viewOf({ active: ['core', 'agenda'] }) })
    await user.click(await screen.findByRole('button', { name: 'Aplicar preset Scrum' }))
    const dialog = await screen.findByRole('dialog', { name: 'Aplicar o preset Scrum' })
    const checkbox = within(dialog).getByRole('checkbox', {
      name: 'Aplicar também o nível sugerido (Intermediário)',
    })
    expect((checkbox as HTMLInputElement).checked).toBe(false)
    expect(s.applyPreset).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole('button', { name: 'Confirmar' }))
    await waitFor(() =>
      expect(s.applyPreset).toHaveBeenCalledWith({ presetId: 'scrum', applySuggestedLevel: false }),
    )
  })

  it('com o nível sugerido marcado, o preset também sobe o nível', async () => {
    const user = userEvent.setup()
    const s = setup({ view: viewOf({ active: ['core', 'agenda'] }) })
    await user.click(await screen.findByRole('button', { name: 'Aplicar preset Scrum' }))
    const dialog = await screen.findByRole('dialog', { name: 'Aplicar o preset Scrum' })
    await user.click(
      within(dialog).getByRole('checkbox', {
        name: 'Aplicar também o nível sugerido (Intermediário)',
      }),
    )
    await user.click(within(dialog).getByRole('button', { name: 'Confirmar' }))
    await waitFor(() =>
      expect(s.applyPreset).toHaveBeenCalledWith({ presetId: 'scrum', applySuggestedLevel: true }),
    )
  })

  it('aviso de nível oferece subir até o nível exigido e mostra o resultado', async () => {
    const user = userEvent.setup()
    const s = setup({
      view: viewOf({
        active: ['core', 'agenda', 'sprints', 'backlog'],
        level: 'basic',
        levelWarnings: [{ module: 'sprints', label: 'Sprints', requiredLevel: 'intermediate' }],
      }),
    })
    expect(
      await screen.findByText(
        'Sprints aparece a partir do Intermediário. Subir o nível da equipe?',
      ),
    ).toBeTruthy()
    s.setLevel.mockResolvedValue(
      resultOf(viewOf({ active: ['core', 'agenda', 'sprints', 'backlog'], level: 'intermediate' })),
    )
    await user.click(screen.getByRole('button', { name: 'Subir para Intermediário' }))
    await waitFor(() => expect(s.setLevel).toHaveBeenCalledWith({ level: 'intermediate' }))
    expect(await screen.findByText('Nível da equipe: Intermediário.')).toBeTruthy()
  })
})

describe('Ferramentas da equipe: consultas e erros', () => {
  it('depois de aplicar um preset invalida ferramentas, quadro, dashboard e agenda', async () => {
    const user = userEvent.setup()
    const s = setup({ view: viewOf({ active: ['core', 'agenda'] }) })
    await user.click(await screen.findByRole('button', { name: 'Aplicar preset Kanban simples' }))
    const dialog = await screen.findByRole('dialog', { name: 'Aplicar o preset Kanban simples' })
    await user.click(within(dialog).getByRole('button', { name: 'Confirmar' }))
    await waitFor(() => expect(s.applyPreset).toHaveBeenCalled())
    const keys = s.invalidate.mock.calls.map((call) => call[0]?.queryKey)
    expect(keys).toEqual(
      expect.arrayContaining([
        queryKeys.teamTools.all,
        queryKeys.tasks.all,
        queryKeys.dashboard.all,
        queryKeys.meetings.all,
      ]),
    )
  })

  it('erro ao carregar mostra alerta com nova tentativa, sem quebrar a página', async () => {
    const api = createFakeApi()
    vi.spyOn(api.teamTools, 'get').mockRejectedValue(new ApiError('FORBIDDEN', 'não'))
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <ApiProvider api={api}>
        <QueryClientProvider client={queryClient}>
          <TeamToolsSection />
        </QueryClientProvider>
      </ApiProvider>,
    )
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeTruthy()
  })
})
