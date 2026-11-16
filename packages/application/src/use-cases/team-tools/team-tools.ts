import {
  canManageTeamTools,
  effectiveCapabilities,
  getModule,
  MODULE_IDS,
  MODULE_LABELS,
  moduleImpact,
  moduleLevelWarning,
  moduleStateOf,
  parseDateOnly,
  PermissionDeniedError,
  planCompleteWindDown,
  planModuleChange,
  planPreset,
  TEAM_PRESETS,
  toActiveModuleIds,
  toModuleId,
  ValidationError,
} from '@agilebox/core'
import type {
  Actor,
  ExperienceLevel,
  ModuleChangePlan,
  ModuleChangeRequest,
  OrganizationId,
  TeamPresetId,
  TeamToolsSettings,
  TeamToolsUsage,
} from '@agilebox/core'
import type {
  ApplyTeamPresetInput,
  CompleteTeamWindDownInput,
  PreviewTeamToolsChangeInput,
  SetTeamLevelInput,
  TeamToolsChangeInput,
  TeamToolsChangeResultDto,
  TeamToolsImpactDto,
  TeamToolsPreviewDto,
  TeamToolsViewDto,
} from '@agilebox/contract'
import type { AppDeps } from '../../deps'

/** Intervalo que cobre qualquer agendamento, para contar a agenda inteira. */
const ALL_DATES_START = parseDateOnly('1900-01-01')
const ALL_DATES_END = parseDateOnly('2999-12-31')

function requireManager(actor: Actor): void {
  if (!canManageTeamTools(actor))
    throw new PermissionDeniedError('Só o gestor pode mudar as ferramentas da equipe')
}

/** Visão para a interface: o que existe, aparece e é permitido para quem pede. */
function toView(actor: Actor, settings: TeamToolsSettings): TeamToolsViewDto {
  const existing = toActiveModuleIds(settings.modules)
  return {
    level: settings.level,
    modules: MODULE_IDS.map((id) => ({
      id,
      label: MODULE_LABELS[id],
      state: moduleStateOf(settings.modules, id),
      minLevel: getModule(id).minLevel,
    })),
    presets: TEAM_PRESETS.map((preset) => ({
      id: preset.id,
      label: preset.label,
      modules: [...preset.modules],
      suggestedLevel: preset.suggestedLevel,
    })),
    // O nível usado é o da equipe: o nível de cada pessoa ainda não existe no modelo.
    capabilities: effectiveCapabilities({
      modules: existing,
      level: settings.level,
      role: actor.role,
    }),
    levelWarnings: moduleLevelWarning({ modules: existing, level: settings.level }).map(
      (warning) => ({
        module: warning.module,
        label: MODULE_LABELS[warning.module],
        requiredLevel: warning.requiredLevel,
      }),
    ),
    canManage: canManageTeamTools(actor),
  }
}

/** Contagens do que já está gravado, pelo que as portas atuais conseguem ler. */
async function countUsage(deps: AppDeps, organizationId: OrganizationId): Promise<TeamToolsUsage> {
  const tasks = (await deps.tasks.listBoard(organizationId, {})).filter(
    (task) => task.archivedAt === null,
  )
  const items = await deps.checklist.listByTasks(
    organizationId,
    tasks.map((task) => task.id),
  )
  const board = await deps.boardSettings.findByOrganization(organizationId)
  const meetings = await deps.meetings.listOverlapping(
    organizationId,
    ALL_DATES_START,
    ALL_DATES_END,
  )
  const actions =
    meetings.length === 0
      ? []
      : await deps.retroActions.listByMeetings(
          organizationId,
          meetings.map((meeting) => meeting.id),
        )
  const wipLimits = [board?.wipLimits.in_progress, board?.wipLimits.review]
  return {
    subtasks: items.length,
    blockedTasks: tasks.filter((task) => task.blockedReason !== null).length,
    wipLimits: wipLimits.filter((limit) => limit !== undefined).length,
    retroActions: actions.length,
    checkins: await deps.dailyEntries.countByOrganization(organizationId),
    meetings: meetings.length,
  }
}

function changeRequestFrom(input: TeamToolsChangeInput): ModuleChangeRequest {
  return {
    enable: (input.enable ?? []).map((id) => toModuleId(id)),
    disable: (input.disable ?? []).map((id) => toModuleId(id)),
    finalize: (input.finalize ?? []).map((id) => toModuleId(id)),
  }
}

/** O que muda na gravação: o plano das ferramentas, e opcionalmente o nível e o preset. */
interface PlannedChange {
  readonly plan: ModuleChangePlan
  readonly level?: ExperienceLevel
  readonly preset?: TeamPresetId
}

/**
 * Lê, planeja e grava na mesma transação. Pedido inválido é recusado com `ValidationError` antes de
 * qualquer escrita. A gravação acrescenta a auditoria com o ator (`saveSettings`).
 */
