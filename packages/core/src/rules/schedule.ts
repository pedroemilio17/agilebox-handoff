import type { Task } from '../entities/task'
import type { TaskDependency } from '../entities/task-dependency'
import type { GuideEventType } from '../modules/manifest'
import { ValidationError } from '../shared/errors'
import type { TaskId } from '../shared/ids'
import { compareDateOnly } from '../values/date-only'

/** Arestas já gravadas (predecessora → sucessora), no mesmo projeto. */
export type DependencyEdge = Pick<TaskDependency, 'predecessorId' | 'successorId'>

/**
 * Valida uma nova dependência término→início entre `predecessor` e `successor` (ADR-10, cronograma).
 * Recusa: a própria tarefa, tarefas de projetos diferentes, duplicata e ciclo. O ciclo é achado por
 * busca no grafo: se a sucessora já chega (por cadeia de dependências) à predecessora, a nova aresta
 * fecharia um laço.
 */
export function assertDependency(
  predecessor: Pick<Task, 'id' | 'projectId'>,
  successor: Pick<Task, 'id' | 'projectId'>,
  existing: readonly DependencyEdge[],
): void {
  if (predecessor.id === successor.id)
    throw new ValidationError('Tarefa não pode depender de si mesma')
  if (predecessor.projectId !== successor.projectId)
    throw new ValidationError('As tarefas precisam ser do mesmo projeto')
  if (
    existing.some(
      (edge) => edge.predecessorId === predecessor.id && edge.successorId === successor.id,
    )
  )
    throw new ValidationError('Esta dependência já existe')
  if (reaches(successor.id, predecessor.id, existing))
    throw new ValidationError('Esta dependência criaria um ciclo entre as tarefas')
}

/** Busca em largura pelas sucessoras: `target` é alcançável a partir de `from`? */
function reaches(from: TaskId, target: TaskId, existing: readonly DependencyEdge[]): boolean {
  const successorsOf = new Map<TaskId, TaskId[]>()
  for (const edge of existing) {
    const list = successorsOf.get(edge.predecessorId) ?? []
    list.push(edge.successorId)
    successorsOf.set(edge.predecessorId, list)
  }
  const seen = new Set<TaskId>([from])
  const queue: TaskId[] = [from]
  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index]
    if (current === undefined) break
    if (current === target) return true
    for (const next of successorsOf.get(current) ?? []) {
      if (seen.has(next)) continue
      seen.add(next)
      queue.push(next)
    }
  }
  return false
}

/**
 * Conflito de datas numa dependência: o término da predecessora (prazo) passa do início da sucessora.
 * Só existe conflito quando as duas datas estão preenchidas. Limite exato (início igual ao prazo) não
 * é conflito.
 */
export function dependencyConflict(
  predecessor: Pick<Task, 'deadline'>,
  successor: Pick<Task, 'startsOn'>,
): boolean {
  if (predecessor.deadline === null || successor.startsOn === null) return false
  return compareDateOnly(successor.startsOn, predecessor.deadline) < 0
}

/**
 * Evento do guia "Dê início e fim" (`task.scheduled`) para uma edição de tarefa: vale quando a tarefa
 * fica com início e prazo e um dos dois mudou nesta edição. Nulo nas demais.
 */
export function scheduleGuideEvent(
  before: Pick<Task, 'startsOn' | 'deadline'>,
  after: Pick<Task, 'startsOn' | 'deadline'>,
): GuideEventType | null {
  const scheduled = after.startsOn !== null && after.deadline !== null
  const changed = before.startsOn !== after.startsOn || before.deadline !== after.deadline
  return scheduled && changed ? 'task.scheduled' : null
}
