import { describe, expect, it } from 'vitest'
import { toOrganizationId } from '@agilebox/core'
import { InMemoryUnitOfWork, RecordingNotifier } from '@agilebox/application/testing'
import { seedDemo } from './seed.js'

describe('seed de demonstração', () => {
  it('cria organização, usuários, projetos, tarefas, eventos e agenda pelos casos de uso', async () => {
    const unitOfWork = new InMemoryUnitOfWork()
    const organizationId = toOrganizationId('00000000000000000000000001')
    let savedOrganization: { id: string; name: string } | undefined

    await seedDemo({
      ...unitOfWork.repositories,
      unitOfWork,
      changeNotifier: new RecordingNotifier(),
      saveOrganization: async (organization) => {
        await Promise.resolve()
        savedOrganization = organization
      },
      now: () => '2026-11-01T12:00:00.000Z',
    })

    expect(savedOrganization).toMatchObject({ id: organizationId, name: 'AgileBox Demo' })
    await expect(unitOfWork.repositories.users.list(organizationId)).resolves.toHaveLength(5)
    await expect(unitOfWork.repositories.projects.list(organizationId)).resolves.toHaveLength(3)
    await expect(unitOfWork.repositories.contributors.list(organizationId)).resolves.toHaveLength(2)
    await expect(
      unitOfWork.repositories.meetings.listByMonth(organizationId, '2026-11'),
    ).resolves.toHaveLength(3)

    const tasks = await unitOfWork.repositories.tasks.listBoard(organizationId, {})
    expect(tasks).toHaveLength(10)
    expect(tasks.map((task) => task.number).sort((a, b) => a - b)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ])
    expect(tasks.map((task) => task.title)).toContain('Atualizar documentação da API')
    expect(
      tasks
        .filter((task) => task.priority === 'high')
        .map((task) => task.title)
        .sort(),
    ).toEqual(['Atualizar documentação da API', 'Revisar integração de chamados'])
    expect(tasks.filter((task) => task.blockedReason !== null).map((task) => task.title)).toEqual([
      'Configurar ambiente de homologação',
    ])
    const checklist = await unitOfWork.repositories.checklist.listByTasks(
      organizationId,
      tasks.map((task) => task.id),
    )
    expect(checklist).toHaveLength(3)
    expect(checklist.filter((item) => item.done).map((item) => item.title)).toEqual([
      'Revisar endpoints de autenticação',
    ])
    const timeline = await unitOfWork.repositories.timeline.listByTask(
      organizationId,
      tasks.find((task) => task.title === 'Atualizar documentação da API')!.id,
    )
    expect(timeline.length).toBeGreaterThan(4)
    const detailTask = tasks.find((task) => task.title === 'Atualizar documentação da API')!
    const comments = await unitOfWork.repositories.comments.listByTask(
      organizationId,
      detailTask.id,
    )
    expect(comments).toHaveLength(2)
    const pedro = (await unitOfWork.repositories.users.list(organizationId)).find(
      (user) => user.name === 'Pedro',
    )
    expect(comments[1]?.mentions).toEqual([pedro?.id])
    expect(comments.some((comment) => comment.mentions.length > 0)).toBe(true)
    expect(timeline.filter((event) => event.type === 'comment_added')).toHaveLength(2)
    expect(timeline.some((event) => event.asManager)).toBe(true)
  })
})
