import { describe, expect, it } from 'vitest'
import { createChecklistItem } from '../entities/checklist-item'
import type { ChecklistItem } from '../entities/checklist-item'
import { createTask } from '../entities/task'
import { ValidationError } from '../shared/errors'
import {
  toChecklistItemId,
  toEventId,
  toOrganizationId,
  toParticipationId,
  toProjectId,
  toTaskId,
  toUserId,
} from '../shared/ids'
import {
  addChecklistItem,
  changedChecklistPositions,
  checklistEventDraft,
  checklistProgress,
  moveChecklistItem,
  removeChecklistItem,
  renameChecklistItem,
  setChecklistItemDone,
} from './checklist'
import { describeEvent } from './timeline'

const id = (n: number) => String(n).padStart(26, '0')
const organizationId = toOrganizationId(id(1))
const taskId = toTaskId(id(1))
const userId = toUserId(id(1))
const at = '2026-01-02T10:00:00.000Z'

function aTask(status: 'in_progress' | 'done' = 'in_progress') {
  const task = createTask({
    id: taskId,
    organizationId,
    number: 1,
    projectId: toProjectId(id(1)),
    projectName: 'Projeto',
    createdBy: userId,
    title: 'Tarefa',
    createdAt: '2026-01-01T00:00:00.000Z',
    responsibleParticipationId: toParticipationId(id(1)),
    responsibleRateCents: 4500,
  })
  return { ...task, status }
}

function anItem(n: number, title = `Item ${n}`, done = false): ChecklistItem {
  return createChecklistItem({
    id: toChecklistItemId(id(10 + n)),
    organizationId,
    taskId,
    title,
    done,
    position: n - 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    doneAt: done ? at : null,
  })
}

const draft = (n: number, title = `Novo ${n}`) => ({
  id: toChecklistItemId(id(20 + n)),
  title,
  createdAt: at,
})

describe('subtarefas: entidade', () => {
  it('rejeita título vazio, só espaços e acima de 200 caracteres', () => {
    expect(() => anItem(1, '   ')).toThrow(ValidationError)
    expect(() => anItem(1, 'a'.repeat(201))).toThrow(ValidationError)
    expect(anItem(1, '  Revisar  ').title).toBe('Revisar')
    expect(anItem(1, 'a'.repeat(200)).title).toHaveLength(200)
  })

  it('exige doneAt coerente com done', () => {
    expect(() => anItem(1, 'x', true)).not.toThrow()
    expect(() => createChecklistItem({ ...anItem(1), done: true, doneAt: null })).toThrow(
      ValidationError,
    )
  })
})

