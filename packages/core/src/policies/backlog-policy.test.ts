import { describe, expect, it } from 'vitest'
import type { Actor } from './actor'
import type { Project } from '../entities/project'
import {
  canAddToBacklog,
  canPullFromBacklog,
  canReorderBacklog,
  canSendToBacklog,
  canViewBacklog,
} from './access-policy'
import { toOrganizationId, toProjectId, toUserId } from '../shared/ids'

const org = toOrganizationId('00000000000000000000000001')
const otherOrg = toOrganizationId('00000000000000000000000002')
const member: Actor = {
  userId: toUserId('00000000000000000000000002'),
  organizationId: org,
  role: 'collaborator',
}
const outsider: Actor = { ...member, userId: toUserId('00000000000000000000000003') }
const manager: Actor = {
  ...member,
  userId: toUserId('00000000000000000000000004'),
  role: 'manager',
}
const foreignManager: Actor = { ...manager, organizationId: otherOrg }
const project: Project = {
  id: toProjectId('00000000000000000000000005'),
  organizationId: org,
  createdBy: member.userId,
  name: 'P',
  nameKey: 'p',
  createdAt: '2026-01-01T00:00:00.000Z',
  archivedAt: null,
  archivedBy: null,
}

describe('política do backlog', () => {
  it('membro e gestor veem, reordenam, puxam e devolvem; quem não é membro não', () => {
    for (const policy of [
      canViewBacklog,
      canReorderBacklog,
      canPullFromBacklog,
      canSendToBacklog,
    ]) {
      expect(policy(member, project, true)).toBe(true)
      expect(policy(manager, project, false)).toBe(true)
      expect(policy(outsider, project, false)).toBe(false)
    }
  })

  it('gestor de outra organização não entra no backlog daqui', () => {
    expect(canPullFromBacklog(foreignManager, project, false)).toBe(false)
    expect(canReorderBacklog(foreignManager, project, false)).toBe(false)
  })

  it('adicionar item ao backlog segue criar tarefa: membro ou gestor', () => {
    expect(canAddToBacklog(member, project, true)).toBe(true)
    expect(canAddToBacklog(outsider, project, false)).toBe(false)
    expect(canAddToBacklog(manager, project, false)).toBe(true)
  })
})
