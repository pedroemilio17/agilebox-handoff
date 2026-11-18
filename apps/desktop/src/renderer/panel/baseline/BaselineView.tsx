import { useState } from 'react'
import { Button, EmptyState } from '@agilebox/ui'
import type { BaselineTaskDto, BaselineViewDto } from '@agilebox/contract'
import { ModuleEmptyState } from '../guide/ModuleEmptyState'
import { ModuleHelpButton } from '../guide/ModuleHelpButton'
import type { PanelView } from '../layout/PanelShell'
import { useBaseline, useTakeBaseline } from '../hooks/use-baseline'
import {
  BASELINE_GLYPHS,
  BASELINE_TONES,
  baselineCopy,
  dateText,
  deviationCaption,
  hoursValue,
  moneyValue,
  signedDays,
  signedHours,
  signedMoney,
  statusText,
  takenByText,
} from './baseline-screen'
import styles from './BaselineView.module.css'

export interface BaselineViewProps {
  /** Projeto selecionado no painel. Sem ele, a tela pede para escolher um. */
  readonly projectId: string | null
  readonly projectName: string | null
  /** Leva a outra tela (pelo painel de ajuda). */
  readonly onNavigate?: (view: PanelView) => void
}

/**
 * Linha de base: a foto do cronograma e do custo, com o desvio de cada tarefa e o resumo do projeto.
 * Só mostra o que o servidor calcula. Só o gestor tira a foto, e custo aparece só para ele.
 */
