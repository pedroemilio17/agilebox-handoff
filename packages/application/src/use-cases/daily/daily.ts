import {
  assertDailyDateNotFuture,
  canReadDaily,
  canSeeDailyOverview,
  canWriteDaily,
  createDailyEntry,
  isDailyDue,
  NotFoundError,
  participates,
  parseDateOnly,
  PermissionDeniedError,
  toDateOnly,
  toDailyEntryId,
  toTaskId,
  toUserId,
} from '@agilebox/core'
import type { Actor, DailyEntry, DateOnly, OrganizationId, UserId } from '@agilebox/core'
import type {
  DailyAnswersDto,
  DailyEntryDto,
  DailyStatusDto,
  DailyTodayDto,
} from '@agilebox/contract'
import { toDailyEntryDto } from '../../mappers'
import type { AppDeps } from '../../deps'

export interface SaveDailyInput {
  readonly date: string
  /** Opcional: se vier, tem que ser a própria pessoa. */
  readonly userId?: string | undefined
  readonly answers: DailyAnswersDto
  readonly noNews?: boolean | undefined
  readonly taskRefs?: readonly string[] | undefined
}
export interface GetTodayDailyInput {
  readonly date: string
}
export interface ListDailyForDateInput {
  readonly date: string
}
export interface GetDailyForUserInput {
  readonly userId: string
  readonly date: string
}

/** Hoje segundo o servidor, no fuso do processo (mesma regra do dashboard). */
async function currentDate(deps: AppDeps, organizationId: OrganizationId): Promise<DateOnly> {
  const now = await deps.clock.now(organizationId)
  return toDateOnly(new Date(now), Intl.DateTimeFormat().resolvedOptions().timeZone)
}

async function nameOf(deps: AppDeps, organizationId: OrganizationId, userId: UserId) {
  const user = await deps.users.findById(organizationId, userId)
  if (!user) throw new NotFoundError('Pessoa não encontrada')
  return user.name
}

/** Lê a data do cliente e recusa data futura. Datas passadas valem para leitura. */
async function readDate(deps: AppDeps, actor: Actor, rawDate: string): Promise<DateOnly> {
  const date = parseDateOnly(rawDate)
  assertDailyDateNotFuture(date, await currentDate(deps, actor.organizationId))
  return date
}

function requireOverview(actor: Actor): void {
  if (!canSeeDailyOverview(actor, actor.organizationId))
    throw new PermissionDeniedError('Somente o gestor vê as dailies do time')
}

/** Citar tarefa: só tarefa da organização de que o próprio ator participa. */
async function resolveTaskRefs(deps: AppDeps, actor: Actor, rawTaskRefs: readonly string[]) {
  const unique = [...new Set(rawTaskRefs)].map((raw) => toTaskId(raw))
  for (const taskId of unique) {
    const task = await deps.tasks.findById(actor.organizationId, taskId)
    if (!task) throw new NotFoundError('Tarefa não encontrada')
    if (!participates(actor, task))
      throw new PermissionDeniedError('Só é possível citar tarefas de que você participa')
  }
  return unique
}

export class GetTodayDaily {
  constructor(private readonly deps: AppDeps) {}

  /** A daily do próprio ator na data, e se ela ainda é devida. Nada é gravado. */
  async execute(actor: Actor, input: GetTodayDailyInput): Promise<DailyTodayDto> {
    const date = await readDate(this.deps, actor, input.date)
    const entry = await this.deps.dailyEntries.findByUserAndDate(
      actor.organizationId,
      actor.userId,
      date,
    )
    return {
      date,
      due: isDailyDue(entry ? [entry] : [], date),
      entry: entry
        ? toDailyEntryDto(entry, await nameOf(this.deps, actor.organizationId, actor.userId))
        : null,
    }
  }
}

export class SaveDaily {
  constructor(private readonly deps: AppDeps) {}

  /**
   * Cria ou atualiza a daily do dia. Só a própria pessoa, e só no dia de hoje: data
   * passada é PermissionDenied, data futura é ValidationError. Não altera as tarefas citadas.
   * Não gera aviso nem notificação.
   */
  async execute(actor: Actor, input: SaveDailyInput): Promise<DailyEntryDto> {
    if (input.userId !== undefined && toUserId(input.userId) !== actor.userId)
      throw new PermissionDeniedError('Só a própria pessoa preenche a sua daily')
    const date = parseDateOnly(input.date)
    const today = await currentDate(this.deps, actor.organizationId)
    assertDailyDateNotFuture(date, today)
    if (!canWriteDaily(actor, actor.userId, date, today))
      throw new PermissionDeniedError('A daily só pode ser preenchida no dia de hoje')

    const taskRefs = await resolveTaskRefs(this.deps, actor, input.taskRefs ?? [])
    const existing = await this.deps.dailyEntries.findByUserAndDate(
      actor.organizationId,
      actor.userId,
      date,
    )
    const now = await this.deps.clock.now(actor.organizationId)
    const entry = createDailyEntry({
      id:
        existing?.id ?? toDailyEntryId(await this.deps.idGenerator.generate(actor.organizationId)),
      organizationId: actor.organizationId,
      userId: actor.userId,
      date,
      answers: input.answers,
      noNews: input.noNews ?? false,
      taskRefs,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    })
    await this.deps.unitOfWork.run(actor.organizationId, async ({ dailyEntries }) => {
      await dailyEntries.save(actor.organizationId, entry)
    })
    return toDailyEntryDto(entry, await nameOf(this.deps, actor.organizationId, actor.userId))
  }
}

export class ListDailyForDate {
  constructor(private readonly deps: AppDeps) {}

  /** Uma linha por pessoa da organização, com `done` quando há daily na data. Só o gestor. */
  async execute(actor: Actor, input: ListDailyForDateInput): Promise<DailyStatusDto[]> {
    requireOverview(actor)
    const date = await readDate(this.deps, actor, input.date)
    const [users, entries] = await Promise.all([
      this.deps.users.list(actor.organizationId),
      this.deps.dailyEntries.listByDate(actor.organizationId, date),
    ])
    const done = new Set(entries.map((entry) => entry.userId))
    return users.map((user) => ({
      userId: user.id,
      userName: user.name,
      done: done.has(user.id),
    }))
  }
}

export class GetDailyForUser {
  constructor(private readonly deps: AppDeps) {}

  /** Leitura de uma daily por pessoa, só para o gestor. Entidades não existem aqui (não são usuários). */
  async execute(actor: Actor, input: GetDailyForUserInput): Promise<DailyEntryDto | null> {
    requireOverview(actor)
    const target = await this.deps.users.findById(actor.organizationId, toUserId(input.userId))
    if (!target) throw new NotFoundError('Pessoa não encontrada')
    const date = await readDate(this.deps, actor, input.date)
    const entry: DailyEntry | null = await this.deps.dailyEntries.findByUserAndDate(
      actor.organizationId,
      target.id,
      date,
    )
    if (!entry) return null
    if (!canReadDaily(actor, entry)) throw new PermissionDeniedError('Sem acesso a esta daily')
    return toDailyEntryDto(entry, target.name)
  }
}
