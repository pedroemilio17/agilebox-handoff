import { useState } from 'react'
import { Button, EmptyState } from '@agilebox/ui'
import { useCapabilities } from '../../shared/capabilities/capabilities-context'
import { ModuleEmptyState } from '../guide/ModuleEmptyState'
import { ModuleHelpButton } from '../guide/ModuleHelpButton'
import type { PanelView } from '../layout/PanelShell'
import { useWbs } from '../hooks/use-wbs'
import { useBaseline } from '../hooks/use-baseline'
import { useSchedule } from '../hooks/use-schedule'
import { ScheduleDependencies } from './ScheduleDependencies'
import { ScheduleGantt } from './ScheduleGantt'
import { ScheduleTaskTable } from './ScheduleTaskTable'
import {
  baselineDayMonth,
  conflictSummary,
  fullDate,
  groupTasks,
  SCALE_LABELS,
  type ScheduleScale,
} from './schedule-screen'
import styles from './ScheduleView.module.css'

export const scheduleCopy = {
  title: 'Cronograma',
  baselineSwitch: 'Linha de base de',
  alertNote: 'Ver acompanhamento',
  noProject: 'Escolha um projeto para ver o cronograma.',
  loading: 'Carregando o cronograma…',
  loadError: 'Não foi possível carregar o cronograma deste projeto.',
  retry: 'Tentar de novo',
  scale: 'Escala',
  legend: 'Legenda',
  inProgress: 'Em andamento',
  done: 'Concluída',
  late: 'Atrasada em relação à base',
  baseline: 'Linha de base',
  milestone: 'Marco',
  today: 'Hoje',
  alert: 'Conflitos de dependência',
  alertTag: 'Atenção',
  emptyFallback: 'Nenhuma tarefa com datas ainda.',
} as const

export interface ScheduleViewProps {
  /** Projeto selecionado no painel. Sem ele, a tela pede para escolher um. */
  readonly projectId: string | null
  /** Nome do projeto: a barra lateral já o mostra, então o cabeçalho da tela não repete. */
  readonly projectName?: string | null
  /** Leva a outra tela, pelo painel de ajuda. */
  readonly onNavigate?: (view: PanelView) => void
}

/**
 * Cronograma do projeto: Gantt com escala Semanas ou Meses, lista de datas e dependências. Só quem
 * pode editar a tarefa altera as datas e as dependências dela. Toda ação espera o servidor.
 */
