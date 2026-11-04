import { describe, expect, it } from 'vitest'
import {
  createChecklistItem,
  createTaskComment,
  toChecklistItemId,
  toOrganizationId,
  toTaskCommentId,
  toUserId,
} from '@agilebox/core'
import type { Actor } from '@agilebox/core'
import { aTask, aUser } from '../testing/builders'
import { toTaskCommentDto, toTaskDetailDto, toTaskDto, toUserDto } from './index'

const organizationId = toOrganizationId('00000000000000000000000001')
const creatorId = toUserId('00000000000000000000000002')
const otherUserId = toUserId('00000000000000000000000009')

function actor(userId: Actor['userId'], role: Actor['role'] = 'collaborator'): Actor {
  return { userId, organizationId, role }
}

describe('mappers de DTO', () => {
  it('mostra valor/hora padrão ao próprio usuário e ao gestor, mas não a outro colaborador', () => {
    const user = aUser().build()

    expect(toUserDto(user, actor(user.id)).defaultRate).toBe(45)
    expect(toUserDto(user, actor(otherUserId)).defaultRate).toBeNull()
    expect(toUserDto(user, actor(otherUserId, 'manager')).defaultRate).toBe(45)
  })

  it('monta a chave legível com o prefixo da organização', () => {
    const task = { ...aTask().build(), number: 118 }

    expect(toTaskDto(task, 'AB', [], 0)).toMatchObject({ number: 118, key: 'AB-118' })
    expect(toTaskDto(task, 'OPS', [], 0)).toMatchObject({ number: 118, key: 'OPS-118' })
  })

  it('oculta valores de outras pessoas e total em R$ para colaborador', () => {
    const task = aTask().build()
    const withHours = {
      ...task,
      participations: task.participations.map((participation) => ({
        ...participation,
        hoursHundredths: 200,
      })),
    }
    const dto = toTaskDetailDto(
      withHours,
      'AB',
      actor(otherUserId),
      false,
      {
        user: (id) => (id === creatorId ? 'Ana Silva' : 'Bia Souza'),
        contributor: () => 'Cliente',
      },
      [],
      [],
    )

    expect(dto.participations[0]?.rate).toBeNull()
    expect(dto.total).toBeNull()
  })

  it('mostra tarifas e total ao gestor e marca detalhe de membro como somente leitura', () => {
    const task = aTask().build()
    const withHours = {
      ...task,
      participations: task.participations.map((participation) => ({
        ...participation,
        hoursHundredths: 200,
      })),
    }
    const names = {
      user: () => 'Ana Silva',
      contributor: () => 'Cliente',
    }

    const managerDto = toTaskDetailDto(
      withHours,
      'AB',
      actor(otherUserId, 'manager'),
      false,
      names,
      [],
      [],
    )
    expect(managerDto.participations[0]?.rate).toBe(45)
    expect(managerDto.total).toBe(90)
    expect(managerDto.canEdit).toBe(true)
    expect(managerDto.readOnly).toBe(false)

    const memberDto = toTaskDetailDto(withHours, 'AB', actor(otherUserId), true, names, [], [])
    expect(memberDto.canEdit).toBe(false)
    expect(memberDto.readOnly).toBe(true)
  })

  it('leva as subtarefas ao detalhe e o progresso ao card', () => {
    const task = aTask().build()
    const base = {
      organizationId,
      taskId: task.id,
      createdAt: '2026-01-01T00:00:00.000Z',
    }
    const done = createChecklistItem({
      ...base,
      id: toChecklistItemId('00000000000000000000000021'),
      title: 'Revisar',
      done: true,
      position: 0,
      doneAt: '2026-01-02T00:00:00.000Z',
    })
    const open = createChecklistItem({
      ...base,
      id: toChecklistItemId('00000000000000000000000022'),
      title: 'Testar',
      done: false,
      position: 1,
      doneAt: null,
    })

    expect(toTaskDto(task, 'AB', [done, open], 2).checklistProgress).toEqual({
      done: 1,
      total: 2,
      percent: 50,
    })
    const detail = toTaskDetailDto(
      task,
      'AB',
      actor(creatorId),
      false,
      { user: () => 'Ana Silva', contributor: () => 'Cliente' },
      [done, open],
      [],
    )
    expect(detail.checklist.map((item) => item.title)).toEqual(['Revisar', 'Testar'])
    expect(detail.checklist[0]).toMatchObject({ done: true, doneAt: '2026-01-02T00:00:00.000Z' })
    expect(detail.checklistProgress).toEqual({ done: 1, total: 2, percent: 50 })
  })

  it('marca comentário próprio como editável e removível, e o de outro só para o gestor', () => {
    const task = aTask().build()
    const comment = createTaskComment({
      id: toTaskCommentId('00000000000000000000000031'),
      organizationId,
      taskId: task.id,
      authorId: creatorId,
      body: 'Oi',
      mentions: [creatorId],
      createdAt: '2026-01-01T00:00:00.000Z',
      editedAt: null,
      asManager: false,
    })
    const names = { user: (id: string) => (id === creatorId ? 'Ana Silva' : 'Bia Souza') }

    expect(toTaskCommentDto(comment, task, actor(creatorId), names)).toMatchObject({
      authorName: 'Ana Silva',
      mentions: [{ id: creatorId, name: 'Ana Silva' }],
      canEdit: true,
      canRemove: true,
    })
    expect(toTaskCommentDto(comment, task, actor(otherUserId), names)).toMatchObject({
      canEdit: false,
      canRemove: false,
    })
    expect(toTaskCommentDto(comment, task, actor(otherUserId, 'manager'), names)).toMatchObject({
      canEdit: false,
      canRemove: true,
    })
  })
})
