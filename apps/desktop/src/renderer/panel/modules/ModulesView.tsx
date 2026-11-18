import { useEffect, useId, useState } from 'react'
import { Button, EmptyState } from '@agilebox/ui'
import { ApiError } from '@agilebox/contract'
import type { ProjectModuleDto, ProjectModulesChangeResultDto } from '@agilebox/contract'
import type { ModuleId } from '@agilebox/core'
import { useProjectModules } from '../hooks/use-project-modules'
import { useChangeProjectModules } from '../hooks/use-change-project-modules'
import { ModuleHistory } from './ModuleHistory'
import { ModuleHelpButton } from '../guide/ModuleHelpButton'
import type { PanelView } from '../layout/PanelShell'
import {
  buildModuleGroups,
  enabledIdsOf,
  namesJoined,
  previewLines,
  previewToggle,
  scheduledText,
  summarizeModules,
  type ModuleRow,
  type TogglePreview,
} from './modules-screen'
import styles from './ModulesView.module.css'

const copy = {
  title: 'Módulos',
  noProject: 'Escolha um projeto para ver os módulos.',
  loading: 'Carregando os módulos…',
  loadError: 'Não foi possível carregar os módulos deste projeto.',
  retry: 'Tentar de novo',
  intro: 'Ligue só o que este projeto usa. Os outros projetos do time não mudam.',
  legend: 'N1 essencial · N2 intermediário · N3 avançado',
  readOnly: 'Só o gestor muda os módulos do projeto.',
  archived: 'Projeto arquivado: as ferramentas não podem ser alteradas.',
  confirm: 'Confirmar',
  saving: 'Salvando…',
  cancel: 'Cancelar',
  saved: 'Módulos atualizados.',
  changeError: 'Não foi possível alterar os módulos. Tente de novo.',
  forbidden: 'Só o gestor muda os módulos do projeto.',
}

interface Pending {
  readonly moduleId: ModuleId
  readonly on: boolean
  readonly preview: TogglePreview
}

interface Feedback {
  readonly tone: 'status' | 'warning'
  readonly text: string
}

function errorText(error: unknown): string {
  if (error instanceof ApiError) {
    return error.code === 'FORBIDDEN' ? copy.forbidden : error.message
  }
  return copy.changeError
}

/** Resultado da gravação: o que foi feito, ou o aviso de sprint ativa (nada é agendado aqui). */
function feedbackOf(result: ProjectModulesChangeResultDto): Feedback {
  if (result.scheduled.length > 0) {
    return {
      tone: 'warning',
      text: result.scheduled.map((item) => scheduledText(item.moduleId, item.reason)).join(' '),
    }
  }
  const parts = [copy.saved]
  if (result.autoEnabled.length > 0) parts.push(`Ligado junto: ${namesJoined(result.autoEnabled)}.`)
  if (result.cascadeDisabled.length > 0)
    parts.push(`Desligado junto: ${namesJoined(result.cascadeDisabled)}. Nada foi apagado.`)
  return { tone: 'status', text: parts.join(' ') }
}

export interface ModulesViewProps {
  /** Projeto selecionado no painel. Sem ele, a tela pede para escolher um. */
  readonly projectId: string | null
  readonly projectName: string | null
  /** Projeto arquivado: a tela mostra o estado, mas não deixa mudar. */
  readonly archived: boolean
  /** Leva ao quadro, pelo botão "Rever os primeiros passos" do painel "Como funciona". */
  readonly onNavigate?: (view: PanelView) => void
}

/**
 * Módulos do projeto: liga e desliga ferramentas. Só o gestor altera; o colaborador vê tudo com os
 * interruptores desabilitados. Cada mudança passa por uma prévia (o que entra e sai junto) antes de
 * gravar.
 */