export function ScheduleView({ projectId, onNavigate }: ScheduleViewProps) {
  const capabilities = useCapabilities()
  // A EAP só agrupa o Gantt quando o módulo `wbs` está ligado no projeto selecionado.
  const wbsOn = capabilities.showScreen('wbs')
  const query = useSchedule(projectId)
  const wbs = useWbs(wbsOn ? projectId : null)
  // Linha de base: só com o módulo `baseline` ligado e uma foto tirada. Liga e desliga na tela.
  const baselineOn = capabilities.showScreen('baseline')
  const baselineQuery = useBaseline(baselineOn ? projectId : null)
  const [scale, setScale] = useState<ScheduleScale>('weeks')
  const [showBaseline, setShowBaseline] = useState(true)
  const baselinePhoto = baselineQuery.data?.baseline ?? null
  const baselineMap =
    showBaseline && baselinePhoto !== null
      ? new Map((baselineQuery.data?.tasks ?? []).map((task) => [task.taskId, task] as const))
      : null

  if (projectId === null) {
    return (
      <section aria-label={scheduleCopy.title} className={styles.view}>
        <EmptyState title={scheduleCopy.noProject} />
      </section>
    )
  }

  if (query.isPending) {
    return (
      <section aria-label={scheduleCopy.title} className={styles.view}>
        <p role="status" className={styles.muted}>
          {scheduleCopy.loading}
        </p>
      </section>
    )
  }

  if (query.isError || !query.data) {
    return (
      <section aria-label={scheduleCopy.title} className={styles.view}>
        <div role="alert" className={styles.errorBox}>
          <p className={styles.error}>{scheduleCopy.loadError}</p>
          <Button type="button" onClick={() => void query.refetch()}>
            {scheduleCopy.retry}
          </Button>
        </div>
      </section>
    )
  }

  const view = query.data
  const groups = groupTasks(view.tasks, wbsOn ? wbs.data : undefined)
  const tableRows = groups.flatMap((group) =>
    group.tasks.map((task) => ({ task, deliverableTitle: group.title })),
  )
  const conflict = conflictSummary(view.dependencies, view.tasks)

  return (
    <section aria-label={scheduleCopy.title} className={styles.view}>
      <header className={styles.header}>
        <div className={styles.titleRow}>
          <h2 className={styles.title}>{scheduleCopy.title}</h2>
          {view.range ? (
            <span className={styles.range}>
              {fullDate(view.range.start)} → {fullDate(view.range.end)}
            </span>
          ) : null}
          <ModuleHelpButton
            moduleId="schedule"
            projectId={projectId}
            {...(onNavigate ? { onNavigate } : {})}
          />
          <span className={styles.spacer} />
          <div role="group" aria-label={scheduleCopy.scale} className={styles.segmented}>
            {(Object.keys(SCALE_LABELS) as ScheduleScale[]).map((option) => (
              <button
                key={option}
                type="button"
                className={styles.segment}
                aria-pressed={scale === option}
                onClick={() => setScale(option)}
              >
                {SCALE_LABELS[option]}
              </button>
            ))}
          </div>
          {baselinePhoto !== null ? (
            <button
              type="button"
              role="switch"
              aria-checked={showBaseline}
              className={styles.switch}
              onClick={() => setShowBaseline((current) => !current)}
            >
              <span className={styles.track} data-on={showBaseline} aria-hidden="true">
                <span className={styles.knob} />
              </span>
              {`${scheduleCopy.baselineSwitch} ${baselineDayMonth(baselinePhoto.takenAt)}`}
            </button>
          ) : null}
        </div>
      </header>

      <ul className={styles.legend} aria-label={scheduleCopy.legend}>
        <li>
          <span className={`${styles.swatch} ${styles.swatchInProgress}`} aria-hidden="true" />
          {scheduleCopy.inProgress}
        </li>
        <li>
          <span className={`${styles.swatch} ${styles.swatchDone}`} aria-hidden="true" />
          {scheduleCopy.done}
        </li>
        <li>
          <span className={`${styles.swatch} ${styles.swatchLate}`} aria-hidden="true" />
          {scheduleCopy.late}
        </li>
        <li>
          <span className={`${styles.swatch} ${styles.swatchLine}`} aria-hidden="true" />
          {scheduleCopy.baseline}
        </li>
        <li>
          <span className={`${styles.swatch} ${styles.swatchDiamond}`} aria-hidden="true" />
          {scheduleCopy.milestone}
        </li>
        <li>
          <span className={`${styles.swatch} ${styles.swatchToday}`} aria-hidden="true" />
          {scheduleCopy.today}
        </li>
      </ul>

      {view.range === null ? (
        <ModuleEmptyState
          moduleId="schedule"
          projectId={projectId}
          fallbackTitle={scheduleCopy.emptyFallback}
        />
      ) : (
        <ScheduleGantt
          range={view.range}
          today={view.today}
          scale={scale}
          groups={groups}
          view={view}
          baseline={baselineMap}
        />
      )}

      {view.tasks.length > 0 ? <ScheduleTaskTable rows={tableRows} today={view.today} /> : null}

      {view.tasks.length > 0 ? (
        <ScheduleDependencies tasks={view.tasks} dependencies={view.dependencies} />
      ) : null}

      {conflict ? (
        <section aria-label={scheduleCopy.alert} className={styles.alert}>
          <span className={styles.alertTag}>{scheduleCopy.alertTag}</span>
          <p className={styles.alertText}>{conflict}</p>
          {onNavigate ? (
            <Button type="button" onClick={() => onNavigate('tracking')}>
              {scheduleCopy.alertNote}
            </Button>
          ) : null}
        </section>
      ) : null}
    </section>
  )
}
