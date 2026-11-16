import {
  canChangeTaskArchive,
  canEditTask,
  ConflictError,
  PermissionDeniedError,
} from '@agilebox/core'
import type { Actor, Task } from '@agilebox/core'

/**
 * Garante que a tarefa pode ser editada. Tarefa arquivada não aceita edição (só desarquivar):
 * quem poderia desarquivá-la recebe conflito com dica, e quem não participa recebe sem permissão.
 */
export function assertTaskEditable(actor: Actor, task: Task): void {
  if (canEditTask(actor, task)) return
  if (task.archivedAt !== null && canChangeTaskArchive(actor, task))
    throw new ConflictError('Tarefa arquivada não pode ser editada. Desarquive para alterar.')
  throw new PermissionDeniedError('Sem permissão para editar esta tarefa')
}
