import type { OrganizationId } from '@agilebox/core'

export interface IdGenerator {
  generate(organizationId: OrganizationId): Promise<string>
}
