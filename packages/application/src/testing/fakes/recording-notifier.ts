import type { ChangeEvent } from '@agilebox/contract'
import type { OrganizationId } from '@agilebox/core'
import type { ChangeNotifier } from '../../ports'

export interface RecordedChange {
  readonly organizationId: OrganizationId
  readonly change: ChangeEvent
}

export class RecordingNotifier implements ChangeNotifier {
  readonly changes: RecordedChange[] = []

  async publish(organizationId: OrganizationId, change: ChangeEvent): Promise<void> {
    await Promise.resolve()
    this.changes.push({ organizationId, change })
  }
}
