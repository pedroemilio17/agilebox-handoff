import {
  baselineSummary,
  canSeeProject,
  canSeeTaskTotal,
  ConflictError,
  hasPlanDates,
  isInComparison,
  isManagerEdit,
  moduleStateOf,
  normalizeBaselineName,
  NotFoundError,
  PermissionDeniedError,
  planOf,
  taskDeviation,
  toBaselineId,
  toDateOnly,
  toProjectId,
} from '@agilebox/core'
import type {
  Actor,
  Baseline,
  BaselineTask,
  DateOnly,
  Project,
  ProjectId,
  OrganizationId,
  TaskDeviation,
  UserId,
} from '@agilebox/core'
import type { BaselineTaskDto, BaselineViewDto } from '@agilebox/contract'
import type { AppDeps } from '../../deps'

const VIEW_DENIED = 'Sem acesso a este projeto'
const TAKE_DENIED = 'Só o gestor tira a linha de base'
const ARCHIVED =
  'Projeto arquivado não aceita nova linha de base. Desarquive o projeto para tirar uma foto.'

/** Valor em centavos vira reais, só para quem pode ver. Sem permissão, nulo. */
function money(cents: number | null, visible: boolean): number | null {
  return visible && cents !== null ? cents / 100 : null
}

/** Horas em centésimos viram horas. Diferença nula continua nula. */
function hours(hundredths: number | null): number | null {
  return hundredths === null ? null : hundredths / 100
}

/** "2026-11-18" vira "18/11/2026", o formato do nome automático da foto. */
function brDate(day: DateOnly): string {
  const [year, month, date] = day.split('-')
  return `${date}/${month}/${year}`
}

/** Um par da comparação: a linha da foto (ou nada, se a tarefa é nova) e o plano atual (ou nada, se saiu). */
interface Pair {
  readonly planned: BaselineTask | null
  readonly current: BaselineTask | null
}

/** Pares da foto com o estado atual, pelo id da tarefa. Tarefa atual que não estava na foto é nova. */
function pairsOf(planned: readonly BaselineTask[], current: readonly BaselineTask[]): Pair[] {
  const currentById = new Map(current.map((item) => [item.taskId, item]))
  const plannedIds = new Set(planned.map((item) => item.taskId))
  return [
    ...planned.map((item) => ({ planned: item, current: currentById.get(item.taskId) ?? null })),
    ...current
      .filter((item) => !plannedIds.has(item.taskId))
      .map((item) => ({ planned: null, current: item })),
  ]
}

function rowOf(pair: Pair, deviation: TaskDeviation, seesMoney: boolean): BaselineTaskDto {
  return {
    taskId: deviation.taskId,
    title: deviation.title,
    status: deviation.status,
    delayDays: deviation.delayDays,
    startDelayDays: deviation.startDelayDays,
    endDelayDays: deviation.endDelayDays,
    plannedStartsOn: pair.planned?.startsOn ?? null,
    plannedEndsOn: pair.planned?.endsOn ?? null,
    currentStartsOn: pair.current?.startsOn ?? null,
    currentEndsOn: pair.current?.endsOn ?? null,
    hoursDelta: hours(deviation.hoursDeltaHundredths),
    costDelta: money(deviation.costDeltaCents, seesMoney),
  }
}

/** Projeto acessível para escrita da foto: o gestor, e o projeto não arquivado. */
function assertTakeable(actor: Actor, project: Project): void {
  if (!isManagerEdit(actor)) throw new PermissionDeniedError(TAKE_DENIED)
  if (project.archivedAt !== null) throw new ConflictError(ARCHIVED)
}

async function projectOrThrow(
  deps: Pick<AppDeps, 'projects'>,
  organizationId: OrganizationId,
  projectId: ProjectId,
): Promise<Project> {
  const project = await deps.projects.findById(organizationId, projectId)
  if (!project) throw new NotFoundError('Projeto não encontrado')
  return project
}

/**
 * Linha de base do projeto (ADR-10, módulo `baseline`): a foto mais recente, com o desvio de cada
 * tarefa e o resumo. Quem vê o projeto lê. Custo só para o gestor e só com o módulo `cost` ligado.
 */
export class GetBaseline {
  constructor(private readonly deps: AppDeps) {}

