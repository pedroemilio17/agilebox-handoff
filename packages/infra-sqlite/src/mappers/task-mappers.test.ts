import { describe, expect, it } from 'vitest'
import { toOrganizationId, toProjectId, toTaskId, toUserId } from '@agilebox/core'
import { mapTaskRow } from './task-mappers.js'

const timestamp = '2026-01-01T00:00:00.000Z'

const taskRow = {
  id: '00000000000000000000000004',
  organizationId: '00000000000000000000000001',
  projectId: '00000000000000000000000003',
  createdBy: '00000000000000000000000002',
  title: 'Tarefa de exemplo',
  description: '',
  status: 'planning' as const,
  deadline: null,
  ticketId: null,
  ticketUrl: null,
  searchText: 'tarefa de exemplo projeto agilebox',
  createdAt: timestamp,
  updatedAt: timestamp,
  archivedAt: null,
}

describe('mapTaskRow', () => {
  it('usa o default de backlog enquanto a persistência do backlog não existe (M3.9)', () => {
    const task = mapTaskRow(taskRow, 'Projeto AgileBox', [])

    expect(task.backlogRank).toBeNull()
    expect(task.onBoard).toBe(true)
  })

  it('mantém os campos já existentes no mapeamento', () => {
    const task = mapTaskRow(taskRow, 'Projeto AgileBox', [])

    expect(task).toMatchObject({
      id: toTaskId(taskRow.id),
      organizationId: toOrganizationId(taskRow.organizationId),
      projectId: toProjectId(taskRow.projectId),
      projectName: 'Projeto AgileBox',
      createdBy: toUserId(taskRow.createdBy),
      status: 'planning',
      deadline: null,
      ticket: null,
      participations: [],
    })
  })
})
