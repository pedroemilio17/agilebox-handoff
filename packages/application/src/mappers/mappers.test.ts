import { describe, expect, it } from 'vitest'
import { toOrganizationId, toUserId } from '@agilebox/core'
import type { Actor } from '@agilebox/core'
import { aTask, aUser } from '../testing/builders'
import { toTaskDetailDto, toTaskDto, toUserDto } from './index'

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

    expect(toTaskDto(task, 'AB')).toMatchObject({ number: 118, key: 'AB-118' })
    expect(toTaskDto(task, 'OPS')).toMatchObject({ number: 118, key: 'OPS-118' })
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
    const dto = toTaskDetailDto(withHours, 'AB', actor(otherUserId), false, {
      user: (id) => (id === creatorId ? 'Ana Silva' : 'Bia Souza'),
      contributor: () => 'Cliente',
    })

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

    const managerDto = toTaskDetailDto(withHours, 'AB', actor(otherUserId, 'manager'), false, names)
    expect(managerDto.participations[0]?.rate).toBe(45)
    expect(managerDto.total).toBe(90)
    expect(managerDto.canEdit).toBe(true)
    expect(managerDto.readOnly).toBe(false)

    const memberDto = toTaskDetailDto(withHours, 'AB', actor(otherUserId), true, names)
    expect(memberDto.canEdit).toBe(false)
    expect(memberDto.readOnly).toBe(true)
  })
})
