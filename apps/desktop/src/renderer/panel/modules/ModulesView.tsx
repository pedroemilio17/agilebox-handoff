import { useEffect, useId, useState } from 'react'
import { Button, EmptyState } from '@agilebox/ui'
import { ApiError } from '@agilebox/contract'
import type { ProjectModuleDto, ProjectModulesChangeResultDto } from '@agilebox/contract'
import type { ModuleId, ProjectPresetKey } from '@agilebox/core'
import { useProjectModules } from '../hooks/use-project-modules'
import { useChangeProjectModules } from '../hooks/use-change-project-modules'
import { ModuleHistory } from './ModuleHistory'
import { ModuleHelpButton } from '../guide/ModuleHelpButton'
import type { PanelView } from '../layout/PanelShell'
import {
  buildModuleGroups,
  effectsOf,
  enabledIdsOf,
  linkedOf,
  namesJoined,
  previewToggle,
  scheduledText,
  startedFromText,
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
  panelLabel: 'Mudança · aguardando confirmação',
  panelLabelDone: 'Mudança não feita',
  effects: 'O que acontece',
  footnote: 'Nada é apagado. Religar restaura os dados.',
  confirm: 'Confirmar',
  saving: 'Salvando…',
  cancel: 'Cancelar',
  close: 'Fechar',
  saved: 'Módulos atualizados.',
  changeError: 'Não foi possível alterar os módulos. Tente de novo.',
  forbidden: 'Só o gestor muda os módulos do projeto.',
}

interface Pending {
  readonly moduleId: ModuleId
  readonly on: boolean
  readonly preview: TogglePreview
}

/** Aviso da gravação que não foi feita (ex.: Sprints com sprint ativa), mostrado no painel. */
interface Notice {
  readonly title: string
  readonly text: string
}

function errorText(error: unknown): string {
  if (error instanceof ApiError) {
    return error.code === 'FORBIDDEN' ? copy.forbidden : error.message
  }
  return copy.changeError
}

/** Resultado da gravação: "Módulos atualizados" ou o aviso de sprint ativa (nada é agendado aqui). */
function outcomeOf(result: ProjectModulesChangeResultDto): {
  readonly saved: string | null
  readonly notice: string | null
} {
  if (result.scheduled.length > 0) {
    return {
      saved: null,
      notice: result.scheduled.map((item) => scheduledText(item.moduleId, item.reason)).join(' '),
    }
  }
  const parts = [copy.saved]
  if (result.autoEnabled.length > 0) parts.push(`Ligado junto: ${namesJoined(result.autoEnabled)}.`)
  if (result.cascadeDisabled.length > 0)
    parts.push(`Desligado junto: ${namesJoined(result.cascadeDisabled)}. Nada foi apagado.`)
  return { saved: parts.join(' '), notice: null }
}

export interface ModulesViewProps {
  /** Projeto selecionado no painel. Sem ele, a tela pede para escolher um. */
  readonly projectId: string | null
  readonly projectName: string | null
  /** Preset em que o projeto começou, para o selo "Começou como …". */
  readonly startedFromPreset?: ProjectPresetKey | null
  /** Projeto arquivado: a tela mostra o estado, mas não deixa mudar. */
  readonly archived: boolean
  /** Leva ao quadro, pelo botão "Rever os primeiros passos" do painel "Como funciona". */
  readonly onNavigate?: (view: PanelView) => void
}

/**
 * Módulos do projeto: liga e desliga ferramentas. Só o gestor altera; o colaborador vê tudo com os
 * interruptores desabilitados. Cada mudança passa por uma prévia no painel lateral (o que entra e
 * sai junto) antes de gravar.
 */
