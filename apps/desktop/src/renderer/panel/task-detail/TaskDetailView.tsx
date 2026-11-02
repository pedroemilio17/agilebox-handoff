import { useEffect, useId, useRef, useState } from 'react'
import { TASK_STATUS_LABELS } from '@agilebox/core'
import type { DateOnly, TaskFieldId, TaskStatus } from '@agilebox/core'
import { Button, GlassMenu, IconButton, ReadOnlyBadge } from '@agilebox/ui'
import { useApi } from '../../shared/api/ApiProvider'
import { todayDateOnly } from '../../shared/lib/today'
import { panelCopy } from '../copy'
import { useDismissOnOutside } from '../hooks/use-dismiss-on-outside'
import { useTeamCapabilities } from '../hooks/use-team-capabilities'
import { AcceptanceCard } from './AcceptanceCard'
import { CostCard } from './CostCard'
import { DeadlineCard } from './DeadlineCard'
import { EstimateField } from './EstimateField'
import { StatusProperty, TicketProperty, TaskDescription } from './DetailsCard'
import { PropertyRow } from './PropertyRow'
import { ParticipantsCard } from './ParticipantsCard'
import { SaveError } from './SaveError'
import { TimelineCard } from './TimelineCard'
import { detailFieldLayout } from './task-layout'
import { useBlurSave } from './use-blur-save'
import { useTaskArchive } from './use-task-archive'
import { useMoveTaskStatus, useTaskDetail, useUpdateTask } from './use-task-detail'
import styles from './TaskDetailView.module.css'

/** Barra lateral: ali F2 e E são de quem tem o foco (renomear ou arquivar um projeto). */
function isInSidebar(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest('nav') !== null
}

/** Campo de texto ou editor: ali as teclas de letra são do próprio campo. */
function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])') !==
      null
  )
}

export interface TaskDetailViewProps {
  readonly fullScreen?: boolean
  readonly onToggleFullScreen?: () => void
  readonly taskId: string
  readonly onBack: () => void
  readonly today?: DateOnly
}

