import { and, asc, desc, eq, inArray } from 'drizzle-orm'
import { ValidationError } from '@agilebox/core'
import type { Baseline, OrganizationId, ProjectId } from '@agilebox/core'
import type { BaselineRepository } from '@agilebox/application'
import { createSqliteClient } from '../client.js'
import { mapBaselineRow } from '../mappers/baseline-mappers.js'
import { baselineTasks, baselines, projects, tasks, users } from '../schema/index.js'

type SqliteDatabase = ReturnType<typeof createSqliteClient>

/**
 * Fotos da linha de base (ADR-10). A foto é gravada de uma vez, com as tarefas. Projeto, gravador e
 * tarefas de outra organização são recusados com VALIDAÇÃO. A foto mais recente é a de `takenAt`.
 */
export function createSqliteBaselineRepository(database: SqliteDatabase): BaselineRepository {
  return {
    async findLatestByProject(organizationId, projectId: ProjectId) {
      const [row] = await database
        .select()
        .from(baselines)
        .where(
          and(eq(baselines.organizationId, organizationId), eq(baselines.projectId, projectId)),
        )
        .orderBy(desc(baselines.takenAt), desc(baselines.id))
        .limit(1)
      if (!row) return null
      const taskRows = await database
        .select()
        .from(baselineTasks)
        .where(
          and(
            eq(baselineTasks.organizationId, organizationId),
            eq(baselineTasks.baselineId, row.id),
          ),
        )
        .orderBy(asc(baselineTasks.title), asc(baselineTasks.taskId))
      return mapBaselineRow(row, taskRows)
    },
    async add(organizationId: OrganizationId, value: Baseline) {
      await assertLinks(database, organizationId, value)
      await database.insert(baselines).values({
        organizationId,
        id: value.id,
        projectId: value.projectId,
        name: value.name,
        takenAt: value.takenAt,
        takenBy: value.takenBy,
      })
      if (value.tasks.length === 0) return
      await database.insert(baselineTasks).values(
        value.tasks.map((item) => ({
          organizationId,
          baselineId: value.id,
          taskId: item.taskId,
          title: item.title,
          startsOn: item.startsOn,
          endsOn: item.endsOn,
          estimatedHoursHundredths: item.estimatedHoursHundredths,
          plannedCostCents: item.plannedCostCents,
        })),
      )
    },
  }
}

/** Projeto, gravador e tarefas precisam existir na mesma organização da foto. */
async function assertLinks(
  database: SqliteDatabase,
  organizationId: OrganizationId,
  value: Baseline,
) {
  const [project] = await database
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, value.projectId), eq(projects.organizationId, organizationId)))
    .limit(1)
  if (!project) throw new ValidationError('Projeto não encontrado nesta organização')
  const [taker] = await database
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, value.takenBy), eq(users.organizationId, organizationId)))
    .limit(1)
  if (!taker) throw new ValidationError('Pessoa de outra organização')
  if (value.tasks.length === 0) return
  const found = await database
    .select({ id: tasks.id })
    .from(tasks)
    .where(
      and(
        eq(tasks.organizationId, organizationId),
        inArray(
          tasks.id,
          value.tasks.map((item) => item.taskId),
        ),
      ),
    )
  if (found.length !== new Set(value.tasks.map((item) => item.taskId)).size)
    throw new ValidationError('Tarefa de outra organização')
}
