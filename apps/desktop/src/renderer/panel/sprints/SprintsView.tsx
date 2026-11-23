import { useId, useRef, useState } from 'react'
import type { TaskStatus } from '@agilebox/core'
import type { ProjectDto, SprintDto, TaskDto } from '@agilebox/contract'
import { EmptyState, SegmentedControl, Toast, Button } from '@agilebox/ui'
import type { SegmentedOption } from '@agilebox/ui'
import { useCapabilities } from '../../shared/capabilities/capabilities-context'
import { useActor } from '../../shared/session/useActor'
import { useBacklogProjects } from '../backlog/use-backlog'
import { useBurndown } from '../hooks/use-burndown'
import { ActiveTab } from './ActiveTab'
import { ClosedTab } from './ClosedTab'
import { DraftsTab } from './DraftsTab'
import { ModuleHelpButton } from '../guide/ModuleHelpButton'
import type { PanelView } from '../layout/PanelShell'
import { sprintCopy } from './sprint-copy'
import { useSprintList } from './use-sprints'
import styles from './SprintsView.module.css'

type SprintTab = 'draft' | 'active' | 'closed'

const TAB_OPTIONS: readonly [
  SegmentedOption<SprintTab>,
  SegmentedOption<SprintTab>,
  ...SegmentedOption<SprintTab>[],
] = [
  { value: 'draft', label: sprintCopy.tabDraft },
  { value: 'active', label: sprintCopy.tabActive },
  { value: 'closed', label: sprintCopy.tabClosed },
]

export interface SprintsViewProps {
  /** Leva ao quadro, pelo botão "Rever os primeiros passos" do painel "Como funciona". */
  readonly onNavigate?: (view: PanelView) => void
  /** Projeto que já estava selecionado no painel, se houver. */
  readonly initialProjectId?: string | null
  /** Projetos ativos (arquivados ficam de fora, como no Backlog). */
  readonly projects: readonly ProjectDto[]
  readonly isManager: boolean
  readonly onOpenTask: (taskId: string) => void
  /** Abre o diálogo de nova tarefa (o do topo da janela). */
  readonly onNewTask?: () => void
  /** Move tarefa no quadro da sprint ativa (repassado do App para compartilhar conferência de DoD). */
  readonly onMoveTask?: (task: TaskDto, status: TaskStatus) => void
}

/**
 * Tela de Sprints (Intermediário em diante). Três abas: Planejamento (rascunhos), Ativa e
 * Encerradas. A situação do módulo (encerrando) só tira o que cria; o resto segue editável.
 */
export function SprintsView({
  initialProjectId = null,
  projects,
  isManager,
  onOpenTask,
  onNavigate,
  onNewTask,
  onMoveTask,
}: SprintsViewProps) {
  const capabilities = useCapabilities()
  const actor = useActor()
  const visible = useBacklogProjects(projects, isManager, actor.actor?.userId)
  const [chosenProjectId, setChosenProjectId] = useState<string | null>(initialProjectId)
  // Escolha que não está mais na lista cai no primeiro projeto visível (mesma regra do Backlog).
  const projectId =
    visible.projects.find((project) => project.id === chosenProjectId)?.id ??
    visible.projects[0]?.id ??
    null
  const selectId = useId()
  const [tab, setTab] = useState<SprintTab>('draft')
  const [preferredDraftId, setPreferredDraftId] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ id: number; message: string } | null>(null)
  const noticeSeq = useRef(0)
  const list = useSprintList(projectId)
  // Burndown dá a velocidade (planejamento) e o dia, o atraso e a miniatura (sprint ativa).
  const burndownQuery = useBurndown(capabilities.showScreen('burndown') ? projectId : null)
  const burndown = burndownQuery.data ?? null

  const windingDown = capabilities.isWindingDown('sprints')
  // Cerimônias são agendamentos da Agenda, criados pelo gestor (ADR-10). Exigem as duas ferramentas.
  const ceremoniesVisible =
    isManager && capabilities.showScreen('reviewRetro') && capabilities.showScreen('agenda')
  const showEstimates = capabilities.can('estimates.hours:passive')
  const all: readonly SprintDto[] = list.data ?? []
  const drafts = all
    .filter((sprint) => sprint.status === 'draft')
    .sort((a, b) => a.number - b.number)
  const actives = all
    .filter((sprint) => sprint.status === 'active')
    .sort((a, b) => a.number - b.number)
  const closed = all
    .filter((sprint) => sprint.status === 'closed')
    .sort((a, b) => b.number - a.number)

  const announce = (message: string) => {
    noticeSeq.current += 1
    setNotice({ id: noticeSeq.current, message })
  }

  return (
    <section aria-label={sprintCopy.title} className={styles.view}>
      <div className={styles.toolbar}>
        <label className={styles.projectField} htmlFor={selectId}>
          <span className={styles.label}>{sprintCopy.project}</span>
          <select
            id={selectId}
            className={styles.select}
            value={projectId ?? ''}
            disabled={visible.projects.length === 0}
            onChange={(event) => setChosenProjectId(event.currentTarget.value)}
          >
            {visible.projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </label>
        <ModuleHelpButton
          moduleId="sprints"
          projectId={projectId}
          {...(onNavigate ? { onNavigate } : {})}
        />
        {projectId === null ? null : (
          <SegmentedControl<SprintTab>
            aria-label={sprintCopy.tabsLabel}
            options={TAB_OPTIONS}
            value={tab}
            onChange={setTab}
          />
        )}
      </div>

      {projectId === null ? (
        visible.pending ? (
          <p role="status" className={styles.hint}>
            {sprintCopy.loading}
          </p>
        ) : (
          <EmptyState title={sprintCopy.noProjects} />
        )
      ) : list.isPending ? (
        <p role="status" className={styles.hint}>
          {sprintCopy.loading}
        </p>
      ) : list.isError ? (
        <div role="alert" className={styles.errorBox}>
          <p>{sprintCopy.error}</p>
          <Button type="button" onClick={() => void list.refetch()}>
            {sprintCopy.retry}
          </Button>
        </div>
      ) : tab === 'draft' ? (
        <DraftsTab
          projectId={projectId}
          drafts={drafts}
          windingDown={windingDown}
          showEstimates={showEstimates}
          onOpenTask={onOpenTask}
          onStarted={() => setTab('active')}
          onNotify={announce}
          preferredId={preferredDraftId}
          burndown={burndown}
        />
      ) : tab === 'active' ? (
        <ActiveTab
          projectId={projectId}
          actives={actives}
          windingDown={windingDown}
          showEstimates={showEstimates}
          onOpenTask={onOpenTask}
          onNotify={announce}
          ceremoniesVisible={ceremoniesVisible}
          burndown={burndown}
          {...(onNavigate ? { onNavigate } : {})}
          {...(onNewTask ? { onNewTask } : {})}
          {...(onMoveTask ? { onMoveTask } : {})}
        />
      ) : (
        <ClosedTab
          projectId={projectId}
          closed={closed}
          windingDown={windingDown}
          onNotify={announce}
          onReplanned={(draftId) => {
            setPreferredDraftId(draftId)
            setTab('draft')
          }}
        />
      )}

      {notice ? <Toast key={notice.id} message={notice.message} /> : null}
    </section>
  )
}