async function saveChange(
  deps: AppDeps,
  actor: Actor,
  planFor: (settings: TeamToolsSettings) => PlannedChange,
): Promise<TeamToolsChangeResultDto> {
  const organizationId = actor.organizationId
  const now = await deps.clock.now(organizationId)
  return deps.unitOfWork.run(organizationId, async (repositories) => {
    const settings = await repositories.teamTools.getSettings(organizationId)
    const planned = planFor(settings)
    if (!planned.plan.ok) throw new ValidationError(planned.plan.message)

    await repositories.teamTools.saveSettings(
      organizationId,
      {
        level: planned.level ?? settings.level,
        modules: planned.plan.updates,
        ...(planned.preset !== undefined ? { preset: planned.preset } : {}),
      },
      actor.userId,
      now,
    )
    const saved = await repositories.teamTools.getSettings(organizationId)
    await deps.changeNotifier.publish(organizationId, { kind: 'board', ids: [] })
    return {
      view: toView(actor, saved),
      autoEnabled: [...planned.plan.autoEnabled],
      windingDown: [...planned.plan.windingDown],
      disabled: [...planned.plan.disabled],
    }
  })
}

/** Lê a equipe, as ferramentas e o que o ator pode fazer com elas. Qualquer membro lê. */
export class GetTeamTools {
  constructor(private readonly deps: AppDeps) {}

  async execute(actor: Actor): Promise<TeamToolsViewDto> {
    const settings = await this.deps.teamTools.getSettings(actor.organizationId)
    return toView(actor, settings)
  }
}

/**
 * Prévia de uma mudança (só o gestor). Roda o resolvedor e conta o que depende de cada ferramenta
 * que seria desligada. Não grava nada.
 */
export class PreviewTeamToolsChange {
  constructor(private readonly deps: AppDeps) {}

  async execute(actor: Actor, input: PreviewTeamToolsChangeInput): Promise<TeamToolsPreviewDto> {
    requireManager(actor)
    const settings = await this.deps.teamTools.getSettings(actor.organizationId)
    const request =
      input.presetId !== undefined
        ? planPreset(settings, input.presetId).request
        : changeRequestFrom(input)
    const plan = planModuleChange(settings, request)
    const usage = await countUsage(this.deps, actor.organizationId)
    const impact: TeamToolsImpactDto[] = (request.disable ?? [])
      .filter((id) => moduleStateOf(settings.modules, id) !== 'disabled')
      .map((id) => moduleImpact(id, usage))

    if (!plan.ok) {
      return {
        ok: false,
        message: plan.message,
        autoEnabled: [],
        activated: [],
        windingDown: [],
        disabled: [],
        conflicts: plan.conflicts.map(([a, b]) => [a, b]),
        blockedBy: [...plan.blockedBy],
        dependents: plan.dependents.map((item) => ({
          module: item.module,
          requiredBy: [...item.requiredBy],
        })),
        impact,
      }
    }
    return {
      ok: true,
      message: null,
      autoEnabled: [...plan.autoEnabled],
      activated: [...plan.activated],
      windingDown: [...plan.windingDown],
      disabled: [...plan.disabled],
      conflicts: [],
      blockedBy: [],
      dependents: [],
      impact,
    }
  }
}

/** Aplica a mudança do gestor: ligar é imediato; desligar entra em encerramento (ou desliga, se pedido). */
export class ApplyTeamToolsChange {
  constructor(private readonly deps: AppDeps) {}

  async execute(actor: Actor, input: TeamToolsChangeInput): Promise<TeamToolsChangeResultDto> {
    requireManager(actor)
    const request = changeRequestFrom(input)
    return saveChange(this.deps, actor, (settings) => ({
      plan: planModuleChange(settings, request),
    }))
  }
}

/** Encerramento concluído pelo gestor: `winding_down` vira `disabled`. */
export class CompleteTeamWindDown {
  constructor(private readonly deps: AppDeps) {}

  async execute(actor: Actor, input: CompleteTeamWindDownInput): Promise<TeamToolsChangeResultDto> {
    requireManager(actor)
    const moduleId = toModuleId(input.moduleId)
    return saveChange(this.deps, actor, (settings) => {
      const updates = planCompleteWindDown(settings, moduleId)
      return {
        plan: {
          ok: true,
          updates,
          autoEnabled: [],
          activated: [],
          windingDown: [],
          disabled: [moduleId],
        },
      }
    })
  }
}

/** Muda o nível da equipe (ADR-06). Auditado. */
export class SetTeamLevel {
  constructor(private readonly deps: AppDeps) {}

  async execute(actor: Actor, input: SetTeamLevelInput): Promise<TeamToolsChangeResultDto> {
    requireManager(actor)
    return saveChange(this.deps, actor, () => ({
      level: input.level,
      plan: {
        ok: true,
        updates: [],
        autoEnabled: [],
        activated: [],
        windingDown: [],
        disabled: [],
      },
    }))
  }
}

/**
 * Aplica um preset (só o gestor): liga as ferramentas dele e encerra as que saem. O nível sugerido
 * só entra se o gestor pedir. Auditado como `preset`.
 */
export class ApplyTeamPreset {
  constructor(private readonly deps: AppDeps) {}

  async execute(actor: Actor, input: ApplyTeamPresetInput): Promise<TeamToolsChangeResultDto> {
    requireManager(actor)
    return saveChange(this.deps, actor, (settings) => {
      const { request, suggestedLevel } = planPreset(settings, input.presetId)
      return {
        plan: planModuleChange(settings, request),
        preset: input.presetId,
        level: input.applySuggestedLevel === true ? suggestedLevel : settings.level,
      }
    })
  }
}