  async execute(actor: Actor, input: { readonly projectId: string }): Promise<BaselineViewDto> {
    const organizationId = actor.organizationId
    const projectId = toProjectId(input.projectId)
    const project = await projectOrThrow(this.deps, organizationId, projectId)
    const members = await this.deps.projects.listMembers(organizationId, projectId)
    if (
      !canSeeProject(
        actor,
        project,
        members.some((item) => item.userId === actor.userId),
      )
    )
      throw new PermissionDeniedError(VIEW_DENIED)

    const [allTasks, modules, users, latest] = await Promise.all([
      this.deps.tasks.listByProject(organizationId, projectId),
      this.deps.projectModules.list(organizationId, projectId),
      this.deps.users.list(organizationId),
      this.deps.baselines.findLatestByProject(organizationId, projectId),
    ])
    const costEnabled = moduleStateOf(modules, 'cost') !== 'disabled'
    const seesMoney = costEnabled && canSeeTaskTotal(actor, organizationId)
    const canTake = isManagerEdit(actor) && project.archivedAt === null
    if (latest === null) {
      return {
        projectId,
        canTake,
        costEnabled,
        costVisible: seesMoney,
        baseline: null,
        summary: null,
        tasks: [],
      }
    }

    const rates = new Map<UserId, number>(users.map((user) => [user.id, user.defaultRateCents]))
    const rateOf = (userId: UserId) => rates.get(userId) ?? 0
    const plannedIds = new Set(latest.tasks.map((item) => item.taskId))
    const current = allTasks
      .filter(
        (task) => task.archivedAt === null && isInComparison(task, plannedIds, latest.takenAt),
      )
      .map((task) => planOf(task, rateOf, costEnabled))
    const summary = baselineSummary(latest.tasks, current)
    const takenBy = users.find((user) => user.id === latest.takenBy)
    const rows = pairsOf(latest.tasks, current)
      .map((pair) => ({
        pair,
        row: rowOf(pair, taskDeviation(pair.planned, pair.current), seesMoney),
      }))
      .sort((a, b) => a.row.title.localeCompare(b.row.title, 'pt-BR'))

    return {
      projectId,
      canTake,
      costEnabled,
      costVisible: seesMoney,
      baseline: {
        id: latest.id,
        name: latest.name,
        takenAt: latest.takenAt,
        takenByName: takenBy?.name ?? null,
      },
      summary: {
        plannedEnd: summary.plannedEnd,
        currentEnd: summary.currentEnd,
        endDeviationDays: summary.endDeviationDays,
        plannedHours: summary.plannedHoursHundredths / 100,
        currentHours: summary.currentHoursHundredths / 100,
        plannedCost: money(summary.plannedCostCents, seesMoney),
        currentCost: money(summary.currentCostCents, seesMoney),
      },
      tasks: rows.map((item) => item.row),
    }
  }
}

/**
 * Tira uma foto nova do projeto (só o gestor). Grava as tarefas ativas com alguma data, com o
 * cronograma, as horas e, se o módulo `cost` está ligado, o custo estimado de cada uma. A foto é
 * imutável; a comparação passa a usar esta. Devolve a leitura já atualizada.
 */
export class TakeBaseline {
  constructor(private readonly deps: AppDeps) {}

  async execute(actor: Actor, input: { readonly projectId: string }): Promise<BaselineViewDto> {
    const organizationId = actor.organizationId
    const projectId = toProjectId(input.projectId)
    const project = await projectOrThrow(this.deps, organizationId, projectId)
    assertTakeable(actor, project)

    const now = await this.deps.clock.now(organizationId)
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
    const today = toDateOnly(new Date(now), timeZone)
    const [allTasks, modules, users] = await Promise.all([
      this.deps.tasks.listByProject(organizationId, projectId),
      this.deps.projectModules.list(organizationId, projectId),
      this.deps.users.list(organizationId),
    ])
    const costEnabled = moduleStateOf(modules, 'cost') !== 'disabled'
    const rates = new Map<UserId, number>(users.map((user) => [user.id, user.defaultRateCents]))
    const rateOf = (userId: UserId) => rates.get(userId) ?? 0
    const tasks = allTasks
      .filter((task) => task.archivedAt === null)
      .map((task) => planOf(task, rateOf, costEnabled))
      .filter(hasPlanDates)

    const baseline: Baseline = {
      id: toBaselineId(await this.deps.idGenerator.generate(organizationId)),
      organizationId,
      projectId,
      name: normalizeBaselineName(`Linha de base de ${brDate(today)}`),
      takenAt: now,
      takenBy: actor.userId,
      tasks,
    }
    await this.deps.unitOfWork.run(organizationId, (repos) =>
      repos.baselines.add(organizationId, baseline),
    )
    await this.deps.changeNotifier.publish(organizationId, { kind: 'project', ids: [projectId] })
    return new GetBaseline(this.deps).execute(actor, { projectId })
  }
}
