import {
  createDefinitionOfDoneItem,
  toDefinitionOfDoneItemId,
  toOrganizationId,
  toProjectId,
} from '@agilebox/core'
import type { DefinitionOfDoneItem } from '@agilebox/core'
import type { definitionOfDoneItems } from '../schema/index.js'

type DefinitionOfDoneRow = typeof definitionOfDoneItems.$inferSelect

export function mapDefinitionOfDoneRow(row: DefinitionOfDoneRow): DefinitionOfDoneItem {
  return createDefinitionOfDoneItem({
    id: toDefinitionOfDoneItemId(row.id),
    organizationId: toOrganizationId(row.organizationId),
    projectId: toProjectId(row.projectId),
    title: row.title,
    position: row.position,
  })
}