export function ModulesView({ projectId, projectName, archived, onNavigate }: ModulesViewProps) {
  const query = useProjectModules(projectId)
  const change = useChangeProjectModules(projectId ?? '')
  const idPrefix = useId()
  const [pending, setPending] = useState<Pending | null>(null)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Trocar de projeto descarta prévia, aviso e erro do projeto anterior.
  useEffect(() => {
    setPending(null)
    setFeedback(null)
    setError(null)
  }, [projectId])

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

  const modules: readonly ProjectModuleDto[] = query.data.modules
  const canManage = query.data.canManage
  const canEdit = canManage && !archived
  const groups = buildModuleGroups(modules)
  const summary = summarizeModules(modules)
  const enabledIds = enabledIdsOf(modules)
  const busy = change.isPending

  function askToggle(moduleId: ModuleId, on: boolean) {
    setError(null)
    setFeedback(null)
    setPending({ moduleId, on, preview: previewToggle(enabledIds, moduleId, on) })
  }

  function confirm() {
    if (!pending || pending.preview.refused) return
    const request = pending.on ? { enable: [pending.moduleId] } : { disable: [pending.moduleId] }
    change.mutate(request, {
      onSuccess: (result) => {
        setPending(null)
        setFeedback(feedbackOf(result))
      },
      onError: (failure) => {
        setPending(null)
        setError(errorText(failure))
      },
    })
  }

  function cancel() {
    const moduleId = pending?.moduleId
    setPending(null)
    if (moduleId) document.getElementById(switchId(moduleId))?.focus()
  }

  function switchId(moduleId: string) {
    return `${idPrefix}-switch-${moduleId}`
  }

  const pendingName = pending
    ? (groups.flatMap((group) => group.rows).find((row) => row.id === pending.moduleId)?.name ??
      pending.moduleId)
    : ''

  return (
    <section aria-label={copy.title} className={styles.view}>
      <header className={styles.header}>
        <span className={styles.eyebrow}>
          {projectName ? `Projeto · ${projectName}` : 'Projeto'}
        </span>
        <p className={styles.intro}>{copy.intro}</p>
        <div className={styles.summary}>
          <span className={styles.counter}>{`${summary.enabled} de ${summary.total} ligados`}</span>
          <span className={styles.divider} aria-hidden="true" />
          <span className={styles.legend}>{copy.legend}</span>
        </div>
        {canManage ? null : (
          <p role="note" className={styles.note}>
            {copy.readOnly}
          </p>
        )}
        {archived ? (
          <p role="note" className={styles.note}>
            {copy.archived}
          </p>
        ) : null}
      </header>

      <div role="status" aria-live="polite" className={styles.feedbackRegion}>
        {pending ? (
          <div className={styles.pendingBox}>
            <p className={styles.pendingTitle}>
              {pending.on ? `Ligar ${pendingName}?` : `Desligar ${pendingName}?`}
            </p>
            {previewLines(pending.moduleId, pending.preview).map((line) => (
              <p key={line} className={styles.pendingLine}>
                {line}
              </p>
            ))}
            <div className={styles.pendingActions}>
              {pending.preview.refused ? null : (
                <Button type="button" autoFocus disabled={busy} onClick={confirm}>
                  {busy ? copy.saving : copy.confirm}
                </Button>
              )}
              <Button type="button" disabled={busy} onClick={cancel}>
                {copy.cancel}
              </Button>
            </div>
          </div>
        ) : feedback ? (
          <p className={feedback.tone === 'warning' ? styles.warning : styles.saved}>
            {feedback.text}
          </p>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}

      {groups.map((group, index) => (
        <section
          key={group.title}
          aria-labelledby={`${idPrefix}-group-${index}`}
          className={styles.group}
        >
          <h2 id={`${idPrefix}-group-${index}`} className={styles.groupTitle}>
            {group.title}
          </h2>
          <div className={styles.grid}>
            {group.rows.map((row) => (
              <ModuleCard
                key={row.id}
                row={row}
                projectId={projectId}
                switchDomId={switchId(row.id)}
                canEdit={canEdit && !busy}
                dotState={row.windingDown ? 'winding_down' : row.enabled ? 'active' : 'disabled'}
                {...(onNavigate ? { onNavigate } : {})}
                onToggle={(on) => askToggle(row.id, on)}
              />
            ))}
          </div>
        </section>
      ))}

      <ModuleHistory projectId={projectId} />
    </section>
  )
}

interface ModuleCardProps {
  readonly row: ModuleRow
  readonly projectId: string
  readonly switchDomId: string
  readonly canEdit: boolean
  readonly dotState: ProjectModuleDto['state']
  readonly onNavigate?: (view: PanelView) => void
  readonly onToggle: (on: boolean) => void
}

function ModuleCard({
  row,
  projectId,
  switchDomId,
  canEdit,
  dotState,
  onNavigate,
  onToggle,
}: ModuleCardProps) {
  const titleId = useId()
  return (
    <article className={styles.card} aria-labelledby={titleId}>
      <div className={styles.cardTop}>
        <span className={styles.dot} data-state={dotState} aria-hidden="true" />
        <h3 id={titleId} className={styles.name}>
          {row.name}
        </h3>
        {row.levelTag ? <span className={styles.tag}>{row.levelTag}</span> : null}
        <span className={styles.spacer} />
        <ModuleHelpButton
          moduleId={row.id}
          projectId={projectId}
          {...(onNavigate ? { onNavigate } : {})}
        />
        <button
          type="button"
          id={switchDomId}
          role="switch"
          aria-checked={row.enabled}
          aria-label={row.enabled ? `Desligar ${row.name}` : `Ligar ${row.name}`}
          className={styles.switch}
          disabled={!canEdit}
          onClick={() => onToggle(!row.enabled)}
        >
          <span className={styles.track} aria-hidden="true">
            <span className={styles.thumb} />
          </span>
        </button>
      </div>
      <p className={styles.objective}>{row.objective}</p>
      <div className={styles.cardBottom}>
        <span className={styles.dependency}>{row.dependency}</span>
        <span className={styles.spacer} />
        {row.signals.map((signal) => (
          <span key={signal} className={styles.signal}>
            {signal}
          </span>
        ))}
      </div>
    </article>
  )
}
