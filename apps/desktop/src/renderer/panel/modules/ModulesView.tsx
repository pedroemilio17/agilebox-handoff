import { useEffect, useId, useState } from 'react'
import { Button, EmptyState, Modal } from '@agilebox/ui'
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
  intro:
    'Desligar uma ferramenta apenas oculta o menu dela no projeto atual — nenhum dado é apagado.',
  legend: 'N1 essencial · N2 intermediário · N3 avançado',
  readOnly: 'Só o gestor muda os módulos do projeto.',
  archived: 'Projeto arquivado: as ferramentas não podem ser alteradas.',
  modalLabelConfirm: 'Confirmar alteração',
  modalLabelBlocked: 'Mudança não feita',
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

/** Aviso de gravação recusada pelo servidor (ex.: Sprints com sprint ativa). */
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

/** Resultado da gravação: "Módulos atualizados" ou aviso de sprint ativa. */
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
 * Módulos do projeto em lista vertical limpa (`configuracoes.html`).
 * Clicar no interruptor salva na hora quando não há conflito nem desligamento em cascata;
 * só abre diálogo central quando há recusa, conflito ou desligamento em cascata.
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

  function applyToggle(moduleId: ModuleId, on: boolean) {
    const title = `${on ? 'Ligar' : 'Desligar'} ${rowOf(moduleId)?.name ?? moduleId}`
    const request = on ? { enable: [moduleId] } : { disable: [moduleId] }
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

  function handleToggle(moduleId: ModuleId, on: boolean) {
    setError(null)
    setSaved(null)
    setNotice(null)
    const preview = previewToggle(enabledIds, moduleId, on)
    const needsConfirm = Boolean(preview.refused) || (!on && preview.alsoDisables.length > 0)
    if (needsConfirm) {
      setPending({ moduleId, on, preview })
      return
    }
    applyToggle(moduleId, on)
  }

  function confirmPending() {
    if (!pending || pending.preview.refused) return
    applyToggle(pending.moduleId, pending.on)
  }

  function closeDialog() {
    if (busy) return
    setPending(null)
    setNotice(null)
  }

  function switchId(moduleId: string) {
    return `${idPrefix}-switch-${moduleId}`
  }

  const dialogOpen = pending !== null || notice !== null
  const pendingName = pending ? (rowOf(pending.moduleId)?.name ?? pending.moduleId) : ''
  const pendingLinked = pending ? linkedOf(pending.moduleId, pending.preview) : null
  const pendingEffects = pending ? effectsOf(pending.moduleId, pending.preview) : []
  const dialogTitle = pending
    ? `${pending.on ? 'Ligar' : 'Desligar'} ${pendingName}`
    : (notice?.title ?? copy.modalLabelBlocked)

  return (
    <section aria-label={copy.title} className={styles.view}>
      <div className={styles.stage}>
        <header className={styles.header}>
          <div className={styles.headerTop}>
            <h2
              className={styles.counterHeading}
            >{`${summary.enabled} de ${summary.total} ligados`}</h2>
            {started ? <span className={styles.started}>{started}</span> : null}
          </div>
          <p className={styles.intro}>{copy.intro}</p>
          <div className={styles.metaRow}>
            {projectName ? (
              <span className={styles.eyebrow}>{`Projeto · ${projectName}`}</span>
            ) : null}
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

        <div className={styles.groups}>
          {groups.map((group, index) => (
            <section
              key={group.title}
              aria-labelledby={`${idPrefix}-group-${index}`}
              className={styles.group}
            >
              <div className={styles.groupHead}>
                <h3 id={`${idPrefix}-group-${index}`} className={styles.groupTitle}>
                  {group.title}
                </h3>
              </div>
              <div className={styles.cleanList}>
                {group.rows.map((row) => (
                  <ModuleRowItem
                    key={row.id}
                    row={row}
                    projectId={projectId}
                    switchDomId={switchId(row.id)}
                    canEdit={canEdit && !busy}
                    dotState={
                      row.windingDown ? 'winding_down' : row.enabled ? 'active' : 'disabled'
                    }
                    {...(onNavigate ? { onNavigate } : {})}
                    onToggle={(on) => handleToggle(row.id, on)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>

        <ModuleHistory projectId={projectId} />
      </div>

      <Modal open={dialogOpen} title={dialogTitle} onClose={closeDialog} surface="glass">
        <div className={styles.dialogContent}>
          {pending ? (
            <>
              <div className={styles.dialogHead}>
                <span className={styles.dialogLabel}>
                  {pending.preview.refused ? copy.modalLabelBlocked : copy.modalLabelConfirm}
                </span>
                <h2 className={styles.dialogTitle}>{dialogTitle}</h2>
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
                  <span className={styles.dialogLabel}>{copy.effects}</span>
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
                <Button type="button" disabled={busy} onClick={closeDialog}>
                  {pending.preview.refused ? copy.close : copy.cancel}
                </Button>
                {pending.preview.refused ? null : (
                  <Button type="button" variant="primary" disabled={busy} onClick={confirmPending}>
                    {busy ? copy.saving : copy.confirm}
                  </Button>
                )}
              </div>
            </>
          ) : notice ? (
            <>
              <div className={styles.dialogHead}>
                <span className={styles.dialogLabel}>{copy.modalLabelBlocked}</span>
                <h2 className={styles.dialogTitle}>{notice.title}</h2>
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
                <Button type="button" onClick={closeDialog}>
                  {copy.close}
                </Button>
              </div>
            </>
          ) : null}
        </div>
      </Modal>
    </section>
  )
}

interface ModuleRowItemProps {
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

function ModuleRowItem({
  row,
  projectId,
  switchDomId,
  canEdit,
  dotState,
  onNavigate,
  onToggle,
}: ModuleRowItemProps) {
  const titleId = useId()
  return (
    <article
      className={styles.toolRow}
      data-on={row.enabled ? 'true' : 'false'}
      aria-labelledby={titleId}
    >
      <div className={styles.toolInfo}>
        <div className={styles.toolTitleLine}>
          <span className={styles.dot} data-state={dotState} aria-hidden="true" />
          <h4 id={titleId} className={styles.name}>
            {row.name}
          </h4>
          {row.levelTag ? <span className={styles.tag}>{row.levelTag}</span> : null}
          {row.signals.map((signal) => (
            <span key={signal} className={styles.signal} data-tone={signalTone(signal)}>
              {signal}
            </span>
          ))}
        </div>
        <p className={styles.objective}>{row.objective}</p>
        <span className={styles.dependency}>{row.dependency}</span>
      </div>

      <div className={styles.toolActions}>
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
        </button>
      </div>
    </article>
  )
}
