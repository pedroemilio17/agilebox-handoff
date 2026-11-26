import { useEffect, useRef, useState } from 'react'
import type { GetTaskDto } from '@agilebox/contract'
import { TASK_STATUSES, TASK_STATUS_LABELS } from '@agilebox/core'
import type { DateOnly, TaskStatus } from '@agilebox/core'
import { ReadOnlyBadge, Toast } from '@agilebox/ui'
import { useApi } from '../../shared/api/ApiProvider'
import { useCapabilities } from '../../shared/capabilities/capabilities-context'
import { isDefinitionOfDoneNotConfirmed } from '../../shared/definition-of-done/definition-of-done'
import { todayDateOnly } from '../../shared/lib/today'
import { isAgingTask, isBlockedTask } from '../../shared/lib/task-signals'
import { panelCopy } from '../copy'
import { sprintCopy } from '../sprints/sprint-copy'
import { sprintMarker } from '../sprints/sprint-rules'
import { ArchiveControl } from './ArchiveControl'
import { BacklogControl } from './BacklogControl'
import { BlocksSection } from './BlocksSection'
import { ChecklistCard } from './ChecklistCard'
import { CommentsCard } from './CommentsCard'
import { CriteriaCard } from './CriteriaCard'
import { DeadlineCard } from './DeadlineCard'
import { DeliverableProperty } from './DeliverableProperty'
import { PriorityProperty, TaskDescription, TicketProperty } from './DetailsCard'
import { DodGateModal } from './DodGateModal'
import { EstimateProperty } from './EstimateProperty'
import { formatHoursCount } from './hours-format'
import { HoursSection } from './HoursSection'
import { ExternalPeopleSection, ParticipantsCard } from './ParticipantsCard'
import { PropertyRow } from './PropertyRow'
import { SaveError } from './SaveError'
import { taskCopy } from './task-detail-copy'
import { TimelineCard } from './TimelineCard'
import { useBlurSave } from './use-blur-save'
import { useTimeline } from './use-participations'
import { useMoveTaskStatus, useTaskDetail, useUpdateTask } from './use-task-detail'
import styles from './TaskDetailView.module.css'

export interface TaskDetailViewProps {
  /** Visão Equipe: o detalhe abre só para leitura, mesmo que o servidor permita editar. */
  readonly readOnlyScope?: boolean
  readonly fullScreen?: boolean
  readonly onToggleFullScreen?: () => void
  readonly taskId: string
  readonly onBack: () => void
  readonly today?: DateOnly
}

type Topic = 'geral' | 'dod' | 'pessoas' | 'horas' | 'historico'
const TOPICS: readonly Topic[] = ['geral', 'dod', 'pessoas', 'horas', 'historico']

const STATUS_DOT: Readonly<Record<TaskStatus, string>> = {
  planning: styles.statusPlanning!,
  todo: styles.statusTodo!,
  in_progress: styles.statusInProgress!,
  review: styles.statusReview!,
  done: styles.statusDone!,
}

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

/** "2026-11-24" vira "24 nov" (contador do tópico Pessoas & Prazo). */
function shortDeadline(deadline: string | null): string {
  if (deadline === null) return '—'
  const [, month, day] = deadline.split('-')
  const label = MONTHS[Number(month) - 1]
  return label && day ? `${day} ${label}` : '—'
}

function dodCount(task: GetTaskDto, acceptance: boolean): string {
  if (acceptance) {
    const items = task.criteria ?? []
    return `${items.filter((item) => item.done).length}/${items.length}`
  }
  return String(task.projectDefinitionOfDone.length)
}

const MenuIcon = () => (
  <span aria-hidden="true" style={{ fontSize: 16, lineHeight: 1 }}>
    ⋯
  </span>
)

