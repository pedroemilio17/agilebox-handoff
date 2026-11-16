import { useEffect, useId, useRef, useState } from 'react'
import { Button, GlassSurface, ReadOnlyBadge, SegmentedControl } from '@agilebox/ui'
import { ApiError } from '@agilebox/contract'
import type {
  TeamPresetDto,
  TeamToolDto,
  TeamToolsChangeResultDto,
  TeamToolsViewDto,
} from '@agilebox/contract'
import type { ExperienceLevel } from '@agilebox/core'
import type { SegmentedOption } from '@agilebox/ui'
import { useTeamTools } from '../../shared/capabilities/use-team-tools'
import { panelCopy } from '../copy'
import { ToolsImpactDialog, type PendingChange } from './ToolsImpactDialog'
import { useTeamToolsActions } from './use-team-tools-actions'
import { COMING_SOON_TOOLS, highestLevel, joinPt, levelLabel, uniqueIds } from './team-tools-rules'
import styles from './TeamToolsSection.module.css'

const LEVEL_OPTIONS: [
  SegmentedOption<ExperienceLevel>,
  SegmentedOption<ExperienceLevel>,
  SegmentedOption<ExperienceLevel>,
] = [
  { value: 'basic', label: levelLabel('basic') },
  { value: 'intermediate', label: levelLabel('intermediate') },
  { value: 'advanced', label: levelLabel('advanced') },
]

const STATE_LABEL = {
  active: panelCopy.teamToolStateActive,
  winding_down: panelCopy.teamToolStateWindingDown,
  disabled: panelCopy.teamToolStateDisabled,
} as const

type WindDownAction = { readonly moduleId: string; readonly kind: 'now' | 'complete' }

function errorText(error: unknown): string {
  if (error instanceof ApiError) {
    return error.code === 'FORBIDDEN' ? panelCopy.forbidden : error.message
  }
  return panelCopy.teamToolChangeError
}

function labelFrom(view: TeamToolsViewDto) {
  return (id: string) => view.modules.find((tool) => tool.id === id)?.label ?? id
}

function summaryOf(result: TeamToolsChangeResultDto): string {
  const labelOf = labelFrom(result.view)
  const parts: string[] = [panelCopy.teamToolChangeSaved]
  if (result.autoEnabled.length > 0)
    parts.push(panelCopy.teamToolAutoEnabledNotice(joinPt(result.autoEnabled.map(labelOf))))
  if (result.windingDown.length > 0)
    parts.push(panelCopy.teamToolWindingDownNotice(joinPt(result.windingDown.map(labelOf))))
  if (result.disabled.length > 0)
    parts.push(panelCopy.teamToolDisabledNotice(joinPt(result.disabled.map(labelOf))))
  return parts.join(' ')
}

/**
 * Ferramentas da equipe, dentro de Ajustes. Qualquer membro lê; só o gestor muda, e o backend
 * recusa o resto. Mudanças passam pela prévia de impacto antes de gravar.
 */
