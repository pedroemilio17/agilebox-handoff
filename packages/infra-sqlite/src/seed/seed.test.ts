import { describe, expect, it } from 'vitest'
import { expandMeetingOccurrences, parseDateOnly, toOrganizationId } from '@agilebox/core'
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
    const novemberMeetings = await unitOfWork.repositories.meetings.listOverlapping(
      organizationId,
      parseDateOnly('2026-11-01'),
      parseDateOnly('2026-11-30'),
    )
    expect(novemberMeetings.map((meeting) => meeting.title)).toEqual([
      'Alinhamento semanal',
      'Revisão de entrega',
      'Retrospectiva da entrega',
      'Planejamento da próxima entrega',
    ])
    const occurrences = expandMeetingOccurrences(
      novemberMeetings,
      parseDateOnly('2026-11-01'),
      parseDateOnly('2026-11-30'),
    )
    // Alinhamento semanal cai nas segundas 02, 09, 16, 23 e 30; a Retro nas sextas 06, 13, 20 e 27.
    // Os outros são avulsos.
    expect(occurrences.map((occurrence) => occurrence.date)).toEqual([
      '2026-11-02',
      '2026-11-06',
      '2026-11-06',
      '2026-11-09',
      '2026-11-09',
      '2026-11-13',
      '2026-11-16',
      '2026-11-20',
      '2026-11-23',
      '2026-11-27',
      '2026-11-30',
    ])
    expect(novemberMeetings[0]).toMatchObject({
      endTime: '10:00',
      kind: 'meeting',
      recurrence: 'weekly',
      recurrenceUntil: null,
    })
    expect(novemberMeetings[1]).toMatchObject({ endTime: '15:30', kind: 'review' })
    expect(novemberMeetings[2]).toMatchObject({
      kind: 'retro',
      recurrence: 'weekly',
      time: '16:00',
    })
    expect(novemberMeetings[3]).toMatchObject({ endTime: null, recurrence: 'none' })
    await expect(
      unitOfWork.repositories.boardSettings.findByOrganization(organizationId),
    ).resolves.toMatchObject({ wipLimits: { in_progress: 3, review: 2 } })

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

    const retroMeeting = novemberMeetings.find((meeting) => meeting.kind === 'retro')!
    const retroActions = await unitOfWork.repositories.retroActions.listByOccurrence(
      organizationId,
      retroMeeting.id,
      parseDateOnly('2026-11-06'),
    )
    expect(retroActions).toHaveLength(3)
    expect(retroActions.filter((action) => action.done)).toHaveLength(1)
    expect(new Set(retroActions.map((action) => action.responsibleId)).size).toBe(3)
    expect(retroActions.every((action) => action.dueDate !== null)).toBe(true)
  })

  it('define a definição de pronto da demonstração e confirma as conclusões', async () => {
    const unitOfWork = new InMemoryUnitOfWork()
    const organizationId = toOrganizationId('00000000000000000000000001')
    await seedDemo({
      ...unitOfWork.repositories,
      unitOfWork,
      changeNotifier: new RecordingNotifier(),
      saveOrganization: async () => {
        await Promise.resolve()
      },
      now: () => '2026-11-01T12:00:00.000Z',
    })
    const projects = await unitOfWork.repositories.projects.list(organizationId)
    const titlesOf = async (name: string) => {
      const project = projects.find((candidate) => candidate.name === name)!
      return (
        await unitOfWork.repositories.definitionOfDone.listByProject(organizationId, project.id)
      ).map((item) => item.title)
    }
    expect(await titlesOf('Projeto A')).toEqual([
      'Testes passando',
      'Documentação atualizada',
      'Revisado por outra pessoa',
    ])
    expect(await titlesOf('Projeto B')).toEqual(['Revisado pelo gestor'])
    expect(await titlesOf('Projeto C')).toEqual([])

    const tasks = await unitOfWork.repositories.tasks.listBoard(organizationId, {})
    const published = tasks.find((task) => task.title === 'Publicar versão de teste')!
    expect(published.status).toBe('done')
    const timeline = await unitOfWork.repositories.timeline.listByTask(organizationId, published.id)
    expect(timeline.filter((event) => event.type === 'definition_confirmed')).toEqual([
      expect.objectContaining({ payload: { count: 3 } }),
    ])
  })
})
