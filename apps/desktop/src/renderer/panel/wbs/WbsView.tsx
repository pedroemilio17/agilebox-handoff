import { useState } from 'react'
import { AddButton, Button, EmptyState } from '@agilebox/ui'
import {
  useCreateDeliverable,
  useMoveDeliverable,
  useRemoveDeliverable,
  useRenameDeliverable,
  useWbs,
} from '../hooks/use-wbs'
import { ModuleHelpButton } from '../guide/ModuleHelpButton'
import type { PanelView } from '../layout/PanelShell'
import { todayDateOnly } from '../../shared/lib/today'
import { GuidedExample, GuidedStart, NewDeliverableForm, wbsCopy } from './WbsForms'
import { WbsTable } from './WbsTable'
import {
  actionErrorText,
  allCollapsed,
  collapseAll,
  collapseToggleLabel,
  expandableIds,
  formatCost,
  formatHours,
  isWbsEmpty,
  summaryCountText,
  visibleRows,
} from './wbs-screen'
import styles from './WbsView.module.css'

const copy = {
  title: 'Entregas',
  noProject: 'Escolha um projeto para ver as entregas.',
  loading: 'Carregando as entregas…',
  loadError: 'Não foi possível carregar as entregas deste projeto.',
  retry: 'Tentar de novo',
  readOnly: 'Só o gestor ou quem criou o projeto edita a EAP.',
  empty: 'Nenhuma entrega cadastrada.',
  footnote:
    'O último nível de cada entrega são tarefas: elas aparecem no quadro e no cronograma. Horas, custo e progresso sobem somando os filhos. Custo = horas × valor/hora de cada responsável.',
  footnoteNoCost:
    'O último nível de cada entrega são tarefas: elas aparecem no quadro e no cronograma. Horas e progresso sobem somando os filhos.',
  summary: 'Resumo',
  structure: 'Estrutura de entregas',
} as const

export interface WbsViewProps {
  /** Projeto selecionado no painel. Sem ele, a tela pede para escolher um. */
  readonly projectId: string | null
  /** Nome do projeto: a barra lateral já o mostra, então o cabeçalho da tela não repete. */
  readonly projectName?: string | null
  /** Leva a outra tela, pelo botão "Abrir as entregas" do guia e pelo painel de ajuda. */
  readonly onNavigate?: (view: PanelView) => void
}

/**
 * Entregas (EAP) do projeto: estrutura em árvore, totais por entrega e criação direta. Quem não
 * pode editar vê tudo em leitura. Toda ação espera o servidor: nada é alterado só na tela.
 */
