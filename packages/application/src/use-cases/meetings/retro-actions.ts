import {
  addRetroAction,
  assertRetroOccurrence,
  canManageRetroActions,
  canSeeMeeting,
  canToggleRetroAction,
  changeRetroActionDueDate,
  changeRetroActionResponsible,
  isRetroOccurrence,
  NotFoundError,
  PermissionDeniedError,
  parseDateOnly,
  renameRetroAction,
  setRetroActionDone,
  toMeetingId,
  toRetroActionId,
  toUserId,
  ValidationError,
} from '@agilebox/core'
import type {
  Actor,
  DateOnly,
  Meeting,
  OrganizationId,
  RetroAction,
  RetroActionId,
  UserId,
} from '@agilebox/core'
import type { RetroActionDto } from '@agilebox/contract'
import { toRetroActionDto } from '../../mappers'
import type { AppDeps } from '../../deps'

export interface ListRetroActionsInput {
  readonly meetingId: string
  readonly occurrenceDate: string
}
export interface AddRetroActionInput {
  readonly meetingId: string
  readonly occurrenceDate: string
  readonly title: string
  readonly responsibleId?: string | null | undefined
  readonly dueDate?: string | null | undefined
}
export interface UpdateRetroActionInput {
  readonly actionId: string
  readonly changes: {
    readonly title?: string | undefined
    readonly responsibleId?: string | null | undefined
    readonly dueDate?: string | null | undefined
  }
}
export interface ToggleRetroActionInput {
  readonly actionId: string
  readonly done: boolean
}
export interface RemoveRetroActionInput {
  readonly actionId: string
}

function requireManager(actor: Actor): void {
  if (actor.role !== 'manager')
    throw new PermissionDeniedError('Só o gestor cria, edita e remove combinados')
}

function optionalDate(value: string | null | undefined): DateOnly | null {
  return value ? parseDateOnly(value) : null
}

/**
 * Responsável precisa ser um usuário da organização. Entidades (stakeholders) não
 * recebem combinados: elas não têm conta, então não são encontradas aqui.
 */
async function resolveResponsible(
  deps: AppDeps,
  organizationId: OrganizationId,
  responsibleId: string | null | undefined,
): Promise<UserId | null> {
  if (!responsibleId) return null
  const userId = toUserId(responsibleId)
  const user = await deps.users.findById(organizationId, userId)
  if (!user) throw new ValidationError('Responsável precisa ser um usuário desta organização')
  return userId
}

async function toDtos(
  deps: AppDeps,
  actor: Actor,
  actions: readonly RetroAction[],
): Promise<RetroActionDto[]> {
  const users = await deps.users.list(actor.organizationId)
  const names = new Map(users.map((user) => [user.id, user.name]))
  return actions.map((action) =>
    toRetroActionDto(
      action,
      actor,
      action.responsibleId === null ? null : (names.get(action.responsibleId) ?? null),
    ),
  )
}

/** Carrega o agendamento visível ao ator, ou falha com NotFound. */
async function loadVisibleMeeting(
  deps: AppDeps,
  actor: Actor,
  rawMeetingId: string,
): Promise<Meeting> {
  const meeting = await deps.meetings.findById(actor.organizationId, toMeetingId(rawMeetingId))
  if (!meeting || !canSeeMeeting(actor, meeting))
    throw new NotFoundError('Agendamento não encontrado')
  return meeting
}

/**
 * Carrega um combinado cuja ocorrência ainda existe. Combinados de datas que
 * deixaram de ser ocorrências (série alterada) não são acessíveis: viram NotFound.
 */
async function loadAction(
  deps: AppDeps,
  actor: Actor,
  rawActionId: string,
): Promise<{ readonly action: RetroAction; readonly meeting: Meeting }> {
  const actionId: RetroActionId = toRetroActionId(rawActionId)
  const action = await deps.retroActions.findById(actor.organizationId, actionId)
  if (!action) throw new NotFoundError('Combinado não encontrado')
  const meeting = await deps.meetings.findById(actor.organizationId, action.meetingId)
  if (
    !meeting ||
    !canSeeMeeting(actor, meeting) ||
    !isRetroOccurrence(meeting, action.occurrenceDate)
  )
    throw new NotFoundError('Combinado não encontrado')
  return { action, meeting }
}

export class ListRetroActions {
  constructor(private readonly deps: AppDeps) {}

  /** Qualquer usuário que vê o agendamento vê os combinados. Ocorrência inválida ou tipo não-Retro: lista vazia. */
  async execute(actor: Actor, input: ListRetroActionsInput): Promise<readonly RetroActionDto[]> {
    const meeting = await loadVisibleMeeting(this.deps, actor, input.meetingId)
    const occurrenceDate = parseDateOnly(input.occurrenceDate)
    if (!isRetroOccurrence(meeting, occurrenceDate)) return []
    const actions = await this.deps.retroActions.listByOccurrence(
      actor.organizationId,
      meeting.id,
      occurrenceDate,
    )
    return toDtos(this.deps, actor, actions)
  }
}