export function TaskDetailView({
  taskId,
  onBack,
  readOnlyScope = false,
  fullScreen = false,
  onToggleFullScreen,
  today = todayDateOnly(),
}: TaskDetailViewProps) {
  const api = useApi()
  const detail = useTaskDetail(taskId)
  const update = useUpdateTask(taskId)
  const move = useMoveTaskStatus(taskId)
  const timeline = useTimeline(taskId)
  const capabilities = useCapabilities()
  const task = detail.data
  const [topic, setTopic] = useState<Topic>('geral')
  const [menuOpen, setMenuOpen] = useState(false)
  const [stalledShown, setStalledShown] = useState(true)
  const [archiveConfirming, setArchiveConfirming] = useState(false)
  const [copyNotice, setCopyNotice] = useState<{ id: number; message: string } | null>(null)
  const [gate, setGate] = useState<{ reopened: boolean; saving: boolean } | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const reasonInputRef = useRef<HTMLInputElement>(null)
  const title = useBlurSave(task?.title ?? '', (next) => {
    if (next.trim() !== '') update.mutate({ title: next.trim() })
  })

  useEffect(() => {
    void api.tasks.recordOpen({ taskId }).catch(() => undefined)
  }, [api, taskId])

  // O menu "⋯" fecha ao clicar fora ou com Esc.
  useEffect(() => {
    if (!menuOpen) return
    const onPointer = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  const backButton = onToggleFullScreen ? (
    <button
      key="back"
      type="button"
      className={`${styles.btn} ${styles.btnGhost} ${styles.btnIcon}`}
      aria-label={panelCopy.backToBoard}
      title="Fechar detalhe"
      onClick={onBack}
    >
      <svg
        aria-hidden="true"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path d="m6 6 12 12M18 6 6 18" />
      </svg>
    </button>
  ) : (
    <button
      key="back"
      type="button"
      className={`${styles.btn} ${styles.btnSecondary}`}
      onClick={onBack}
    >
      ← {taskCopy.back}
    </button>
  )

  if (detail.isPending) {
    return (
      <section aria-label={panelCopy.taskDetail} className={styles.view}>
        <header className={styles.pageHead}>
          <div className={styles.pageHeadActions}>{backButton}</div>
        </header>
        <p role="status">{panelCopy.taskDetailLoading}</p>
      </section>
    )
  }
  if (detail.isError) {
    return (
      <section aria-label={panelCopy.taskDetail} className={styles.view}>
        <header className={styles.pageHead}>
          <div className={styles.pageHeadActions}>{backButton}</div>
        </header>
        <p role="alert">{panelCopy.taskDetailError}</p>
      </section>
    )
  }

  const current = task!
  const readOnly = current.readOnly || readOnlyScope
  const done = current.status === 'done'
  const archived = current.archivedAt !== null && current.archivedAt !== undefined
  const blocked = capabilities.can('impediments:passive') && isBlockedTask(current)
  const acceptance = capabilities.showScreen('acceptance')
  const canBlock =
    capabilities.can('impediments:screen') &&
    !capabilities.isWindingDown('impediments') &&
    !readOnly &&
    !done
  const canArchive = current.canArchive === true && !readOnlyScope && !archived
  const totalHours = current.participations.reduce((sum, p) => sum + p.hours, 0)
  const sprint = capabilities.can('sprints:passive') ? sprintMarker(current) : null
  const responsible = current.participations.find((person) => person.role === 'responsible')

  function selectTopic(next: Topic) {
    setTopic(next)
  }

  function goToBlocks(focus: 'input' | 'resolve') {
    selectTopic('historico')
    // O painel acabou de ser exibido: o foco vai no próximo quadro.
    requestAnimationFrame(() => {
      if (focus === 'resolve') {
        document.querySelector<HTMLElement>('[data-resolve-block]')?.focus()
      } else {
        reasonInputRef.current?.focus()
      }
    })
  }

  // Mesmo caminho para o seletor de estado e para "Concluir tarefa": concluir passa pela conferência.
  function requestStatus(status: TaskStatus) {
    if (status === 'done' && current.status !== 'done') {
      if (current.projectDefinitionOfDone.length > 0) {
        setGate({ reopened: false, saving: false })
        return
      }
      move.mutate({ status })
      return
    }
    move.mutate({ status })
  }

  function confirmGate(confirmedIds: readonly string[]) {
    setGate((state) => (state ? { ...state, saving: true } : state))
    move
      .mutateAsync({ status: 'done', confirmedDefinitionItemIds: confirmedIds })
      .then(() => setGate(null))
      .catch((error: unknown) => {
        // A lista do projeto mudou: a conferência reabre com os itens atuais.
        if (isDefinitionOfDoneNotConfirmed(error)) setGate({ reopened: true, saving: false })
        else setGate(null)
      })
  }

  // O ID é texto copiado para a área de transferência (não há link nem protocolo para ele).
  function copyTaskKey() {
    const key = current.key
    const notify = (message: string) =>
      setCopyNotice((previous) => ({ id: (previous?.id ?? 0) + 1, message }))
    Promise.resolve()
      .then(() => navigator.clipboard.writeText(key))
      .then(() => notify(panelCopy.taskIdCopied))
      .catch(() => notify(panelCopy.taskIdCopyError))
  }

  const moveError = isDefinitionOfDoneNotConfirmed(move.error) ? null : move.error

  const counts: Record<Topic, string> = {
    geral: `${current.checklistProgress.done}/${current.checklistProgress.total}`,
    dod: dodCount(current, acceptance),
    pessoas: shortDeadline(current.deadline),
    horas: formatHoursCount(totalHours),
    historico: String(timeline.data?.length ?? 0),
  }

  return (
    <section aria-label={panelCopy.taskDetail} className={styles.view}>
      <div className={styles.surface}>
        <header className={styles.pageHead}>
          <div className={styles.pageHeadMain}>
            <h1 className={styles.pageTitle}>
              <input
                type="text"
                aria-label={panelCopy.taskTitle}
                className={styles.titleInput}
                disabled={readOnly}
                value={title.value}
                onChange={(event) => title.onChange(event.currentTarget.value)}
                onFocus={title.onFocus}
                onBlur={() => {
                  if (title.value.trim() === '') title.onChange(current.title)
                  title.onBlur()
                }}
              />
            </h1>
            <p className={styles.pageSub}>
              <span className={styles.taskIdMono}>{current.key}</span>
              <span className={styles.taskSep} aria-hidden="true">
                ·
              </span>
              <span>{current.projectName}</span>
              {isAgingTask(current) ? (
                <>
                  <span className={styles.taskSep} aria-hidden="true">
                    ·
                  </span>
                  <button
                    type="button"
                    className={styles.quietToggle}
                    title={taskCopy.quietToggleTitle}
                    aria-pressed={stalledShown}
                    onClick={() => setStalledShown((shown) => !shown)}
                  >
                    {taskCopy.quietToggle}
                  </button>
                </>
              ) : null}
              {blocked ? (
                <span className={styles.blockedIndicator}>
                  <span className={`${styles.dotInline} ${styles.dotDanger}`} aria-hidden="true" />
                  {taskCopy.blockedIndicator}
                </span>
              ) : null}
            </p>
          </div>

          <div className={styles.pageHeadActions}>
            {onToggleFullScreen ? (
              <button
                type="button"
                className={`${styles.btn} ${styles.btnGhost} ${styles.btnIcon}`}
                aria-label={fullScreen ? 'Voltar ao painel lateral' : 'Abrir em tela cheia'}
                onClick={onToggleFullScreen}
              >
                <svg
                  aria-hidden="true"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <path
                    d={
                      fullScreen
                        ? 'M4 9h5V4m6 0v5h5M4 15h5v5m6 0v-5h5'
                        : 'M9 4H4v5m11-5h5v5M4 15v5h5m6 0h5v-5'
                    }
                  />
                </svg>
              </button>
            ) : null}
            {backButton}

            <div className={styles.stateSelectWrap}>
              <span
                className={`${styles.statusDot} ${STATUS_DOT[current.status]}`}
                aria-hidden="true"
              />
              <select
                className={styles.stateSelect}
                aria-label={taskCopy.stateLabel}
                disabled={readOnly}
                value={current.status}
                onChange={(event) => requestStatus(event.currentTarget.value as TaskStatus)}
              >
                {TASK_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {TASK_STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.moreWrap} ref={menuRef}>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnGhost}`}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-label={taskCopy.moreActions}
                onClick={() => setMenuOpen((open) => !open)}
              >
                <MenuIcon />
              </button>
              {menuOpen ? (
                <div className={styles.moreMenu} role="menu">
                  {canBlock ? (
                    <button
                      type="button"
                      role="menuitem"
                      className={styles.moreMenuItem}
                      onClick={() => {
                        setMenuOpen(false)
                        goToBlocks(blocked ? 'resolve' : 'input')
                      }}
                    >
                      {blocked ? taskCopy.menuResolve : taskCopy.menuBlock}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    role="menuitem"
                    className={styles.moreMenuItem}
                    disabled
                    title={taskCopy.menuDuplicateSoon}
                  >
                    {taskCopy.menuDuplicate}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className={styles.moreMenuItem}
                    onClick={() => {
                      setMenuOpen(false)
                      copyTaskKey()
                    }}
                  >
                    {taskCopy.menuCopyLink}
                  </button>
                  <BacklogControl task={current} readOnly={readOnly} onSent={onBack} />
                  {canArchive ? (
                    <button
                      type="button"
                      role="menuitem"
                      className={`${styles.moreMenuItem} ${styles.menuDanger}`}
                      onClick={() => {
                        setMenuOpen(false)
                        setArchiveConfirming(true)
                      }}
                    >
                      {taskCopy.menuArchive}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>

            {!readOnly ? (
              done ? (
                <button type="button" className={`${styles.btn} ${styles.btnSecondary}`} disabled>
                  {taskCopy.completedTask}
                </button>
              ) : (
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnPrimary}`}
                  onClick={() => requestStatus('done')}
                >
                  {taskCopy.completeTask}
                </button>
              )
            ) : (
              <ReadOnlyBadge />
            )}
          </div>
        </header>

        <SaveError error={update.error ?? moveError} />
        {copyNotice ? <Toast key={copyNotice.id} message={copyNotice.message} /> : null}
        <ArchiveControl
          task={current}
          canArchive={current.canArchive === true && !readOnlyScope}
          confirming={archiveConfirming}
          onConfirmingChange={setArchiveConfirming}
        />

        {isAgingTask(current) && stalledShown ? (
          <div className={styles.stalledNotice} role="alert" aria-label="Tarefa parada">
            <span className={styles.stalledNoticeText}>
              <span className={`${styles.dotInline} ${styles.dotWarning}`} aria-hidden="true" />
              <span>
                {taskCopy.stalledPrefix} <strong>{current.agingDays} dias</strong>{' '}
                {taskCopy.stalledIn} {TASK_STATUS_LABELS[current.status]} {taskCopy.stalledTail}
              </span>
            </span>
            <div className={styles.stalledNoticeActions}>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnSm} ${styles.btnGhost}`}
                disabled={readOnly || update.isPending}
                onClick={() => update.mutate({ progressConfirmed: true })}
              >
                {taskCopy.stillWorking}
              </button>
              {canBlock ? (
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnSm} ${styles.btnDanger}`}
                  onClick={() => goToBlocks('input')}
                >
                  {taskCopy.stalledBlock}
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className={styles.topicLayout}>
          <nav className={styles.topicRail} aria-label={taskCopy.topicsNav}>
            <span className={styles.topicRailLabel}>{taskCopy.topicsLabel}</span>
            {TOPICS.map((id) => (
              <button
                key={id}
                type="button"
                className={
                  topic === id ? `${styles.topicBtn} ${styles.topicBtnActive}` : styles.topicBtn
                }
                aria-current={topic === id ? 'true' : undefined}
                onClick={() => selectTopic(id)}
              >
                <span>
                  {id === 'historico' &&
                  !capabilities.can('impediments:passive') &&
                  !capabilities.showScreen('impediments')
                    ? 'Histórico'
                    : taskCopy.topics[id]}
                </span>
                <span className={styles.topicCount}>{counts[id]}</span>
              </button>
            ))}
          </nav>

          <div className={styles.topicStage}>
            <div className={styles.topicPanel} hidden={topic !== 'geral'}>
              <TaskDescription
                task={current}
                readOnly={readOnly}
                onUpdate={(changes) => update.mutate(changes)}
              />
              {capabilities.can('subtasks:screen') ? (
                <ChecklistCard task={current} readOnly={readOnly} />
              ) : null}
              <CommentsCard task={current} readOnlyScope={readOnlyScope} />
            </div>

            <div className={styles.topicPanel} hidden={topic !== 'dod'}>
              <section className={styles.topicSection} aria-labelledby="task-section-dod">
                <div className={styles.topicSectionHead}>
                  <h2 className={styles.topicSectionTitle} id="task-section-dod">
                    {taskCopy.dodTitle}
                  </h2>
                  <span className={styles.topicSectionMeta}>
                    {current.projectDefinitionOfDone.length}
                  </span>
                </div>
                <p className={styles.topicHelper}>{taskCopy.dodHelper}</p>
                {current.projectDefinitionOfDone.length === 0 ? (
                  <p className={styles.emptyNote}>{taskCopy.dodEmpty}</p>
                ) : (
                  <ul className={styles.checklistStack} aria-label={taskCopy.dodProjectItems}>
                    {current.projectDefinitionOfDone.map((item) => (
                      <li key={item.id} className={styles.checkboxRow}>
                        <span className={styles.checklistTitle} style={{ cursor: 'default' }}>
                          {item.title}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              {acceptance ? (
                <CriteriaCard
                  task={current}
                  readOnly={readOnly}
                  windingDown={capabilities.isWindingDown('acceptance')}
                />
              ) : null}
            </div>

            <div className={styles.topicPanel} hidden={topic !== 'pessoas'}>
              <section className={styles.topicSection} aria-labelledby="task-section-people">
                <div className={styles.topicSectionHead}>
                  <h2 className={styles.topicSectionTitle} id="task-section-people">
                    {taskCopy.peopleTitle}
                  </h2>
                </div>
                <div className={styles.kvList}>
                  <PropertyRow label={panelCopy.responsible}>
                    <span>{responsible?.participantName ?? panelCopy.noResponsible}</span>
                  </PropertyRow>
                  <ParticipantsCard task={current} readOnly={readOnly} />
                  <DeadlineCard
                    task={current}
                    readOnly={readOnly}
                    today={today}
                    onUpdate={(changes) => update.mutate(changes)}
                  />
                  <PriorityProperty
                    task={current}
                    readOnly={readOnly}
                    onUpdate={(changes) => update.mutate(changes)}
                  />
                  {sprint ? (
                    <PropertyRow label={sprintCopy.sprintProperty}>{sprint}</PropertyRow>
                  ) : null}
                  <TicketProperty
                    task={current}
                    readOnly={readOnly}
                    onUpdate={(changes) => update.mutate(changes)}
                  />
                  {capabilities.showScreen('estimates.hours') ? (
                    <EstimateProperty task={current} readOnly={readOnly} />
                  ) : null}
                  {/* A regra é do projeto da tarefa (DeliverableProperty), não do projeto selecionado. */}
                  <DeliverableProperty task={current} readOnly={readOnly} />
                </div>
              </section>
              <ExternalPeopleSection task={current} readOnly={readOnly} />
            </div>

            <div className={styles.topicPanel} hidden={topic !== 'horas'}>
              <HoursSection task={current} readOnly={readOnly} />
            </div>

            <div className={styles.topicPanel} hidden={topic !== 'historico'}>
              <BlocksSection task={current} readOnly={readOnly} reasonInputRef={reasonInputRef} />
              <TimelineCard taskId={taskId} />
            </div>
          </div>
        </div>
      </div>
      {gate ? (
        <DodGateModal
          items={current.projectDefinitionOfDone}
          reopened={gate.reopened}
          saving={gate.saving}
          onCancel={() => setGate(null)}
          onConfirm={confirmGate}
        />
      ) : null}
    </section>
  )
}
