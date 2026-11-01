import type { OrganizationId, TaskId, TimelineEvent } from '@agilebox/core'

export interface TimelineRepository {
  listByTask(organizationId: OrganizationId, taskId: TaskId): Promise<readonly TimelineEvent[]>
  saveMany(organizationId: OrganizationId, events: readonly TimelineEvent[]): Promise<void>
}
