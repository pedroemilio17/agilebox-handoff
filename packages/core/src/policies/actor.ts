import type { OrganizationId, UserId } from '../shared/ids'
import type { UserRole } from '../values/role'

export interface Actor {
  readonly userId: UserId
  readonly organizationId: OrganizationId
  readonly role: UserRole
}
