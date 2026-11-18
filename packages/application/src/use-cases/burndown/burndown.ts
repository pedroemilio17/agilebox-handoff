import {
  averageVelocity,
  burndownSeries,
  canSeeProject,
  compareDateOnly,
  NotFoundError,
  PermissionDeniedError,
  sprintScope,
  sprintVelocityHours,
  toDateOnly,
  toProjectId,
} from '@agilebox/core'
import type { Actor, DateOnly, Sprint, Task, TimelineEvent } from '@agilebox/core'
import type { BurndownViewDto, VelocitySprintDto } from '@agilebox/contract'
import type { AppDeps } from '../../deps'

const VIEW_DENIED = 'Sem acesso a este projeto'
/** Sprints encerradas usadas na média de velocidade (o mesmo limite de `VELOCITY_WINDOW`). */
const VELOCITY_SPRINTS = 3

/**
 * Burndown e velocidade (ADR-10, módulo `burndown`). Mostra a sprint ativa, ou a última encerrada
 * quando não há ativa, e a velocidade das últimas sprints encerradas. Quem vê o projeto lê; só
 * horas e contagens, sem valores de custo. O cálculo está em `core/rules/burndown.ts`.
 */
export class GetBurndown {
  constructor(private readonly deps: AppDeps) {}

  async execute(actor: Actor, input: { readonly projectId: string }): Promise<BurndownViewDto> {
    const organizationId = actor.organizationId
    const projectId = toProjectId(input.projectId)
    const project = await this.deps.projects.findById(organizationId, projectId)
    if (!project) throw new NotFoundError('Projeto não encontrado')
    const members = await this.deps.projects.listMembers(organizationId, projectId)
    if (
      !canSeeProject(
        actor,
        project,
        members.some((item) => item.userId === actor.userId),
      )
    )
      throw new PermissionDeniedError(VIEW_DENIED)

    const now = await this.deps.clock.now(organizationId)
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
    const today = toDateOnly(new Date(now), timeZone)
    const [tasks, sprints] = await Promise.all([
      this.deps.tasks.listByProject(organizationId, projectId),
      this.deps.sprints.listByProject(organizationId, projectId),
    ])

    const active = sprints.find((sprint) => sprint.status === 'active') ?? null
    const closed = sprints
      .filter((sprint) => sprint.status === 'closed')
      .sort((a, b) => a.number - b.number)
    const shown = active ?? closed[closed.length - 1] ?? null
    const velocityPool = closed.slice(-VELOCITY_SPRINTS)
    const involved = [...new Set([shown, ...velocityPool])].filter(
      (sprint): sprint is Sprint => sprint !== null,
    )

    const rowsBySprint = new Map(
      await Promise.all(
        involved.map(
          async (sprint) =>
            [
              sprint.id,
              await this.deps.sprintTasks.listBySprint(organizationId, sprint.id),
            ] as const,
        ),
      ),
    )
    const scopeOf = (sprint: Sprint): Task[] =>
      sprintScope(tasks, rowsBySprint.get(sprint.id) ?? [])

    // Histórico só das tarefas que entram em algum cálculo mostrado.
    const involvedTaskIds = new Set(involved.flatMap((sprint) => scopeOf(sprint).map((t) => t.id)))
    const events: TimelineEvent[] = (
      await Promise.all(
        [...involvedTaskIds].map((taskId) => this.deps.timeline.listByTask(organizationId, taskId)),
      )
    ).flat()

    const velocitySprints: VelocitySprintDto[] = velocityPool.map((sprint) => ({
      sprintId: sprint.id,
      number: sprint.number,
      name: sprint.name,
      hours: sprintVelocityHours({
        closedDay: closedDayOf(sprint, today, timeZone),
        scope: scopeOf(sprint),
        events,
        timeZone,
      }),
    }))
    const average = averageVelocity(
      velocitySprints.map((item) => ({ sprintNumber: item.number, hours: item.hours })),
    )

    if (shown === null) {
      return {
        projectId,
        today,
        sprint: null,
        totalHours: 0,
        remainingHours: 0,
        scopeTasks: 0,
        doneTasks: 0,
        unestimatedTasks: 0,
        days: [],
        velocity: { average, sprints: velocitySprints },
      }
    }

    // Dias medidos: até hoje na sprint ativa; na encerrada, até o dia do encerramento.
    const measuredUntil: DateOnly =
      shown.status === 'closed' && shown.closedAt !== null
        ? minDate(today, closedDayOf(shown, today, timeZone))
        : today
    const series = burndownSeries({
      plannedStart: shown.plannedStart,
      plannedEnd: shown.plannedEnd,
      scope: scopeOf(shown),
      events,
      measuredUntil,
      timeZone,
    })

    return {
      projectId,
      today,
      sprint: {
        id: shown.id,
        number: shown.number,
        name: shown.name,
        status: shown.status === 'active' ? 'active' : 'closed',
        plannedStart: shown.plannedStart,
        plannedEnd: shown.plannedEnd,
      },
      totalHours: series.totalHours,
      remainingHours: series.remainingHours,
      scopeTasks: series.scopeTasks,
      doneTasks: series.doneTasks,
      unestimatedTasks: series.unestimatedTasks,
      days: series.days.map((day) => ({
        date: day.date,
        idealHours: day.idealHours,
        remainingHours: day.remainingHours,
      })),
      velocity: { average, sprints: velocitySprints },
    }
  }
}

/** Dia do encerramento no fuso. Sprint encerrada sem instante (dado incompleto) conta como hoje. */
function closedDayOf(sprint: Sprint, today: DateOnly, timeZone: string): DateOnly {
  return sprint.closedAt === null ? today : toDateOnly(new Date(sprint.closedAt), timeZone)
}

function minDate(a: DateOnly, b: DateOnly): DateOnly {
  return compareDateOnly(a, b) <= 0 ? a : b
}
