import type { GetTaskDto } from '@agilebox/contract'
import { moduleStatesOf } from '../../shared/capabilities/capabilities-context'
import { useProjectModules } from '../hooks/use-project-modules'
import { useWbs } from '../hooks/use-wbs'
import { PropertyRow } from './PropertyRow'
import { SaveError } from './SaveError'
import { useSetDeliverable } from './use-task-detail'
import styles from './TaskDetailView.module.css'

const copy = {
  label: 'Entrega',
  none: 'Sem entrega',
  loading: 'Carregando as entregas…',
} as const

export interface DeliverablePropertyProps {
  readonly task: GetTaskDto
  readonly readOnly: boolean
}

/**
 * Entrega da EAP à qual a tarefa aponta. Só aparece com a EAP ligada no projeto da tarefa (a regra
 * vem dos módulos desse projeto, não do selecionado no painel). Sem a EAP ligada, nada é lido.
 */
export function DeliverableProperty({ task, readOnly }: DeliverablePropertyProps) {
  const modules = useProjectModules(task.projectId)
  const wbsState = moduleStatesOf(modules.data?.modules ?? []).wbs
  if (wbsState === undefined || wbsState === 'disabled') return null
  return <LinkedDeliverable task={task} readOnly={readOnly} />
}

function LinkedDeliverable({ task, readOnly }: DeliverablePropertyProps) {
  const wbs = useWbs(task.projectId)
  const setDeliverable = useSetDeliverable(task.id)
  const current = task.deliverableId ?? null
  const rows = (wbs.data?.deliverables ?? []).flatMap((row) =>
    row.kind === 'deliverable' ? [row] : [],
  )

  if (wbs.isPending) {
    return (
      <PropertyRow label={copy.label}>
        <p role="status" className={styles.helper}>
          {copy.loading}
        </p>
      </PropertyRow>
    )
  }

  if (readOnly) {
    const linked = rows.find((row) => row.id === current)
    return (
      <PropertyRow label={copy.label}>
        <span>{linked ? `${linked.code} · ${linked.title}` : copy.none}</span>
      </PropertyRow>
    )
  }

  return (
    <PropertyRow label={copy.label}>
      <div className={styles.propertyContent}>
        <select
          aria-label={copy.label}
          className={styles.propertyInput}
          value={current ?? ''}
          // Escolha de lista salva na hora, como a prioridade. Sem mudança, nada é gravado.
          onChange={(event) => {
            const next = event.currentTarget.value === '' ? null : event.currentTarget.value
            if (next !== current) setDeliverable.mutate(next)
          }}
        >
          <option value="">{copy.none}</option>
          {rows.map((row) => (
            <option key={row.id} value={row.id}>
              {`${row.code} · ${row.title}`}
            </option>
          ))}
        </select>
        <SaveError error={setDeliverable.error} />
      </div>
    </PropertyRow>
  )
}
