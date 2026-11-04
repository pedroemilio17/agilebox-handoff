import { describe, expect, it } from 'vitest'
import { createUser, toOrganizationId, toTaskId, toUserId } from '@agilebox/core'
import type { Actor } from '@agilebox/core'
import { aProject, aTask, aUser } from '../../testing/builders'
import { FixedClock } from '../../testing/fakes/fixed-clock'
import { InMemoryUnitOfWork } from '../../testing/fakes/in-memory-unit-of-work'
import { RecordingNotifier } from '../../testing/fakes/recording-notifier'
import { SequentialIdGenerator } from '../../testing/fakes/sequential-id-generator'
import { createUseCases } from '../../create-use-cases'
import type { ActorSession } from '../../ports'

const organizationId = toOrganizationId('00000000000000000000000001')
const userId = toUserId('00000000000000000000000002')
const managerId = toUserId('00000000000000000000000004')
const actor: Actor = { userId, organizationId, role: 'collaborator' }
const manager: Actor = { userId: managerId, organizationId, role: 'manager' }

function setup() {
  const unitOfWork = new InMemoryUnitOfWork()
  const actorSession: ActorSession = { get: () => actor, set: () => undefined }
  const useCases = createUseCases({
    actorSession,
    changeNotifier: new RecordingNotifier(),
    clock: new FixedClock('2026-01-02T00:00:00.000Z'),
    checklist: unitOfWork.repositories.checklist,
    retroActions: unitOfWork.repositories.retroActions,
    definitionOfDone: unitOfWork.repositories.definitionOfDone,
    comments: unitOfWork.repositories.comments,
    boardSettings: unitOfWork.repositories.boardSettings,
    contributors: unitOfWork.repositories.contributors,
    idGenerator: new SequentialIdGenerator(),
    meetings: unitOfWork.repositories.meetings,
    organizations: unitOfWork.repositories.organizations,
    participations: unitOfWork.repositories.participations,
    projects: unitOfWork.repositories.projects,
    taskOpens: unitOfWork.repositories.taskOpens,
    tasks: unitOfWork.repositories.tasks,
    timeline: unitOfWork.repositories.timeline,
    unitOfWork,
    users: unitOfWork.repositories.users,
  })
  return { useCases, unitOfWork }
}

async function seed(unitOfWork: InMemoryUnitOfWork) {
  const project = aProject().build()
  const task = {
    ...aTask().inProject(project).build(),
    status: 'review' as const,
    createdBy: userId,
  }
  await unitOfWork.repositories.users.save(organizationId, aUser().build())
  await unitOfWork.repositories.users.save(
    organizationId,
    createUser({ ...aUser().with({ id: managerId, name: 'Gestor' }).build(), role: 'manager' }),
  )
  await unitOfWork.repositories.tasks.save(organizationId, task)
  await unitOfWork.repositories.tasks.save(organizationId, {
    ...task,
    id: toTaskId('00000000000000000000000030'),
    status: 'done' as const,
  })
}

describe('dashboard.exportSummary', () => {
  it('restringe a exportação ao gestor (FORBIDDEN para colaborador)', async () => {
    const { useCases, unitOfWork } = setup()
    await seed(unitOfWork)
    const period = (await useCases.dashboard.get.execute(manager)).insights!.weeks[5]!.start
    await expect(
      useCases.dashboard.exportSummary.execute(actor, { period, format: 'md' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(
      useCases.dashboard.exportSummary.execute(actor, { period, format: 'csv' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('devolve o Markdown com o nome do arquivo e os mesmos números da consulta do dashboard', async () => {
    const { useCases, unitOfWork } = setup()
    await seed(unitOfWork)
    const dashboard = await useCases.dashboard.get.execute(manager)
    const insights = dashboard.insights!
    const result = await useCases.dashboard.exportSummary.execute(manager, {
      period: insights.weeks[5]!.start,
      format: 'md',
    })
    expect(result.filename).toMatch(/^resumo-do-time-\d{4}-\d{2}-\d{2}\.md$/)
    expect(result.mimeType).toBe('text/markdown; charset=utf-8')
    expect(result.content.startsWith('# Resumo do time\n')).toBe(true)
    expect(result.content).toContain(
      `Quadro em dia: **${Math.round(insights.upToDatePercentage ?? 0)}%**`,
    )
    expect(result.content).toContain(
      `- Paradas (há mais de 4 dias em Desenvolvendo ou Revisar): ${insights.agingCount}`,
    )
    expect(result.content).toContain(
      `- Vencidas (prazo de entrega passou): ${insights.overdueCount}`,
    )
    expect(result.content).toContain('- **Período:** Semana ')
  })

  it('devolve a planilha com BOM UTF-8 e uma linha por pessoa da equipe', async () => {
    const { useCases, unitOfWork } = setup()
    await seed(unitOfWork)
    const insights = (await useCases.dashboard.get.execute(manager)).insights!
    const result = await useCases.dashboard.exportSummary.execute(manager, {
      period: insights.weeks[5]!.start,
      format: 'csv',
    })
    expect(result.filename).toMatch(/^resumo-do-time-\d{4}-\d{2}-\d{2}\.csv$/)
    expect(result.mimeType).toBe('text/csv; charset=utf-8')
    expect(result.content.charCodeAt(0)).toBe(0xfeff)
    const lines = result.content.slice(1).split('\r\n').filter(Boolean)
    expect(lines[0]).toBe('Nome,Itens,Concluído %,Paradas,Vencidas,Bloqueadas,Última atualização')
    expect(lines).toHaveLength(1 + insights.team.length)
  })

  it('recusa uma semana que não está no dashboard', async () => {
    const { useCases, unitOfWork } = setup()
    await seed(unitOfWork)
    await expect(
      useCases.dashboard.exportSummary.execute(manager, { period: '2020-01-06', format: 'md' }),
    ).rejects.toMatchObject({ code: 'VALIDATION' })
  })
})