export function TaskDetailView({
  taskId,
  onBack,
  fullScreen = false,
  onToggleFullScreen,
  today = todayDateOnly(),
}: TaskDetailViewProps) {
  const api = useApi()
  const detail = useTaskDetail(taskId)
  const update = useUpdateTask(taskId)
  const move = useMoveTaskStatus(taskId)
  const capabilities = useTeamCapabilities()
  const layout = detailFieldLayout(capabilities.data)
  const shows = (field: TaskFieldId) => layout.visible.includes(field)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const advancedId = useId()
  const [menuOpen, setMenuOpen] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)
  const menuAnchorRef = useRef<HTMLDivElement>(null)
  useDismissOnOutside(menuAnchorRef, menuOpen, () => setMenuOpen(false))
  const archive = useTaskArchive(taskId, detail.data?.title ?? '')
  const archiving = useRef(false)
  const task = detail.data
  const editable = task !== undefined && !task.readOnly
  const title = useBlurSave(task?.title ?? '', (next) => {
    if (next.trim() !== '') update.mutate({ title: next.trim() })
  })

  function archiveNow() {
    if (archiving.current) return
    archiving.current = true
    archive.mutate(undefined, {
      onSuccess: () => onBack(),
      onSettled: () => {
        archiving.current = false
      },
    })
  }

  // O atalho lê a ação do último render sem reprender o efeito a cada render.
  const archiveRef = useRef(archiveNow)
  useEffect(() => {
    archiveRef.current = archiveNow
  })

  useEffect(() => {
    if (!editable) return
    const onKeyDown = (event: KeyboardEvent) => {
      // Outro controle já usou a tecla (ex.: F2 para renomear um projeto na barra lateral).
      if (event.defaultPrevented) return
      // Shift+E não é o atalho de arquivar: só E puro.
      if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return
      if (event.repeat || event.isComposing) return
      const key = event.key.toLowerCase()
      if (key !== 'f2' && key !== 'e') return
      if (isTyping(event.target) || isInSidebar(event.target)) return
      if (document.querySelector('[role="menu"], [role="dialog"][aria-modal="true"]')) return
      event.preventDefault()
      if (key === 'f2') {
        titleRef.current?.focus()
        titleRef.current?.select()
      } else {
        archiveRef.current()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [editable])

  useEffect(() => {
    void api.tasks.recordOpen({ taskId }).catch(() => undefined)
  }, [api, taskId])

  const backButton = onToggleFullScreen ? (
    <IconButton
      key="back"
      type="button"
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
    </IconButton>
  ) : (
    <Button key="back" type="button" onClick={onBack}>
      ← {panelCopy.backToBoard}
    </Button>
  )

  if (detail.isPending) {
    return (
      <section aria-label={panelCopy.taskDetail} className={styles.view}>
        <header className={styles.header}>{backButton}</header>
        <p role="status">{panelCopy.taskDetailLoading}</p>
      </section>
    )
  }
  if (detail.isError) {
    return (
      <section aria-label={panelCopy.taskDetail} className={styles.view}>
        <header className={styles.header}>{backButton}</header>
        <p role="alert">{panelCopy.taskDetailError}</p>
      </section>
    )
  }

  const readOnly = task!.readOnly

  return (
    <section aria-label={panelCopy.taskDetail} className={styles.view}>
      <header className={styles.header}>
        <span className={styles.projectLabel}>{task!.projectName}</span>
        {onToggleFullScreen && (
          <IconButton
            type="button"
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
          </IconButton>
        )}
        {readOnly ? null : (
          <div ref={menuAnchorRef} className={styles.menuAnchor}>
            <IconButton
              type="button"
              aria-label="Mais ações da tarefa"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <svg
                aria-hidden="true"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <circle cx="5" cy="12" r="1.8" />
                <circle cx="12" cy="12" r="1.8" />
                <circle cx="19" cy="12" r="1.8" />
              </svg>
            </IconButton>
            {menuOpen ? (
              // Esc fecha só o menu: não pode chegar ao Drawer, que fecharia o detalhe.
              <div
                className={styles.menuPopover}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') event.stopPropagation()
                }}
              >
                <GlassMenu
                  label="Ações da tarefa"
                  items={[{ id: 'archive', label: 'Arquivar', shortcut: 'E' }]}
                  onSelect={(id) => {
                    if (id === 'archive') archiveNow()
                  }}
                  onClose={() => setMenuOpen(false)}
                />
              </div>
            ) : null}
          </div>
        )}
        {backButton}
        {readOnly ? <ReadOnlyBadge /> : null}
      </header>
      <input
        ref={titleRef}
        aria-label={panelCopy.taskTitle}
        className={styles.title}
        disabled={readOnly}
        value={title.value}
        onChange={(event) => title.onChange(event.currentTarget.value)}
        onFocus={title.onFocus}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            event.currentTarget.blur()
          } else if (event.key === 'Escape' && title.value !== (task?.title ?? title.value)) {
            // Com texto diferente do gravado, Esc só cancela a edição e o foco fica no campo.
            // Sem mudança, Esc segue e fecha o detalhe, como antes.
            event.preventDefault()
            event.stopPropagation()
            title.cancel()
          } else if (event.key === 'F2') {
            event.preventDefault()
            event.currentTarget.select()
          }
        }}
        onBlur={() => {
          if (title.value.trim() === '') title.onChange(task!.title)
          title.onBlur()
        }}
      />
      <SaveError error={update.error ?? move.error ?? archive.error} />
      {(task!.agingDays ?? 0) > 4 && (
        <aside className={styles.agingAlert} aria-label="Tarefa parada">
          <p>
            Parada há {task!.agingDays} dias em {TASK_STATUS_LABELS[task!.status]}. Algo está
            travando?
          </p>
          <Button
            type="button"
            disabled={readOnly || update.isPending}
            onClick={() => update.mutate({ progressConfirmed: true })}
          >
            Segue em andamento
          </Button>
        </aside>
      )}
      <dl className={styles.properties}>
        {shows('status') ? (
          <StatusProperty
            task={task!}
            readOnly={readOnly}
            onMove={(status: TaskStatus) => move.mutate(status)}
          />
        ) : null}
        {shows('assignees') ? (
          <>
            <PropertyRow label={panelCopy.responsible}>
              {task!.participations.find((person) => person.role === 'responsible')
                ?.participantName ?? panelCopy.noResponsible}
            </PropertyRow>
            <ParticipantsCard task={task!} readOnly={readOnly} />
          </>
        ) : null}
        {shows('due') ? (
          <DeadlineCard
            task={task!}
            readOnly={readOnly}
            today={today}
            onUpdate={(changes) => update.mutate(changes)}
          />
        ) : null}
        <TicketProperty
          task={task!}
          readOnly={readOnly}
          onUpdate={(changes) => update.mutate(changes)}
        />
        {shows('estimate') ? <EstimateField task={task!} readOnly={readOnly} /> : null}
        {shows('estimate') || shows('hourlyCost') ? (
          <CostCard
            task={task!}
            readOnly={readOnly}
            showHours={shows('estimate')}
            showRate={shows('hourlyCost')}
          />
        ) : null}
      </dl>
      {layout.collapsed.length > 0 ? (
        <div className={styles.advanced}>
          <button
            type="button"
            className={styles.disclosure}
            aria-expanded={advancedOpen}
            aria-controls={advancedId}
            onClick={() => setAdvancedOpen((open) => !open)}
          >
            Campos avançados
            <span aria-hidden="true" className={styles.disclosureMark}>
              {advancedOpen ? '▴' : '▾'}
            </span>
          </button>
          <div id={advancedId} hidden={!advancedOpen} className={styles.advancedBody}>
            {layout.collapsed.includes('hourlyCost') ? (
              <dl className={styles.properties}>
                <CostCard task={task!} readOnly={readOnly} showHours={false} showRate />
              </dl>
            ) : null}
          </div>
        </div>
      ) : null}
      <TaskDescription
        task={task!}
        readOnly={readOnly}
        onUpdate={(changes) => update.mutate(changes)}
      />
      {shows('acceptanceCriteria') ? <AcceptanceCard taskId={taskId} readOnly={readOnly} /> : null}
      {shows('timeline') ? <TimelineCard taskId={taskId} /> : null}
    </section>
  )
}
