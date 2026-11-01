import type { ChangeEvent } from '@agilebox/contract'
import type { ChangeNotifier } from '@agilebox/application'
import type { OrganizationId } from '@agilebox/core'

export interface ChangeWindow {
  send(channel: 'changes', payload: { organizationId: OrganizationId; change: ChangeEvent }): void
}

export interface ChangeWindows {
  getAll(): readonly ChangeWindow[]
}

export class ChangeBroadcaster implements ChangeNotifier {
  constructor(private readonly windows: ChangeWindows) {}

  publish(organizationId: OrganizationId, change: ChangeEvent): Promise<void> {
    for (const window of this.windows.getAll()) {
      window.send('changes', { organizationId, change })
    }
    return Promise.resolve()
  }
}
