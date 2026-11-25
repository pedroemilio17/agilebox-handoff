import type { GetTaskDto } from '@agilebox/contract'
import { panelCopy } from '../copy'
import { SaveError } from './SaveError'
import { useArchiveTask, useUnarchiveTask } from './use-task-detail'
import styles from './TaskDetailView.module.css'

export interface ArchiveControlProps {
  readonly task: GetTaskDto
  /** Vem do servidor (participante ou gestor). Sem permissão, o controle não aparece. */
  readonly canArchive: boolean
  /** A confirmação abre pelo menu "Arquivar tarefa" do cabeçalho. */
  readonly confirming: boolean
  readonly onConfirmingChange: (confirming: boolean) => void
}

/**
 * Arquivar pede confirmação curta; desarquivar é direto, porque volta a tarefa como estava.
 * Numa tarefa arquivada o detalhe já está em leitura, e este controle é a única ação liberada.
 */
export function ArchiveControl({
  task,
  canArchive,
  confirming,
  onConfirmingChange,
}: ArchiveControlProps) {
  const taskId = task.id
  const archive = useArchiveTask(taskId)
  const unarchive = useUnarchiveTask(taskId)
  const archived = task.archivedAt !== null && task.archivedAt !== undefined

  if (archived) {
    return (
      <section aria-label={panelCopy.archivedTask} className={styles.stateStrip}>
        <p>
          <span className={styles.badge}>{panelCopy.archivedTask}</span>
          <span>{panelCopy.archivedTaskHint}</span>
        </p>
        {canArchive ? (
          <button
            type="button"
            className={`${styles.btn} ${styles.btnSm} ${styles.btnSecondary}`}
            disabled={unarchive.isPending}
            onClick={() => unarchive.mutate()}
          >
            {panelCopy.unarchiveAction}
          </button>
        ) : null}
        <SaveError error={unarchive.error} />
      </section>
    )
  }

  if (!canArchive) return null

  if (!confirming) return archive.error ? <SaveError error={archive.error} /> : null

  return (
    <div className={styles.confirmRow} role="group" aria-label={panelCopy.archiveAction}>
      <p>{panelCopy.archiveConfirmTask}</p>
      <button
        type="button"
        className={`${styles.btn} ${styles.btnSm} ${styles.btnSecondary}`}
        disabled={archive.isPending}
        onClick={() =>
          archive.mutate(undefined, {
            onSuccess: () => onConfirmingChange(false),
          })
        }
      >
        {panelCopy.blockConfirm}
      </button>
      <button
        type="button"
        className={`${styles.btn} ${styles.btnSm} ${styles.btnGhost}`}
        onClick={() => onConfirmingChange(false)}
      >
        {panelCopy.blockCancel}
      </button>
      <SaveError error={archive.error} />
    </div>
  )
}
