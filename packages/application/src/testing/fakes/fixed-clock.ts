import type { OrganizationId } from '@agilebox/core'
import type { Clock } from '../../ports'

export class FixedClock implements Clock {
  constructor(private readonly instant: string) {}

  async now(_organizationId: OrganizationId): Promise<string> {
    void _organizationId
    await Promise.resolve()
    return this.instant
  }
}
