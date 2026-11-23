import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { TaskStatus } from '@agilebox/core'
import type { TaskDto } from '@agilebox/contract'
import { ActiveBoard, moveSprintTaskAfterDrop, sprintDropTargetStatus } from './ActiveBoard'
import { sprintCopy } from './sprint-copy'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const STATUSES: readonly TaskStatus[] = ['todo', 'in_progress', 'review', 'done']

function makeTask(id: string, title: string, overrides: Partial<TaskDto> = {}): TaskDto {
  return {
    id,
    number: 10,
    key: 'AB-10',
    projectId: '01J8Y4G2XK8Z1S6M3Q9W0ABCDE',
    projectName: 'Projeto Aurora',
    title,
    description: '',
    status: 'todo',
    priority: 'normal',
    blockedReason: null,
    blockedAt: null,
    archivedAt: null,
    backlogRank: 1,
    inBacklog: false,
    estimatedHours: 4,
    actualHours: 0,
    deadline: null,
    ticketId: null,
    ticketUrl: null,
    createdAt: '2026-10-31T12:00:00.000Z',
    updatedAt: '2026-10-31T12:00:00.000Z',
    checklistProgress: { done: 0, total: 0, percent: 0 },
    commentCount: 0,
    sprint: { id: '01J8Y4G2XK8Z1S6M3Q9W0S001', number: 1, name: 'Sprint 1', status: 'active' },
    ...overrides,
  }
}

function stubSprintBoardGeometry() {
  const box = (left: number, top: number, width: number, height: number) =>
    ({
      left,
      top,
      width,
      height,
      right: left + width,
      bottom: top + height,
      x: left,
      y: top,
      toJSON: () => ({}),
    }) as DOMRect
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const overlay = this.closest<HTMLElement>('[style*="position: fixed"]')
    if (overlay && overlay.style.width) {
      return box(
        parseFloat(overlay.style.left) || 0,
        parseFloat(overlay.style.top) || 0,
        parseFloat(overlay.style.width),
        parseFloat(overlay.style.height) || 0,
      )
    }
    const column = this.closest<HTMLElement>('section[data-status]')
    if (!column) return box(0, 0, 0, 0)
    const status = column.dataset.status as TaskStatus
    const index = STATUSES.indexOf(status)
    const columnLeft = Math.max(index, 0) * 280
    const card = this.closest<HTMLElement>('[data-task-id]')
    if (card) return box(columnLeft + 10, 60, 240, 90)
    return box(columnLeft, 0, 260, 600)
  })
}

describe('helpers puros de movimentação na sprint', () => {
  const todoTask = makeTask('t1', 'Primeira tarefa', { status: 'todo' })
  const reviewTask = makeTask('t2', 'Segunda tarefa', { status: 'review' })

  it('resolve o destino pela coluna ou por outro cartão', () => {
    expect(sprintDropTargetStatus('in_progress', [todoTask, reviewTask], STATUSES)).toBe(
      'in_progress',
    )
    expect(sprintDropTargetStatus('t2', [todoTask, reviewTask], STATUSES)).toBe('review')
    expect(sprintDropTargetStatus('missing', [todoTask, reviewTask], STATUSES)).toBeUndefined()
    expect(sprintDropTargetStatus(undefined, [todoTask, reviewTask], STATUSES)).toBeUndefined()
  })

  it('moveSprintTaskAfterDrop só dispara onMoveTask quando o estado muda', () => {
    const onMoveTask = vi.fn()
    expect(
      moveSprintTaskAfterDrop('t1', 'todo', [todoTask, reviewTask], STATUSES, onMoveTask),
    ).toBe(false)
    expect(
      moveSprintTaskAfterDrop('missing', 'done', [todoTask, reviewTask], STATUSES, onMoveTask),
    ).toBe(false)
    expect(moveSprintTaskAfterDrop('t1', 't2', [todoTask, reviewTask], STATUSES, onMoveTask)).toBe(
      true,
    )
    expect(onMoveTask).toHaveBeenCalledWith(todoTask, 'review')
  })
})

describe('ActiveBoard com arraste e teclado', () => {
  it('move cartão pelo arraste de teclado para a coluna vizinha', async () => {
    const task = makeTask('t1', 'Configurar cache', { status: 'todo' })
    const onMoveTask = vi.fn()
    const user = userEvent.setup()
    stubSprintBoardGeometry()

    render(
      <ActiveBoard
        items={[task]}
        midSprint={new Set()}
        showEstimates
        removeDisabled={false}
        onOpenTask={vi.fn()}
        onRemove={vi.fn()}
        onMoveTask={onMoveTask}
      />,
    )

    const handle = screen.getByRole('button', { name: 'Mover Configurar cache' })
    handle.focus()
    await user.keyboard(' ')
    await user.keyboard('{ArrowRight}')
    await user.keyboard(' ')

    await waitFor(() => expect(onMoveTask).toHaveBeenCalledWith(task, 'in_progress'))
  })

  it('move pelo seletor de estado acessível e preserva abrir e remover', async () => {
    const task = makeTask('t1', 'Ajustar layout', { status: 'todo' })
    const onMoveTask = vi.fn()
    const onOpenTask = vi.fn()
    const onRemove = vi.fn()
    const user = userEvent.setup()

    render(
      <ActiveBoard
        items={[task]}
        midSprint={new Set()}
        showEstimates
        removeDisabled={false}
        onOpenTask={onOpenTask}
        onRemove={onRemove}
        onMoveTask={onMoveTask}
      />,
    )

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Mover Ajustar layout para outro estado' }),
      'review',
    )
    expect(onMoveTask).toHaveBeenCalledWith(task, 'review')

    await user.click(screen.getByRole('button', { name: sprintCopy.openItem('Ajustar layout') }))
    expect(onOpenTask).toHaveBeenCalledWith('t1')

    await user.click(screen.getByRole('button', { name: sprintCopy.removeItem('Ajustar layout') }))
    expect(onRemove).toHaveBeenCalledWith('t1')
  })

  it('tarefa arquivada não exibe controle de movimentação nem de teclado', () => {
    const archived = makeTask('t-arch', 'Tarefa antiga', {
      status: 'done',
      archivedAt: '2026-11-01T10:00:00.000Z',
    })

    render(
      <ActiveBoard
        items={[archived]}
        midSprint={new Set()}
        showEstimates={false}
        removeDisabled={false}
        onOpenTask={vi.fn()}
        onRemove={vi.fn()}
        onMoveTask={vi.fn()}
      />,
    )

    expect(screen.queryByRole('button', { name: /^Mover / })).toBeNull()
    expect(screen.queryByRole('combobox')).toBeNull()
  })
})
