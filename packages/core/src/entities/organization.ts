import type { OrganizationId } from '../shared/ids'
import { DEFAULT_TASK_PREFIX, parseTaskPrefix } from '../values/task-key'
import { validateName } from './validation'

export interface Organization {
  readonly id: OrganizationId
  readonly name: string
  readonly taskPrefix: string
  readonly createdAt: string
}

export interface CreateOrganizationInput extends Omit<Organization, 'taskPrefix'> {
  readonly taskPrefix?: string
}

export function createOrganization(input: CreateOrganizationInput): Organization {
  return {
    id: input.id,
    name: validateName(input.name),
    taskPrefix: parseTaskPrefix(input.taskPrefix ?? DEFAULT_TASK_PREFIX),
    createdAt: input.createdAt,
  }
}
