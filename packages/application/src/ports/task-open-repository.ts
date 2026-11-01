import type { OrganizationId, TaskId, UserId } from '@agilebox/core'

export interface TaskOpenRepository {
  recordOpen(
    organizationId: OrganizationId,
    taskId: TaskId,
    userId: UserId,
    openedAt: string,
  ): Promise<void>
}