export function BaselineView({ projectId, projectName, onNavigate }: BaselineViewProps) {
  const query = useBaseline(projectId)

  if (projectId === null) {
    return (
      <section aria-label={baselineCopy.title} className={styles.view}>
        <EmptyState title={baselineCopy.noProject} />
      </section>
    )
  }

  if (query.isPending) {
    return (
      <section aria-label={baselineCopy.title} className={styles.view}>
        <p role="status" className={styles.muted}>
          {baselineCopy.loading}
        </p>
      </section>
    )
  }

  if (query.isError || !query.data) {
    return (
      <section aria-label={baselineCopy.title} className={styles.view}>
        <div role="alert" className={styles.errorBox}>
          <p className={styles.error}>{baselineCopy.loadError}</p>
          <Button type="button" onClick={() => void query.refetch()}>
            {baselineCopy.retry}
          </Button>
        </div>
      </section>
    )
  }

  const data = query.data
  if (data.baseline === null || data.summary === null) {
    return <NoBaseline data={data} projectId={projectId} onNavigate={onNavigate} />
  }

  const { baseline, summary, tasks } = data
  const showCost = data.costVisible

  return (
    <section aria-label={baselineCopy.title} className={styles.view}>
      <header className={styles.header}>
        <div className={styles.titleRow}>
          <h2 className={styles.title}>{baselineCopy.title}</h2>
          {projectName ? <span className={styles.subtitle}>{projectName}</span> : null}
          <ModuleHelpButton
            moduleId="baseline"
            projectId={projectId}
            {...(onNavigate ? { onNavigate } : {})}
          />
          <span className={styles.spacer} />
          {data.canTake ? <TakeControl projectId={projectId} label={baselineCopy.takeNew} /> : null}
        </div>
        <p className={styles.caption}>
          {baseline.name} · {takenByText(baseline.takenAt, baseline.takenByName)}
        </p>
      </header>

      <div className={styles.cards}>
        <section aria-label={baselineCopy.plannedEnd} className={styles.card}>
          <p className={styles.label}>{baselineCopy.plannedEnd}</p>
          <p className={styles.value}>{dateText(summary.plannedEnd)}</p>
        </section>

        <section aria-label={baselineCopy.currentEnd} className={styles.card}>
          <p className={styles.label}>{baselineCopy.currentEnd}</p>
          <p className={styles.value}>{dateText(summary.currentEnd)}</p>
        </section>

        <section
          aria-label={baselineCopy.deviation}
          className={
            summary.endDeviationDays !== null && summary.endDeviationDays > 0
              ? `${styles.card} ${styles.cardRisk}`
              : styles.card
          }
        >
          <p className={styles.label}>{baselineCopy.deviation}</p>
          <p className={styles.value}>{signedDays(summary.endDeviationDays)}</p>
          <p className={styles.caption}>{deviationCaption(summary.endDeviationDays)}</p>
        </section>

        <section aria-label={baselineCopy.hours} className={styles.card}>
          <p className={styles.label}>{baselineCopy.hours}</p>
          <p className={styles.value}>{hoursValue(summary.currentHours)}</p>
          <p className={styles.caption}>
            {hoursValue(summary.plannedHours)} {baselineCopy.hoursPlanned}
          </p>
        </section>

        {showCost ? (
          <section aria-label={baselineCopy.cost} className={styles.card}>
            <p className={styles.label}>{baselineCopy.cost}</p>
            <p className={styles.value}>{moneyValue(summary.currentCost)}</p>
            <p className={styles.caption}>
              {moneyValue(summary.plannedCost)} {baselineCopy.costPlanned}
            </p>
          </section>
        ) : null}
      </div>

      <section aria-labelledby="baseline-tasks" className={styles.panel}>
        <h3 id="baseline-tasks" className={styles.panelTitle}>
          {baselineCopy.tasks}
        </h3>
        {tasks.length === 0 ? (
          <p className={styles.muted}>{baselineCopy.noTasks}</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table} aria-label={baselineCopy.tasksList}>
              <thead>
                <tr>
                  <th scope="col">{baselineCopy.columns.task}</th>
                  <th scope="col">{baselineCopy.columns.status}</th>
                  <th scope="col">{baselineCopy.columns.plannedEnd}</th>
                  <th scope="col">{baselineCopy.columns.currentEnd}</th>
                  <th scope="col">{baselineCopy.columns.hours}</th>
                  {showCost ? <th scope="col">{baselineCopy.columns.cost}</th> : null}
                </tr>
              </thead>
              <tbody>
                {tasks.map((row) => (
                  <TaskRow key={row.taskId} row={row} showCost={showCost} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  )
}

/** Sem foto: o estado vazio explica o que é e oferece tirar a primeira (só o gestor). */
function NoBaseline({
  data,
  projectId,
  onNavigate,
}: {
  readonly data: BaselineViewDto
  readonly projectId: string
  readonly onNavigate?: ((view: PanelView) => void) | undefined
}) {
  return (
    <section aria-label={baselineCopy.title} className={styles.view}>
      <header className={styles.header}>
        <div className={styles.titleRow}>
          <h2 className={styles.title}>{baselineCopy.title}</h2>
          <ModuleHelpButton
            moduleId="baseline"
            projectId={projectId}
            {...(onNavigate ? { onNavigate } : {})}
          />
        </div>
      </header>
      <section aria-label={baselineCopy.title} className={styles.panel}>
        <ModuleEmptyState
          moduleId="baseline"
          projectId={projectId}
          fallbackTitle={baselineCopy.emptyTitle}
          fallbackDescription={baselineCopy.emptyDescription}
        >
          {data.canTake ? (
            <TakeControl projectId={projectId} label={baselineCopy.takeFirst} />
          ) : null}
        </ModuleEmptyState>
      </section>
    </section>
  )
}

/**
 * Botão "Tirar foto" com confirmação simples: um clique abre a pergunta, e só "Sim" grava. Quem não
 * é gestor não vê o botão (`canTake` vem do servidor).
 */
function TakeControl({ projectId, label }: { readonly projectId: string; readonly label: string }) {
  const take = useTakeBaseline(projectId)
  const [confirming, setConfirming] = useState(false)

  if (!confirming) {
    return (
      <Button
        type="button"
        onClick={() => {
          take.reset()
          setConfirming(true)
        }}
      >
        {label}
      </Button>
    )
  }

  return (
    <div role="group" aria-label={label} className={styles.confirm}>
      <p className={styles.caption}>{baselineCopy.takeQuestion}</p>
      <div className={styles.confirmActions}>
        <Button
          type="button"
          variant="primary"
          disabled={take.isPending}
          onClick={() => {
            take.mutate(undefined, { onSuccess: () => setConfirming(false) })
          }}
        >
          {take.isPending ? baselineCopy.taking : baselineCopy.takeYes}
        </Button>
        <Button type="button" disabled={take.isPending} onClick={() => setConfirming(false)}>
          {baselineCopy.takeNo}
        </Button>
      </div>
      {take.isError ? (
        <p role="alert" className={styles.error}>
          {baselineCopy.takeError}
        </p>
      ) : null}
    </div>
  )
}

function TaskRow({ row, showCost }: { readonly row: BaselineTaskDto; readonly showCost: boolean }) {
  return (
    <tr data-status={row.status}>
      <td className={styles.taskName}>{row.title}</td>
      <td>
        <span className={styles.status} data-tone={BASELINE_TONES[row.status]}>
          <span aria-hidden="true">{BASELINE_GLYPHS[row.status]}</span>
          {statusText(row)}
        </span>
      </td>
      <td className={styles.nums}>{dateText(row.plannedEndsOn)}</td>
      <td className={styles.nums}>{dateText(row.currentEndsOn)}</td>
      <td className={styles.nums}>{signedHours(row.hoursDelta)}</td>
      {showCost ? <td className={styles.nums}>{signedMoney(row.costDelta)}</td> : null}
    </tr>
  )
}