export function ModulesView({
  projectId,
  projectName,
  startedFromPreset,
  archived,
  onNavigate,
}: ModulesViewProps) {
  const query = useProjectModules(projectId)
  const change = useChangeProjectModules(projectId ?? '')
  const idPrefix = useId()
  const [pending, setPending] = useState<Pending | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Trocar de projeto descarta prévia, aviso e erro do projeto anterior.
  useEffect(() => {
    setPending(null)
    setSaved(null)
    setNotice(null)
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
  const started = startedFromText(startedFromPreset)
  const rows = groups.flatMap((group) => group.rows)
  const rowOf = (moduleId: ModuleId) => rows.find((row) => row.id === moduleId)

  function askToggle(moduleId: ModuleId, on: boolean) {
    setError(null)
    setSaved(null)
    setNotice(null)
    setPending({ moduleId, on, preview: previewToggle(enabledIds, moduleId, on) })
  }

  function confirm() {
    if (!pending || pending.preview.refused) return
    const moduleId = pending.moduleId
    const title = `${pending.on ? 'Ligar' : 'Desligar'} ${rowOf(moduleId)?.name ?? moduleId}`
    const request = pending.on ? { enable: [moduleId] } : { disable: [moduleId] }
    change.mutate(request, {
      onSuccess: (result) => {
        const outcome = outcomeOf(result)
        setPending(null)
        setSaved(outcome.saved)
        setNotice(outcome.notice ? { title, text: outcome.notice } : null)
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

  function dismissNotice() {
    setNotice(null)
  }

  function switchId(moduleId: string) {
    return `${idPrefix}-switch-${moduleId}`
  }

  const panelOpen = pending !== null || notice !== null
  const pendingName = pending ? (rowOf(pending.moduleId)?.name ?? pending.moduleId) : ''
  const pendingLinked = pending ? linkedOf(pending.moduleId, pending.preview) : null
  const pendingEffects = pending ? effectsOf(pending.moduleId, pending.preview) : []

  return (
    <section aria-label={copy.title} className={styles.view}>
      <div className={styles.layout}>
        <div className={styles.main}>
          <header className={styles.header}>
            <span className={styles.eyebrow}>
              {projectName ? `Projeto · ${projectName}` : 'Projeto'}
            </span>
            <h1 className={styles.title}>{copy.title}</h1>
            <p className={styles.intro}>{copy.intro}</p>
            <div className={styles.summary}>
              {started ? <span className={styles.started}>{started}</span> : null}
              <span
                className={styles.counter}
              >{`${summary.enabled} de ${summary.total} ligados`}</span>
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
            {saved ? <p className={styles.saved}>{saved}</p> : null}
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
                    dotState={
                      row.windingDown ? 'winding_down' : row.enabled ? 'active' : 'disabled'
                    }
                    {...(onNavigate ? { onNavigate } : {})}
                    onToggle={(on) => askToggle(row.id, on)}
                  />
                ))}
              </div>
            </section>
          ))}

          <ModuleHistory projectId={projectId} />
        </div>

        {panelOpen ? (
          <aside aria-label="Mudança em andamento" aria-live="polite" className={styles.aside}>
            <div className={styles.panel}>
              {pending ? (
                <>
                  <div className={styles.panelHead}>
                    <span className={styles.panelLabel}>{copy.panelLabel}</span>
                    <h2 className={styles.panelTitle}>
                      {pending.on ? 'Ligar' : 'Desligar'} {pendingName}
                    </h2>
                  </div>

                  {pending.preview.refused ? (
                    <p className={styles.refusal}>{pending.preview.refused}</p>
                  ) : null}

                  {pendingLinked ? (
                    <div className={styles.linked}>
                      <span className={styles.linkedLabel}>{pendingLinked.label}</span>
                      <div className={styles.chips}>
                        {pendingLinked.names.map((name) => (
                          <span
                            key={name}
                            className={pending.on ? styles.chipNeutral : styles.chipWarn}
                          >
                            {name}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {pending.preview.refused ? null : (
                    <div className={styles.effects}>
                      <span className={styles.panelLabel}>{copy.effects}</span>
                      {pendingEffects.map((effect) => (
                        <div key={effect.name} className={styles.effect}>
                          <span>{effect.name}</span>
                          <span className={styles.effectState}>{effect.state}</span>
                        </div>
                      ))}
                      {pending.on ? null : <p className={styles.footnote}>{copy.footnote}</p>}
                    </div>
                  )}

                  <div className={styles.actions}>
                    {pending.preview.refused ? null : (
                      <Button type="button" autoFocus disabled={busy} onClick={confirm}>
                        {busy ? copy.saving : copy.confirm}
                      </Button>
                    )}
                    <Button type="button" disabled={busy} onClick={cancel}>
                      {copy.cancel}
                    </Button>
                  </div>
                </>
              ) : notice ? (
                <>
                  <div className={styles.panelHead}>
                    <span className={styles.panelLabel}>{copy.panelLabelDone}</span>
                    <h2 className={styles.panelTitle}>{notice.title}</h2>
                  </div>
                  <p className={styles.warning}>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      aria-hidden="true"
                      className={styles.warningIcon}
                    >
                      <circle cx="12" cy="12" r="9" />
                      <path d="M12 7v5l3 2" />
                    </svg>
                    <span>{notice.text}</span>
                  </p>
                  <div className={styles.actions}>
                    <Button type="button" onClick={dismissNotice}>
                      {copy.close}
                    </Button>
                  </div>
                </>
              ) : null}
            </div>
          </aside>
        ) : null}
      </div>
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

function signalTone(signal: string): 'warn' | 'adv' | 'neutral' {
  if (signal === 'Avançado') return 'adv'
  if (signal === 'Em encerramento') return 'warn'
  return 'neutral'
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
    <article
      className={styles.card}
      data-on={row.enabled ? 'true' : 'false'}
      aria-labelledby={titleId}
    >
      <div className={styles.cardTop}>
        <span className={styles.dot} data-state={dotState} aria-hidden="true" />
        <h3 id={titleId} className={styles.name}>
          {row.name}
        </h3>
        {row.levelTag ? <span className={styles.tag}>{row.levelTag}</span> : null}
        <span className={styles.spacer} />
        <span className={styles.help}>
          <ModuleHelpButton
            moduleId={row.id}
            projectId={projectId}
            {...(onNavigate ? { onNavigate } : {})}
          />
        </span>
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
          <span className={styles.track} aria-hidden="true" />
          <span className={styles.thumb} aria-hidden="true" />
        </button>
      </div>
      <p className={styles.objective}>{row.objective}</p>
      <div className={styles.cardBottom}>
        <span className={styles.dependency}>{row.dependency}</span>
        <span className={styles.spacer} />
        {row.signals.map((signal) => (
          <span key={signal} className={styles.signal} data-tone={signalTone(signal)}>
            {signal}
          </span>
        ))}
      </div>
    </article>
  )
}
