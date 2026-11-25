import type { GetTaskDto } from '@agilebox/contract'
import { panelCopy } from '../copy'
import { useCapabilities } from '../../shared/capabilities/capabilities-context'
import { refusalMessage } from '../backlog/refusal-message'
import { useSendToBacklog } from '../backlog/use-backlog'
import styles from './TaskDetailView.module.css'

export interface BacklogControlProps {
  readonly task: GetTaskDto
  readonly readOnly: boolean
  /** Depois de devolver, o detalhe fecha: a tarefa saiu do quadro. */
  readonly onSent: () => void
}

/**
 * Devolver ao backlog: item do menu "⋯", só com a ferramenta ligada, em Planejamento ou A fazer,
 * fora do backlog.
 */
export function BacklogControl({ task, readOnly, onSent }: BacklogControlProps) {
  const capabilities = useCapabilities()
  const send = useSendToBacklog(task.id)
  const available =
    capabilities.showScreen('backlog') &&
    !readOnly &&
    !task.inBacklog &&
    (task.status === 'planning' || task.status === 'todo')
  if (!available) return null
  return (
    <>
      <button
        type="button"
        role="menuitem"
        className={styles.moreMenuItem}
        disabled={send.isPending}
        onClick={() => send.mutate(undefined, { onSuccess: () => onSent() })}
      >
        {panelCopy.backlogSendBack}
      </button>
      {send.isError ? (
        <p role="alert" className={styles.errorNote} style={{ padding: '0 10px 6px' }}>
          {refusalMessage(send.error, panelCopy.backlogSendBackError)}
        </p>
      ) : null}
    </>
  )
}
