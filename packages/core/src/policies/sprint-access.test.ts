import { describe, expect, it } from 'vitest'
import type { Project } from '../entities/project'
import type { OrganizationId, ProjectId, UserId } from '../shared/ids'
import type { Actor } from './actor'
import { canPlanSprint, canStartOrCloseSprint, canViewSprints } from './access-policy'

const org = 'org' as OrganizationId
const otherOrg = 'other' as OrganizationId
const user = 'user' as UserId
const project: Project = {
  id: 'project' as ProjectId,
  organizationId: org,
  createdBy: 'owner' as UserId,
  name: 'Projeto',
  nameKey: 'projeto',
  createdAt: '2026-01-01T00:00:00.000Z',
  archivedAt: null,
  archivedBy: null,
}
const manager: Actor = { userId: 'boss' as UserId, organizationId: org, role: 'manager' }
const member: Actor = { userId: user, organizationId: org, role: 'collaborator' }
const outsider: Actor = { userId: 'out' as UserId, organizationId: org, role: 'collaborator' }
const stranger: Actor = { userId: 'x' as UserId, organizationId: otherOrg, role: 'manager' }

describe('acesso às sprints', () => {
  it('gestor e membro do projeto veem, planejam, iniciam e encerram', () => {
    for (const check of [canViewSprints, canPlanSprint, canStartOrCloseSprint]) {
      expect(check(manager, project, false)).toBe(true)
      expect(check(member, project, true)).toBe(true)
    }
  })

  it('colaborador que não é membro não vê nem altera sprints do projeto', () => {
    for (const check of [canViewSprints, canPlanSprint, canStartOrCloseSprint]) {
      expect(check(outsider, project, false)).toBe(false)
    }
  })

  it('nada cruza organizações, nem para gestor', () => {
    for (const check of [canViewSprints, canPlanSprint, canStartOrCloseSprint]) {
      expect(check(stranger, project, true)).toBe(false)
    }
  })
})
