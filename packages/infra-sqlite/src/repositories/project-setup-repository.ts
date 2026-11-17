import { and, eq } from 'drizzle-orm'
import { assertPlainAnswers } from '@agilebox/application'
import type { ProjectSetup, ProjectSetupRepository } from '@agilebox/application'
import { ValidationError } from '@agilebox/core'
import type { OrganizationId, ProjectId } from '@agilebox/core'
import { createSqliteClient } from '../client.js'
import { mapProjectSetupRow } from '../mappers/project-setup-mappers.js'
import { projectSetup, projects } from '../schema/index.js'

type SqliteDatabase = ReturnType<typeof createSqliteClient>

/** Configuração inicial do projeto em SQLite. Toda consulta filtra por `organization_id`. */
export function createSqliteProjectSetupRepository(
  database: SqliteDatabase,
): ProjectSetupRepository {
  return {
    async get(organizationId: OrganizationId, projectId: ProjectId) {
      const [row] = await database
        .select()
        .from(projectSetup)
        .where(
          and(
            eq(projectSetup.organizationId, organizationId),
            eq(projectSetup.projectId, projectId),
          ),
        )
        .limit(1)
      return row ? mapProjectSetupRow(row) : null
    },

    async save(organizationId: OrganizationId, setup: ProjectSetup) {
      // Só grava para projeto desta organização: a linha não pode apontar para outro time.
      const [project] = await database
        .select({ id: projects.id })
        .from(projects)
        .where(and(eq(projects.id, setup.projectId), eq(projects.organizationId, organizationId)))
        .limit(1)
      if (!project) throw new ValidationError('Projeto não encontrado nesta organização')
      assertPlainAnswers(setup.answers)

      const values = {
        projectId: setup.projectId,
        organizationId,
        answers: setup.answers === null ? null : JSON.stringify(setup.answers),
        recommendedPreset: setup.recommendedPreset,
        startedFromPreset: setup.startedFromPreset,
        guideLevel: setup.guideLevel,
      }
      await database
        .insert(projectSetup)
        .values(values)
        .onConflictDoUpdate({
          target: projectSetup.projectId,
          set: {
            answers: values.answers,
            recommendedPreset: values.recommendedPreset,
            startedFromPreset: values.startedFromPreset,
            guideLevel: values.guideLevel,
          },
        })
    },
  }
}