describe('subtarefas: regras', () => {
  it('adiciona no fim e conta a posição a partir dos itens existentes', () => {
    const items = [anItem(1), anItem(2)]
    const added = addChecklistItem(aTask(), items, draft(1))
    expect(added).toMatchObject({ position: 2, done: false, doneAt: null, taskId, organizationId })
  })

  it('aceita até 50 itens e recusa o 51º', () => {
    const full = Array.from({ length: 50 }, (_, index) => anItem(index + 1))
    expect(() => addChecklistItem(aTask(), full.slice(0, 49), draft(1))).not.toThrow()
    expect(() => addChecklistItem(aTask(), full, draft(2))).toThrow(
      'Limite de 50 subtarefas por tarefa',
    )
  })

  it('não aceita novos itens em tarefa concluída, mas aceita marcar e remover', () => {
    const done = aTask('done')
    expect(() => addChecklistItem(done, [], draft(1))).toThrow(ValidationError)
    expect(setChecklistItemDone(anItem(1), true, at).done).toBe(true)
    expect(removeChecklistItem([anItem(1)], anItem(1).id).remaining).toEqual([])
  })

  it('marca e desmarca, registrando e limpando a data de conclusão', () => {
    const item = anItem(1)
    const done = setChecklistItemDone(item, true, at)
    expect(done).toMatchObject({ done: true, doneAt: at })
    expect(setChecklistItemDone(done, false, at)).toMatchObject({ done: false, doneAt: null })
    expect(setChecklistItemDone(item, false, at)).toBe(item)
  })

  it('renomeia sem alterar o restante e devolve o mesmo item quando o título não muda', () => {
    const item = anItem(1)
    expect(renameChecklistItem(item, ' Item 1 ')).toBe(item)
    expect(renameChecklistItem(item, 'Outro').title).toBe('Outro')
    expect(() => renameChecklistItem(item, '')).toThrow(ValidationError)
  })

  it('remove e reatribui posições contíguas', () => {
    const items = [anItem(1), anItem(2), anItem(3)]
    const { removed, remaining } = removeChecklistItem(items, items[1]!.id)
    expect(removed.title).toBe('Item 2')
    expect(remaining.map((item) => [item.title, item.position])).toEqual([
      ['Item 1', 0],
      ['Item 3', 1],
    ])
    expect(changedChecklistPositions(items, remaining).map((item) => item.title)).toEqual([
      'Item 3',
    ])
  })

  it('move para uma posição e reatribui as demais', () => {
    const items = [anItem(1), anItem(2), anItem(3)]
    const moved = moveChecklistItem(items, items[2]!.id, 0)
    expect(moved.map((item) => [item.title, item.position])).toEqual([
      ['Item 3', 0],
      ['Item 1', 1],
      ['Item 2', 2],
    ])
    expect(changedChecklistPositions(items, moved)).toHaveLength(3)
    expect(moveChecklistItem(items, items[0]!.id, 0)).toEqual(items)
  })

  it('recusa posição fora do intervalo e item inexistente', () => {
    const items = [anItem(1), anItem(2)]
    expect(() => moveChecklistItem(items, items[0]!.id, 2)).toThrow(ValidationError)
    expect(() => moveChecklistItem(items, items[0]!.id, -1)).toThrow(ValidationError)
    expect(() => moveChecklistItem(items, toChecklistItemId(id(99)), 0)).toThrow(ValidationError)
    expect(() => removeChecklistItem(items, toChecklistItemId(id(99)))).toThrow(ValidationError)
  })

  it('calcula o progresso, com zero quando não há itens', () => {
    expect(checklistProgress([])).toEqual({ done: 0, total: 0, percent: 0 })
    const items = [anItem(1, 'a', true), anItem(2), anItem(3), anItem(4), anItem(5)]
    expect(checklistProgress(items)).toEqual({ done: 1, total: 5, percent: 20 })
    expect(checklistProgress([anItem(1, 'a', true), anItem(2)])).toEqual({
      done: 1,
      total: 2,
      percent: 50,
    })
  })

  it('gera os rascunhos de evento com o título no payload', () => {
    expect(checklistEventDraft('checklist_item_removed', anItem(1, 'Testar'))).toEqual({
      type: 'checklist_item_removed',
      payload: { itemId: anItem(1).id, title: 'Testar' },
    })
  })
})

describe('subtarefas: texto da linha do tempo', () => {
  it('descreve cada evento de subtarefa', () => {
    const base = {
      id: toEventId(id(30)),
      taskId,
      at,
      actorUserId: userId,
      asManager: false,
    }
    const names = {
      organizationId,
      user: () => 'Ana',
      contributor: () => 'Cliente',
    }
    const payload = { itemId: anItem(1).id, title: 'Testar login' }
    const viewer = { userId, organizationId, role: 'collaborator' as const }
    expect(describeEvent({ ...base, type: 'checklist_item_added', payload }, viewer, names)).toBe(
      'adicionou a subtarefa: Testar login',
    )
    expect(describeEvent({ ...base, type: 'checklist_item_done', payload }, viewer, names)).toBe(
      'concluiu a subtarefa: Testar login',
    )
    expect(
      describeEvent({ ...base, type: 'checklist_item_reopened', payload }, viewer, names),
    ).toBe('reabriu a subtarefa: Testar login')
    expect(describeEvent({ ...base, type: 'checklist_item_removed', payload }, viewer, names)).toBe(
      'removeu a subtarefa: Testar login',
    )
  })
})
