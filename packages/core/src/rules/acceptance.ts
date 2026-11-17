import { createAcceptanceCriterion } from '../entities/acceptance-criterion'
import type { AcceptanceCriterion } from '../entities/acceptance-criterion'
import type { Task } from '../entities/task'
import { ACCEPTANCE_MAX_CRITERIA, validateAcceptanceText } from '../entities/validation'
import { ConflictError, ValidationError } from '../shared/errors'
import type { AcceptanceCriterionId } from '../shared/ids'
import { changedPositions, moveToPosition, removeAndReindex } from './positions'
import type { TimelineEventDraft } from './timeline'

/** Tarefa arquivada não muda os critérios (mesma regra das demais alterações). */
function assertEditable(task: Task): void {
  if (task.archivedAt !== null) throw new ConflictError('Tarefa arquivada não pode ser alterada')
}

/** Novo critério vai para o fim da lista, não concluído. Até 20 por tarefa. */
export function addAcceptanceCriterion(
  task: Task,
  criteria: readonly AcceptanceCriterion[],
  draft: { readonly id: AcceptanceCriterionId; readonly text: string; readonly createdAt: string },
): AcceptanceCriterion {
  assertEditable(task)
  if (criteria.length >= ACCEPTANCE_MAX_CRITERIA)
    throw new ValidationError(`Limite de ${ACCEPTANCE_MAX_CRITERIA} critérios por tarefa`)
  return createAcceptanceCriterion({
    id: draft.id,
    organizationId: task.organizationId,
    taskId: task.id,
    text: draft.text,
    done: false,
    position: criteria.length,
    createdAt: draft.createdAt,
    updatedAt: draft.createdAt,
  })
}

/** Marca ou desmarca. Devolve o mesmo critério quando nada muda. */
export function setAcceptanceDone(
  task: Task,
  criterion: AcceptanceCriterion,
  done: boolean,
  at: string,
): AcceptanceCriterion {
  assertEditable(task)
  if (criterion.done === done) return criterion
  return { ...criterion, done, updatedAt: at }
}

/** Renomeia (valida o texto). Devolve o mesmo critério quando o texto não muda. */
export function renameAcceptanceCriterion(
  task: Task,
  criterion: AcceptanceCriterion,
  text: string,
  at: string,
): AcceptanceCriterion {
  assertEditable(task)
  const next = validateAcceptanceText(text)
  return next === criterion.text ? criterion : { ...criterion, text: next, updatedAt: at }
}

/** Remove o critério e reatribui as posições do restante. */
export function removeAcceptanceCriterion(
  task: Task,
  criteria: readonly AcceptanceCriterion[],
  id: AcceptanceCriterionId,
): { readonly removed: AcceptanceCriterion; readonly remaining: AcceptanceCriterion[] } {
  assertEditable(task)
  return removeAndReindex(criteria, id, 'Critério não encontrado')
}

/** Move o critério para a posição informada (0 a n-1) e reatribui as posições. */
export function moveAcceptanceCriterion(
  task: Task,
  criteria: readonly AcceptanceCriterion[],
  id: AcceptanceCriterionId,
  position: number,
): AcceptanceCriterion[] {
  assertEditable(task)
  return moveToPosition(criteria, id, position, {
    invalidPosition: 'Posição do critério inválida',
    notFound: 'Critério não encontrado',
  })
}

/** Critérios cuja posição mudou (os que precisam ser gravados depois de mover ou remover). */
export function changedAcceptancePositions(
  before: readonly AcceptanceCriterion[],
  after: readonly AcceptanceCriterion[],
): AcceptanceCriterion[] {
  return changedPositions(before, after)
}

/** Evento da linha do tempo de um critério. O texto sai do próprio critério (fica gravado no evento). */
export function acceptanceEventDraft(
  type:
    | 'acceptance_criterion_added'
    | 'acceptance_criterion_removed'
    | 'acceptance_criterion_done'
    | 'acceptance_criterion_reopened',
  criterion: AcceptanceCriterion,
): TimelineEventDraft {
  return { type, payload: { criterionId: criterion.id, text: criterion.text } }
}