export function TeamToolsSection() {
  const view = useTeamTools()
  const actions = useTeamToolsActions()
  const headingId = useId()
  const [pending, setPending] = useState<PendingChange | null>(null)
  const [windDown, setWindDown] = useState<WindDownAction | null>(null)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState<string | null>(null)

  if (view.isPending) {
    return (
      <section className={styles.root} aria-labelledby={headingId}>
        <h2 id={headingId} className={styles.title}>
          {panelCopy.teamToolsTitle}
        </h2>
        <p role="status" className={styles.muted}>
          {panelCopy.teamToolsLoading}
        </p>
      </section>
    )
  }

  if (view.isError || !view.data) {
    return (
      <section className={styles.root} aria-labelledby={headingId}>
        <h2 id={headingId} className={styles.title}>
          {panelCopy.teamToolsTitle}
        </h2>
        <p role="alert">{panelCopy.teamToolsLoadError}</p>
        <Button type="button" onClick={() => void view.refetch()}>
          {panelCopy.retry}
        </Button>
      </section>
    )
  }

  const data = view.data
  const canManage = data.canManage
  const labelOf = labelFrom(data)
  const busy =
    actions.applyChange.isPending ||
    actions.completeWindDown.isPending ||
    actions.applyPreset.isPending

  function clearMessages() {
    setError(null)
    setNotice('')
  }

  function runChange(
    change: { enable?: string[]; disable?: string[]; finalize?: string[] },
    done: () => void = () => undefined,
  ) {
    clearMessages()
    actions.applyChange.mutate(change, {
      onSuccess: (result) => {
        done()
        setNotice(summaryOf(result))
      },
      onError: (failure) => setError(errorText(failure)),
    })
  }

  function askToggle(tool: TeamToolDto, on: boolean) {
    clearMessages()
    setWindDown(null)
    setPending(
      on
        ? { kind: 'change', enable: [tool.id], disable: [] }
        : { kind: 'change', enable: [], disable: [tool.id] },
    )
  }

  function confirmPending() {
    if (!pending) return
    if (pending.kind === 'preset') {
      clearMessages()
      actions.applyPreset.mutate(
        { presetId: pending.presetId, applySuggestedLevel: pending.applySuggestedLevel },
        {
          onSuccess: (result) => {
            setPending(null)
            setNotice(`${panelCopy.teamPresetApplied(pending.name)} ${summaryOf(result)}`)
          },
          onError: (failure) => setError(errorText(failure)),
        },
      )
      return
    }
    runChange(
      {
        ...(pending.enable.length > 0 ? { enable: [...pending.enable] } : {}),
        ...(pending.disable.length > 0 ? { disable: [...pending.disable] } : {}),
      },
      () => setPending(null),
    )
  }

  function changeLevel(level: ExperienceLevel) {
    if (level === data.level) return
    clearMessages()
    actions.setLevel.mutate(
      { level },
      {
        onSuccess: () => setNotice(panelCopy.teamToolsLevelChanged(levelLabel(level))),
        onError: () => setError(panelCopy.teamToolsLevelError),
      },
    )
  }

  const raiseTo = highestLevel(data.levelWarnings.map((warning) => warning.requiredLevel))

  return (
    <section className={styles.root} aria-labelledby={headingId}>
      <header className={styles.header}>
        <h2 id={headingId} className={styles.title}>
          {panelCopy.teamToolsTitle}
        </h2>
        <p className={styles.intro}>{panelCopy.teamToolsIntro}</p>
        {canManage ? null : (
          <div className={styles.readOnly}>
            <ReadOnlyBadge />
            <span className={styles.muted}>{panelCopy.teamToolsReadOnly}</span>
          </div>
        )}
      </header>

      <p role="status" aria-live="polite" className={styles.notice}>
        {notice}
      </p>
      {error && !pending ? (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}

      <GlassSurface variant="group" className={styles.group}>
        <h3 className={styles.sectionLabel}>{panelCopy.teamToolsLevelTitle}</h3>
        <p className={styles.muted}>{panelCopy.teamToolsLevelHint}</p>
        {canManage ? (
          <SegmentedControl<ExperienceLevel>
            aria-label={panelCopy.teamToolsLevelGroup}
            value={data.level}
            onChange={changeLevel}
            options={LEVEL_OPTIONS}
          />
        ) : (
          <p className={styles.label}>{panelCopy.teamToolsLevelCurrent(levelLabel(data.level))}</p>
        )}
        {data.levelWarnings.map((warning) => (
          <p key={warning.module} role="note" className={styles.levelWarning}>
            {panelCopy.teamToolsLevelWarning(warning.label, levelLabel(warning.requiredLevel))}
          </p>
        ))}
        {canManage && raiseTo !== null && data.levelWarnings.length > 0 ? (
          <div>
            <Button type="button" onClick={() => changeLevel(raiseTo)}>
              {panelCopy.teamToolsLevelRaise(levelLabel(raiseTo))}
            </Button>
          </div>
        ) : null}
      </GlassSurface>

      <GlassSurface variant="group" className={styles.group}>
        <h3 className={styles.sectionLabel}>{panelCopy.teamToolsPresetsTitle}</h3>
        <p className={styles.muted}>{panelCopy.teamToolsPresetsHint}</p>
        <ul className={styles.presets}>
          {data.presets.map((preset) => (
            <PresetCard
              key={preset.id}
              preset={preset}
              canManage={canManage}
              disabled={busy}
              onApply={() => {
                clearMessages()
                setWindDown(null)
                setPending({
                  kind: 'preset',
                  presetId: preset.id,
                  name: preset.label,
                  suggestedLevel: preset.suggestedLevel,
                  applySuggestedLevel: false,
                })
              }}
            />
          ))}
        </ul>
      </GlassSurface>

      <GlassSurface variant="group" className={styles.group}>
        <h3 className={styles.sectionLabel}>{panelCopy.teamToolsListTitle}</h3>
        <ul className={styles.toolList}>
          {data.modules.map((tool) => (
            <ToolRow
              key={tool.id}
              tool={tool}
              canManage={canManage}
              busy={busy}
              windDown={windDown?.moduleId === tool.id ? windDown : null}
              onToggle={(on) => askToggle(tool, on)}
              onAskWindDown={(kind) => {
                clearMessages()
                setWindDown({ moduleId: tool.id, kind })
              }}
              onCancelWindDown={() => setWindDown(null)}
              onConfirmWindDown={() => {
                if (!windDown) return
                if (windDown.kind === 'complete') {
                  clearMessages()
                  actions.completeWindDown.mutate(
                    { moduleId: tool.id },
                    {
                      onSuccess: (result) => {
                        setWindDown(null)
                        setNotice(summaryOf(result))
                      },
                      onError: (failure) => setError(errorText(failure)),
                    },
                  )
                  return
                }
                runChange({ disable: [tool.id], finalize: [tool.id] }, () => setWindDown(null))
              }}
            />
          ))}
        </ul>
      </GlassSurface>

      <ToolsImpactDialog
        pending={pending}
        labelOf={labelOf}
        busy={busy}
        error={pending ? error : null}
        onConfirm={confirmPending}
        onCancel={() => {
          setPending(null)
          setError(null)
        }}
        onIncludeDependents={(ids) =>
          setPending((current) =>
            current?.kind === 'change'
              ? { ...current, disable: uniqueIds([...current.disable, ...ids]) }
              : current,
          )
        }
        onToggleSuggestedLevel={(value) =>
          setPending((current) =>
            current?.kind === 'preset' ? { ...current, applySuggestedLevel: value } : current,
          )
        }
      />
    </section>
  )
}

interface PresetCardProps {
  readonly preset: TeamPresetDto
  readonly canManage: boolean
  readonly disabled: boolean
  readonly onApply: () => void
}

function PresetCard({ preset, canManage, disabled, onApply }: PresetCardProps) {
  const titleId = useId()
  return (
    <li className={styles.preset} aria-labelledby={titleId}>
      <h4 id={titleId} className={styles.presetTitle}>
        {preset.label}
      </h4>
      <p className={styles.muted}>{panelCopy.teamPresetDescription[preset.id]}</p>
      <p className={styles.label}>
        {panelCopy.teamPresetSuggested(levelLabel(preset.suggestedLevel))}
      </p>
      {canManage ? (
        <Button
          type="button"
          aria-label={panelCopy.teamPresetApply(preset.label)}
          disabled={disabled}
          onClick={onApply}
        >
          {panelCopy.teamPresetApplyLabel}
        </Button>
      ) : null}
    </li>
  )
}

interface ToolRowProps {
  readonly tool: TeamToolDto
  readonly canManage: boolean
  readonly busy: boolean
  readonly windDown: WindDownAction | null
  readonly onToggle: (on: boolean) => void
  readonly onAskWindDown: (kind: WindDownAction['kind']) => void
  readonly onCancelWindDown: () => void
  readonly onConfirmWindDown: () => void
}

function ToolRow({
  tool,
  canManage,
  busy,
  windDown,
  onToggle,
  onAskWindDown,
  onCancelWindDown,
  onConfirmWindDown,
}: ToolRowProps) {
  const soon = COMING_SOON_TOOLS.has(tool.id)
  const core = tool.id === 'core'
  const winding = tool.state === 'winding_down'
  return (
    <li className={styles.toolRow}>
      <div className={styles.toolText}>
        <span className={styles.toolName}>{tool.label}</span>
        <span className={styles.muted}>
          {panelCopy.teamToolMinLevel(levelLabel(tool.minLevel))}
        </span>
      </div>
      <div className={styles.toolControl}>
        <span className={styles.state}>
          <span className={styles.dot} data-state={tool.state} aria-hidden="true" />
          {STATE_LABEL[tool.state]}
          {soon ? <span className={styles.muted}> · {panelCopy.teamToolSoon}</span> : null}
        </span>
        {!canManage ? null : core ? (
          <span className={styles.muted}>{panelCopy.teamToolAlwaysOn}</span>
        ) : winding ? (
          <div className={styles.actions}>
            <Button type="button" disabled={busy} onClick={() => onToggle(true)}>
              {panelCopy.teamToolReactivate}
            </Button>
            <Button type="button" disabled={busy} onClick={() => onAskWindDown('now')}>
              {panelCopy.teamToolWindDownNow}
            </Button>
            <Button type="button" disabled={busy} onClick={() => onAskWindDown('complete')}>
              {panelCopy.teamToolWindDownComplete}
            </Button>
          </div>
        ) : (
          <button
            type="button"
            role="switch"
            aria-checked={tool.state === 'active'}
            aria-label={panelCopy.teamToolSwitch(tool.label)}
            className={styles.switch}
            disabled={busy || soon}
            onClick={() => onToggle(tool.state !== 'active')}
          >
            <span className={styles.track} aria-hidden="true">
              <span className={styles.thumb} />
            </span>
          </button>
        )}
      </div>
      {windDown ? (
        <WindDownConfirm
          text={
            windDown.kind === 'now'
              ? panelCopy.teamToolWindDownNowConfirm(tool.label)
              : panelCopy.teamToolWindDownCompleteConfirm(tool.label)
          }
          onCancel={onCancelWindDown}
          onConfirm={onConfirmWindDown}
        />
      ) : null}
    </li>
  )
}

/** Confirmação curta de encerramento, na própria linha. Foca o botão de confirmar; Esc cancela. */
function WindDownConfirm({
  text,
  onCancel,
  onConfirm,
}: {
  readonly text: string
  readonly onCancel: () => void
  readonly onConfirm: () => void
}) {
  const groupRef = useRef<HTMLDivElement>(null)
  const textId = useId()
  useEffect(() => {
    groupRef.current?.querySelector<HTMLButtonElement>('button')?.focus()
  }, [])
  return (
    <div
      ref={groupRef}
      role="group"
      aria-labelledby={textId}
      className={styles.confirm}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation()
          onCancel()
        }
      }}
    >
      <p id={textId} className={styles.muted}>
        {text}
      </p>
      <div className={styles.actions}>
        <Button type="button" variant="primary" onClick={onConfirm}>
          {panelCopy.teamToolConfirmYes}
        </Button>
        <Button type="button" onClick={onCancel}>
          {panelCopy.teamToolConfirmNo}
        </Button>
      </div>
    </div>
  )
}