export function WbsView({ projectId, onNavigate }: WbsViewProps) {
  const query = useWbs(projectId)
  const create = useCreateDeliverable()
  const rename = useRenameDeliverable()
  const move = useMoveDeliverable()
  const remove = useRemoveDeliverable()
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set())
  const [actionError, setActionError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  // Passo 1 aberto depois de criar a primeira entrega: continua até a pessoa fechar.
  const [guidedOpen, setGuidedOpen] = useState(false)

  if (projectId === null) {
    return (
      <section aria-label={copy.title} className={styles.view}>
        <EmptyState title={copy.noProject} />
      </section>
    )
  }

  if (query.isPending) {
    return (
      <section aria-label={copy.title} className={styles.view}>
        <p role="status" className={styles.muted}>
          {copy.loading}
        </p>
      </section>
    )
  }

  if (query.isError || !query.data) {
    return (
      <section aria-label={copy.title} className={styles.view}>
        <div role="alert" className={styles.errorBox}>
          <p className={styles.error}>{copy.loadError}</p>
          <Button type="button" onClick={() => void query.refetch()}>
            {copy.retry}
          </Button>
        </div>
      </section>
    )
  }

  const view = query.data
  const { canEdit, summary, costEnabled } = view
  const empty = isWbsEmpty(view)
  const showGuided = canEdit && (empty || guidedOpen)
  const rows = visibleRows(view.deliverables, collapsed)
  const toggleLabel = collapseToggleLabel(view.deliverables, collapsed)
  const hasExpandable = expandableIds(view.deliverables).length > 0

  async function createDeliverable(parentId: string | null, title: string): Promise<boolean> {
    setActionError(null)
    try {
      await create.mutateAsync({ projectId: projectId!, parentId, title })
      return true
    } catch (error) {
      setActionError(actionErrorText(error))
      return false
    }
  }

  async function renameDeliverable(deliverableId: string, title: string): Promise<boolean> {
    setActionError(null)
    try {
      await rename.mutateAsync({ deliverableId, title })
      return true
    } catch (error) {
      setActionError(actionErrorText(error))
      return false
    }
  }

  function moveDeliverable(deliverableId: string, parentId: string | null, position: number) {
    setActionError(null)
    move.mutate(
      { deliverableId, parentId, position },
      { onError: (error) => setActionError(actionErrorText(error)) },
    )
  }

  async function removeDeliverable(deliverableId: string): Promise<boolean> {
    setActionError(null)
    try {
      await remove.mutateAsync({ deliverableId })
      return true
    } catch (error) {
      setActionError(actionErrorText(error))
      return false
    }
  }

  function toggleCollapse() {
    setCollapsed(
      allCollapsed(view.deliverables, collapsed) ? new Set() : collapseAll(view.deliverables),
    )
  }

  return (
    <section aria-label={copy.title} className={styles.view}>
      <header className={styles.header}>
        <div className={styles.titleRow}>
          <h2 className={styles.title}>{copy.title}</h2>
          <span className={styles.tag}>EAP</span>
          <ModuleHelpButton
            moduleId="wbs"
            projectId={projectId}
            {...(onNavigate ? { onNavigate } : {})}
          />
          <span className={styles.spacer} />
          {hasExpandable && !empty ? (
            <Button type="button" onClick={toggleCollapse}>
              {toggleLabel}
            </Button>
          ) : null}
          {canEdit && !showGuided ? (
            <AddButton
              type="button"
              variant="primary"
              onClick={() => setAdding(true)}
              disabled={adding}
            >
              {wbsCopy.newDeliverable}
            </AddButton>
          ) : null}
        </div>
        {canEdit ? null : (
          <p role="note" className={styles.note}>
            {copy.readOnly}
          </p>
        )}
      </header>

      {actionError ? (
        <p role="alert" className={styles.error}>
          {actionError}
        </p>
      ) : null}

      {!empty ? (
        <section aria-label={copy.summary} className={styles.summary}>
          <div className={styles.metric}>
            <span className={styles.metricLabel}>Entregas</span>
            <span className={styles.metricValue}>
              {summaryCountText(summary.deliverables, summary.tasks)}
            </span>
          </div>
          <div className={styles.metric}>
            <span className={styles.metricLabel}>Horas</span>
            <span className={styles.metricValue}>{formatHours(summary.hours)}</span>
          </div>
          {costEnabled ? (
            <div className={styles.metric}>
              <span className={styles.metricLabel}>Custo previsto</span>
              <span className={styles.metricValue}>{formatCost(summary.cost)}</span>
            </div>
          ) : null}
          <div className={`${styles.metric} ${styles.metricWide}`}>
            <span className={styles.metricLabel}>Concluído</span>
            <span className={styles.progressLine}>
              <span className={styles.metricValue}>{summary.progress}%</span>
              <span className={`${styles.track} ${styles.trackSummary}`} aria-hidden="true">
                <span
                  className={`${styles.fill} ${styles.fillSummary}`}
                  style={{ width: `${summary.progress}%` }}
                />
              </span>
            </span>
          </div>
        </section>
      ) : null}

      {showGuided ? (
        <div className={empty ? styles.startGrid : undefined}>
          <GuidedStart
            onCreate={async (title) => {
              const created = await createDeliverable(null, title)
              if (created) setGuidedOpen(true)
              return created
            }}
            {...(empty ? {} : { onDone: () => setGuidedOpen(false) })}
          />
          {empty ? <GuidedExample /> : null}
        </div>
      ) : null}

      {adding && canEdit && !showGuided ? (
        <NewDeliverableForm
          label="Nome da nova entrega"
          onSubmit={(title) => createDeliverable(null, title)}
          onCancel={() => setAdding(false)}
        />
      ) : null}

      {empty && !canEdit ? <EmptyState title={copy.empty} /> : null}

      {!empty ? (
        <section aria-label={copy.structure} className={styles.card}>
          <WbsTable
            rows={rows}
            allRows={view.deliverables}
            collapsed={collapsed}
            canEdit={canEdit}
            costEnabled={costEnabled}
            today={todayDateOnly()}
            onToggle={(id) =>
              setCollapsed((current) => {
                const next = new Set(current)
                if (next.has(id)) next.delete(id)
                else next.add(id)
                return next
              })
            }
            onRename={renameDeliverable}
            onCreateChild={createDeliverable}
            onMove={moveDeliverable}
            onRemove={removeDeliverable}
          />
        </section>
      ) : null}

      {!empty ? (
        <div className={styles.footer}>
          <p className={styles.note}>{costEnabled ? copy.footnote : copy.footnoteNoCost}</p>
          {view.tasksWithoutDeliverable > 0 ? (
            <p className={styles.note}>
              {view.tasksWithoutDeliverable === 1
                ? '1 tarefa ainda não está em nenhuma entrega.'
                : `${view.tasksWithoutDeliverable} tarefas ainda não estão em nenhuma entrega.`}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
