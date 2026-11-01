import type { ChangeEvent } from '@agilebox/contract'
import type { OrganizationId } from '@agilebox/core'

export interface ChangeNotifier {
  publish(organizationId: OrganizationId, change: ChangeEvent): Promise<void>
}
