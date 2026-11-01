import type { OrganizationId } from '@agilebox/core'

export interface Clock {
  now(organizationId: OrganizationId): Promise<string>
}
