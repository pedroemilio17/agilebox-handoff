import { createOrganization, createUser, toOrganizationId, toUserId } from '@agilebox/core'
import type { Actor } from '@agilebox/core'
import { createUseCases } from '@agilebox/application'
import type { AppDeps } from '@agilebox/application'
import { demoSeedData } from './data.js'

const alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
function seedId(value: number): string {
  let remaining = BigInt(value)
  let result = ''
  for (let index = 0; index < 26; index += 1) {
    result = alphabet[Number(remaining % 32n)]! + result
    remaining /= 32n
  }
  return result
}

export interface SeedRuntime extends Omit<AppDeps, 'actorSession' | 'idGenerator' | 'clock'> {
  readonly saveOrganization: (organization: ReturnType<typeof createOrganization>) => Promise<void>
  readonly now?: () => string
}

export async function seedDemo(runtime: SeedRuntime): Promise<void> {
  const organizationId = toOrganizationId(seedId(1))
  const now = runtime.now ?? (() => new Date().toISOString())
  const createdAt = now()
  await runtime.saveOrganization(
    createOrganization({ id: organizationId, name: demoSeedData.organization, createdAt }),
  )

  const users = demoSeedData.users.map((entry, index) =>
    createUser({
      id: toUserId(seedId(index + 2)),
      organizationId,
      name: entry.name,
      email: entry.email,
      role: entry.role,
      defaultRateCents: 4500,
      createdAt,
    }),
  )
  for (const user of users) await runtime.users.save(organizationId, user)

  let nextId = 100
  let actor: Actor = { userId: users[0]!.id, organizationId, role: 'collaborator' }
  const useCases = createUseCases({
    ...runtime,
    actorSession: {
      get: () => actor,
      set: (next) => {
        actor = next
      },
    },
    idGenerator: {
      generate: async () => {
        await Promise.resolve()
        return seedId(nextId++)
      },
    },
    clock: {
      now: async () => {
        await Promise.resolve()
        return now()
      },
    },
  })
  const projects = []
  for (const name of demoSeedData.projects) {
    const project = await useCases.projects.createProject.execute(actor, { name })
    projects.push(project)
    for (const user of users) {
      if (user.id !== users[0]!.id) {
        await useCases.projects.addMember.execute(actor, {
          projectId: project.id,
          userId: user.id,
        })
      }
    }
  }

  // Definição de pronto criada pelo criador de cada projeto (o primeiro usuário).
  for (const [index, titles] of demoSeedData.definitionOfDone.entries()) {
    for (const title of titles) {
      await useCases.projects.definitionOfDone.add.execute(actor, {
        projectId: projects[index]!.id,
        title,
      })
    }
  }

  for (const name of demoSeedData.contributors) {
    await useCases.contributors.create.execute(actor, { name })
  }

  for (const item of demoSeedData.tasks) {
    const owner = users[item.owner]!
    actor = { userId: owner.id, organizationId, role: owner.role }
    const task = await useCases.tasks.create.execute(actor, {
      projectId: projects[item.project]!.id,
      title: item.title,
    })
    await useCases.tasks.update.execute(actor, {
      taskId: task.id,
      changes: {
        description: 'description' in item ? item.description : '',
        deadline: item.deadline,
      },
    })
    if (item.status !== 'planning') {
      // Concluir exige confirmar a definição de pronto do projeto: a demonstração confirma tudo.
      const confirmation =
        item.status === 'done'
          ? {
              confirmedDefinitionItemIds: (
                await useCases.projects.definitionOfDone.list.execute(actor, {
                  projectId: projects[item.project]!.id,
                })
              ).map((definitionItem) => definitionItem.id),
            }
          : {}
      await useCases.tasks.move.execute(actor, {
        taskId: task.id,
        status: item.status,
        ...confirmation,
      })
    }
    if ('priority' in item && item.priority === 'high') {
      await useCases.tasks.update.execute(actor, {
        taskId: task.id,
        changes: { priority: 'high' },
      })
    }
    if ('blockedReason' in item) {
      await useCases.tasks.block.execute(actor, { taskId: task.id, reason: item.blockedReason })
    }
    if ('checklist' in item) {
      for (const entry of item.checklist) {
        await useCases.tasks.checklist.add.execute(actor, { taskId: task.id, title: entry.title })
      }
      const withItems = await useCases.tasks.getDetail.execute(actor, { taskId: task.id })
      for (const entry of item.checklist) {
        const sub = withItems.checklist.find((candidate) => candidate.title === entry.title)
        if (entry.done && sub) {
          await useCases.tasks.checklist.toggle.execute(actor, {
            taskId: task.id,
            itemId: sub.id,
            done: true,
          })
        }
      }
    }
    if (item.owner === 0 && item.title === 'Atualizar documentação da API') {
      const support = await useCases.participations.add.execute(actor, {
        taskId: task.id,
        participant: { kind: 'user', userId: users[1]!.id },
        role: 'support',
      })
      await useCases.participations.setHours.execute(actor, {
        taskId: task.id,
        participationId: support.id,
        hours: '2',
      })
      const details = await useCases.tasks.getDetail.execute(actor, { taskId: task.id })
      const responsible = details.participations.find((part) => part.role === 'responsible')
      if (responsible) {
        await useCases.participations.setHours.execute(actor, {
          taskId: task.id,
          participationId: responsible.id,
          hours: '6',
        })
      }
      // Dois comentários: um do responsável e uma resposta com menção ao responsável.
      actor = { userId: users[0]!.id, organizationId, role: 'collaborator' }
      await useCases.tasks.comments.add.execute(actor, {
        taskId: task.id,
        body: 'Começando pelos endpoints de autenticação.',
      })
      actor = { userId: users[1]!.id, organizationId, role: 'collaborator' }
      await useCases.tasks.comments.add.execute(actor, {
        taskId: task.id,
        body: '@Pedro revisa os exemplos de requisição quando puder.',
      })
      actor = { userId: users[4]!.id, organizationId, role: 'manager' }
      await useCases.tasks.update.execute(actor, {
        taskId: task.id,
        changes: { deadline: null },
      })
      await useCases.tasks.update.execute(actor, {
        taskId: task.id,
        changes: { deadline: item.deadline },
      })
    }
  }

  actor = { userId: users[4]!.id, organizationId, role: 'manager' }
  // Limites de WIP da demonstração: Desenvolvendo até 3 e Revisar até 2 (sinal, não bloqueio).
  await useCases.boardSettings.setWipLimits.execute(actor, {
    wipLimits: { in_progress: 3, review: 2 },
  })
  for (const meeting of demoSeedData.meetings) {
    await useCases.meetings.create.execute(actor, {
      title: meeting.title,
      date: meeting.date,
      time: meeting.time,
      endTime: meeting.endTime,
      kind: meeting.kind,
      recurrence: meeting.recurrence,
      recurrenceUntil: meeting.recurrenceUntil,
      participants: meeting.participants.map((index) => users[index]!.id),
    })
  }
}
