import { useState } from 'react'
import type { GetTaskDto } from '@agilebox/contract'
import { Button, SignalBadge } from '@agilebox/ui'
import { panelCopy } from '../copy'
import { SaveError } from './SaveError'
import { useArchiveTask, useUnarchiveTask } from './use-task-detail'
import styles from './TaskDetailView.module.css'

export interface ArchiveControlProps {
  readonly task: GetTaskDto
  /** Vem do servidor (participante ou gestor). Sem permissão, o controle não aparece. */
  readonly canArchive: boolean
}

/**
 * Arquivar pede confirmação curta; desarquivar é direto, porque volta a tarefa como estava.
 * Numa tarefa arquivada o detalhe já está em leitura, e este controle é a única ação liberada.
 */
export function ArchiveControl({ task, canArchive }: ArchiveControlProps) {
  const taskId = task.id
  const archive = useArchiveTask(taskId)
  const unarchive = useUnarchiveTask(taskId)
  const [confirming, setConfirming] = useState(false)
  const archived = task.archivedAt !== null && task.archivedAt !== undefined

  if (archived) {
    return (
      <section aria-label={panelCopy.archivedTask} className={styles.archiveStrip}>
        <p>
          <SignalBadge variant="aging">{panelCopy.archivedTask}</SignalBadge>
          <span>{panelCopy.archivedTaskHint}</span>
        </p>
        {canArchive ? (
          <Button type="button" disabled={unarchive.isPending} onClick={() => unarchive.mutate()}>
            {panelCopy.unarchiveAction}
          </Button>
        ) : null}
        <SaveError error={unarchive.error} />
      </section>
    )
  }

  if (!canArchive) return null

  if (!confirming) {
    return (
      <div className={styles.blockAction}>
        <Button type="button" onClick={() => setConfirming(true)}>
          {panelCopy.archiveAction}
        </Button>
        <SaveError error={archive.error} />
      </div>
    )
  }

  return (
    <div className={styles.blockForm} role="group" aria-label={panelCopy.archiveAction}>
      <p>{panelCopy.archiveConfirmTask}</p>
      <div className={styles.blockButtons}>
        <Button
          type="button"
          variant="primary"
          disabled={archive.isPending}
          onClick={() =>
            archive.mutate(undefined, {
              onSuccess: () => setConfirming(false),
            })
          }
        >
          {panelCopy.blockConfirm}
        </Button>
        <Button type="button" onClick={() => setConfirming(false)}>
          {panelCopy.blockCancel}
        </Button>
      </div>
      <SaveError error={archive.error} />
    </div>
  )
}
