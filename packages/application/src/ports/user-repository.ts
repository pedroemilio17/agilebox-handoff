import type { OrganizationId, User, UserId } from '@agilebox/core'

export interface UserRepository {
  findById(organizationId: OrganizationId, userId: UserId): Promise<User | null>
  list(organizationId: OrganizationId): Promise<readonly User[]>
  save(organizationId: OrganizationId, user: User): Promise<void>
}