export class AddRetroAction {
  constructor(private readonly deps: AppDeps) {}

  async execute(actor: Actor, input: AddRetroActionInput): Promise<RetroActionDto> {
    requireManager(actor)
    const meeting = await loadVisibleMeeting(this.deps, actor, input.meetingId)
    if (!canManageRetroActions(actor, meeting))
      throw new PermissionDeniedError('Só o gestor cria, edita e remove combinados')
    const occurrenceDate = parseDateOnly(input.occurrenceDate)
    assertRetroOccurrence(meeting, occurrenceDate)
    const responsibleId = await resolveResponsible(
      this.deps,
      actor.organizationId,
      input.responsibleId,
    )
    const existing = await this.deps.retroActions.listByOccurrence(
      actor.organizationId,
      meeting.id,
      occurrenceDate,
    )
    const action = addRetroAction(meeting, existing, {
      id: toRetroActionId(await this.deps.idGenerator.generate(actor.organizationId)),
      occurrenceDate,
      title: input.title,
      responsibleId,
      dueDate: optionalDate(input.dueDate),
      createdBy: actor.userId,
      createdAt: await this.deps.clock.now(actor.organizationId),
    })
    await this.deps.unitOfWork.run(actor.organizationId, async ({ retroActions }) => {
      await retroActions.save(actor.organizationId, action)
    })
    await this.deps.changeNotifier.publish(actor.organizationId, {
      kind: 'meeting',
      ids: [meeting.id],
    })
    const [dto] = await toDtos(this.deps, actor, [action])
    return dto!
  }
}

export class UpdateRetroAction {
  constructor(private readonly deps: AppDeps) {}

  /** Título, responsável e prazo. Só o gestor. */
  async execute(actor: Actor, input: UpdateRetroActionInput): Promise<RetroActionDto> {
    requireManager(actor)
    const { action: existing, meeting } = await loadAction(this.deps, actor, input.actionId)
    if (!canManageRetroActions(actor, meeting))
      throw new PermissionDeniedError('Só o gestor cria, edita e remove combinados')
    const { changes } = input
    let action = existing
    if (changes.title !== undefined) action = renameRetroAction(action, changes.title)
    if (changes.responsibleId !== undefined)
      action = changeRetroActionResponsible(
        action,
        await resolveResponsible(this.deps, actor.organizationId, changes.responsibleId),
      )
    if (changes.dueDate !== undefined)
      action = changeRetroActionDueDate(action, changes.dueDate ?? null)
    await this.deps.unitOfWork.run(actor.organizationId, async ({ retroActions }) => {
      await retroActions.save(actor.organizationId, action)
    })
    await this.deps.changeNotifier.publish(actor.organizationId, {
      kind: 'meeting',
      ids: [meeting.id],
    })
    const [dto] = await toDtos(this.deps, actor, [action])
    return dto!
  }
}

export class ToggleRetroAction {
  constructor(private readonly deps: AppDeps) {}

  /** Marcar como feito: o gestor ou o responsável pelo combinado. */
  async execute(actor: Actor, input: ToggleRetroActionInput): Promise<RetroActionDto> {
    const { action: existing, meeting } = await loadAction(this.deps, actor, input.actionId)
    if (!canToggleRetroAction(actor, existing))
      throw new PermissionDeniedError('Só o gestor ou o responsável marca o combinado como feito')
    const action = setRetroActionDone(
      existing,
      input.done,
      await this.deps.clock.now(actor.organizationId),
    )
    if (action !== existing) {
      await this.deps.unitOfWork.run(actor.organizationId, async ({ retroActions }) => {
        await retroActions.save(actor.organizationId, action)
      })
      await this.deps.changeNotifier.publish(actor.organizationId, {
        kind: 'meeting',
        ids: [meeting.id],
      })
    }
    const [dto] = await toDtos(this.deps, actor, [action])
    return dto!
  }
}

export class RemoveRetroAction {
  constructor(private readonly deps: AppDeps) {}

  async execute(actor: Actor, input: RemoveRetroActionInput): Promise<void> {
    requireManager(actor)
    const { action, meeting } = await loadAction(this.deps, actor, input.actionId)
    if (!canManageRetroActions(actor, meeting))
      throw new PermissionDeniedError('Só o gestor cria, edita e remove combinados')
    await this.deps.unitOfWork.run(actor.organizationId, async ({ retroActions }) => {
      await retroActions.remove(actor.organizationId, action.id)
    })
    await this.deps.changeNotifier.publish(actor.organizationId, {
      kind: 'meeting',
      ids: [meeting.id],
    })
  }
}
