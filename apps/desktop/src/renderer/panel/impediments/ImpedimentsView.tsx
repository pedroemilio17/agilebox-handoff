import { useId, useRef, useState } from 'react'
import type { ImpedimentListItemDto } from '@agilebox/contract'
import { Button, EmptyState, SegmentedControl, TaskKey, Toast } from '@agilebox/ui'
import type { SegmentedOption } from '@agilebox/ui'
import { useActor } from '../../shared/session/useActor'
import type { PanelView } from '../layout/PanelShell'
import { formatDate, formatRelativeDate } from '../../shared/lib/format-date'
import { useProjects } from '../hooks/use-projects'
import { AssignDialog, ResolveDialog } from './ImpedimentDialogs'
import { impedimentCopy } from './impediment-copy'
import { byOldestFirst } from './impediment-rules'
import { useImpedimentList } from './use-impediments'
import styles from './ImpedimentsView.module.css'

type OwnerScope = 'all' | 'mine'

const OWNER_OPTIONS: readonly [SegmentedOption<OwnerScope>, SegmentedOption<OwnerScope>] = [
  { value: 'all', label: impedimentCopy.ownerAll },
  { value: 'mine', label: impedimentCopy.ownerMine },
]

export interface ImpedimentsViewProps {
  /** Abre o detalhe da tarefa do impedimento (AB-n). */
  readonly onOpenTask: (taskId: string) => void
  /** Projeto selecionado no painel: o botão "Como funciona" usa o estado dele. */
  readonly selectedProjectId?: string | null
  /** Leva ao quadro, pelo botão "Rever os primeiros passos". */
  readonly onNavigate?: (view: PanelView) => void
}

/**
 * Tela de Impedimentos (Intermediário em diante, com o módulo ligado ou encerrando). Lista os
 * abertos (o padrão do servidor); "Mostrar resolvidos" traz também os resolvidos, com nota.
 */
export function ImpedimentsView({ onOpenTask }: ImpedimentsViewProps) {
  const actor = useActor()
  const userId = actor.actor?.userId
  const projects = useProjects(false)
  const [projectId, setProjectId] = useState('')
  const [scope, setScope] = useState<OwnerScope>('all')
  const [showResolved, setShowResolved] = useState(false)
  const [assigning, setAssigning] = useState<ImpedimentListItemDto | null>(null)
  const [resolving, setResolving] = useState<ImpedimentListItemDto | null>(null)
  const [notice, setNotice] = useState<{ id: number; message: string } | null>(null)
  const noticeSeq = useRef(0)
  const projectFieldId = useId()
  // "Meus" espera a identidade da pessoa; sem ela, nada é pedido.
  const list = useImpedimentList(
    {
      ...(projectId ? { projectId } : {}),
      ...(scope === 'mine' && userId ? { ownerId: userId } : {}),
      includeResolved: showResolved,
    },
    scope === 'all' || userId !== undefined,
  )
  const items = [...(list.data ?? [])].sort(byOldestFirst)
  const now = new Date()

  const announce = (message: string) => {
    noticeSeq.current += 1
    setNotice({ id: noticeSeq.current, message })
  }

  return (
    <section aria-label={impedimentCopy.title} className={styles.view}>
      <div className={styles.toolbar}>
        <label className={styles.projectField} htmlFor={projectFieldId}>
          <span className={styles.label}>{impedimentCopy.project}</span>
          <select
            id={projectFieldId}
            className={styles.select}
            value={projectId}
            onChange={(event) => setProjectId(event.currentTarget.value)}
          >
            <option value="">{impedimentCopy.allProjects}</option>
            {(projects.data ?? []).map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </label>
        <SegmentedControl<OwnerScope>
          aria-label={impedimentCopy.owner}
          options={OWNER_OPTIONS}
          value={scope}
          onChange={setScope}
        />
        <button
          type="button"
          className={styles.toggle}
          aria-pressed={showResolved}
          onClick={() => setShowResolved(!showResolved)}
        >
          {impedimentCopy.showResolved}
        </button>
      </div>

      {list.isPending ? (
        <p role="status" className={styles.helper}>
          {impedimentCopy.loading}
        </p>
      ) : list.isError ? (
        <div role="alert" className={styles.errorBox}>
          <p>{impedimentCopy.error}</p>
          <Button type="button" onClick={() => void list.refetch()}>
            {impedimentCopy.retry}
          </Button>
        </div>
      ) : items.length === 0 ? (
        <EmptyState title={showResolved ? impedimentCopy.emptyFiltered : impedimentCopy.empty} />
      ) : (
        <ol
          aria-label={showResolved ? impedimentCopy.listResolved : impedimentCopy.list}
          className={styles.list}
        >
          {items.map((item) => {
            const resolved = item.status === 'resolved'
            return (
              <li key={item.id} className={styles.row} data-resolved={resolved}>
                <div className={styles.main}>
                  <div className={styles.top}>
                    <button
                      type="button"
                      className={styles.keyButton}
                      aria-label={impedimentCopy.openTask(item.taskKey)}
                      onClick={() => onOpenTask(item.taskId)}
                    >
                      <TaskKey value={item.taskKey} />
                    </button>
                    <span className={styles.taskTitle}>{item.taskTitle}</span>
                  </div>
                  <p className={styles.reason}>{item.reason}</p>
                  <p className={styles.meta}>
                    <span>{item.projectName}</span>
                    <span>
                      {item.ownerName
                        ? impedimentCopy.ownerLine(item.ownerName)
                        : impedimentCopy.noOwner}
                    </span>
                    {resolved ? (
                      <span>
                        {item.resolvedAt
                          ? impedimentCopy.resolvedOn(formatDate(new Date(item.resolvedAt)))
                          : impedimentCopy.resolved}
                      </span>
                    ) : (
                      <span>
                        {impedimentCopy.openedAgo(formatRelativeDate(new Date(item.openedAt), now))}
                      </span>
                    )}
                  </p>
                  {resolved && item.resolution ? (
                    <p className={styles.note}>{impedimentCopy.resolutionNote(item.resolution)}</p>
                  ) : null}
                </div>
                {resolved ? null : (
                  <div className={styles.actions}>
                    <Button type="button" onClick={() => setAssigning(item)}>
                      {impedimentCopy.assign}
                    </Button>
                    <Button type="button" variant="primary" onClick={() => setResolving(item)}>
                      {impedimentCopy.resolve}
                    </Button>
                  </div>
                )}
              </li>
            )
          })}
        </ol>
      )}

      {assigning ? (
        <AssignDialog
          key={assigning.id}
          impediment={assigning}
          onClose={() => setAssigning(null)}
          onDone={announce}
        />
      ) : null}
      {resolving ? (
        <ResolveDialog
          key={resolving.id}
          impediment={resolving}
          onClose={() => setResolving(null)}
          onDone={announce}
        />
      ) : null}
      {notice ? <Toast key={notice.id} message={notice.message} /> : null}
    </section>
  )
}
