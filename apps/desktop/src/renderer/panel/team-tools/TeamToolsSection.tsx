import { useEffect, useId, useRef, useState } from 'react'
import { Button, ReadOnlyBadge } from '@agilebox/ui'
import { ApiError } from '@agilebox/contract'
import type {
  TeamPresetDto,
  TeamToolDto,
  TeamToolsChangeResultDto,
  TeamToolsViewDto,
} from '@agilebox/contract'
import type { ExperienceLevel } from '@agilebox/core'
import { useTeamTools } from '../../shared/capabilities/use-team-tools'
import { panelCopy } from '../copy'
import { CleanList, CleanRow, QuietToggle, Section, Switch } from '../settings/clean-ui'
import type { QuietOption } from '../settings/clean-ui'
import { settingsCopy } from '../settings/settings-copy'
import { ToolsImpactDialog, type PendingChange } from './ToolsImpactDialog'
import { SprintLimitField, sprintLimitOf } from './SprintLimitField'
import { useTeamToolsActions } from './use-team-tools-actions'
import { COMING_SOON_TOOLS, highestLevel, joinPt, levelLabel, uniqueIds } from './team-tools-rules'
import styles from './TeamToolsSection.module.css'

const LEVEL_OPTIONS: readonly QuietOption<ExperienceLevel>[] = [
  { value: 'basic', label: levelLabel('basic') },
  { value: 'intermediate', label: levelLabel('intermediate') },
  { value: 'advanced', label: levelLabel('advanced') },
]

/** Três grupos do desenho; ids fora do mapa caem em "Essenciais". */
const TOOL_GROUPS: readonly { readonly title: string; readonly ids: readonly string[] }[] = [
  {
    title: settingsCopy.toolsGroupEssential,
    ids: [
      'core',
      'agenda',
      'wip',
      'definitionOfDone',
      'acceptance',
      'impediments',
      'checkins',
      'subtasks',
      'integrations',
    ],
  },
  {
    title: settingsCopy.toolsGroupAgile,
    ids: [
      'backlog',
      'sprints',
      'reviewRetro',
      'estimates.hours',
      'estimates.points',
      'cost',
      'flowMetrics',
      'burndown',
    ],
  },
  {
    title: settingsCopy.toolsGroupPredictive,
    ids: ['wbs', 'schedule', 'milestones', 'baseline', 'risks'],
  },
]

function groupTools(modules: readonly TeamToolDto[]) {
  const known = new Set(TOOL_GROUPS.flatMap((group) => group.ids))
  return TOOL_GROUPS.map((group, index) => ({
    title: group.title,
    tools: [
      ...group.ids.flatMap((id) => modules.filter((tool) => tool.id === id)),
      ...(index === 0 ? modules.filter((tool) => !known.has(tool.id)) : []),
    ],
  })).filter((group) => group.tools.length > 0)
}

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
  const [pending, setPending] = useState<PendingChange | null>(null)
  const [windDown, setWindDown] = useState<WindDownAction | null>(null)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState<string | null>(null)

  if (view.isPending) {
    return (
      <Section title={panelCopy.teamToolsTitle}>
        <p role="status" className={styles.muted}>
          {panelCopy.teamToolsLoading}
        </p>
      </Section>
    )
  }

  if (view.isError || !view.data) {
    return (
      <Section title={panelCopy.teamToolsTitle}>
        <p role="alert">{panelCopy.teamToolsLoadError}</p>
        <div>
          <Button type="button" onClick={() => void view.refetch()}>
            {panelCopy.retry}
          </Button>
        </div>
      </Section>
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

  const counted = data.modules.filter((tool) => tool.id !== 'core')
  const activeCount = counted.filter((tool) => tool.state === 'active').length

  return (
    <>
      <Section
        title={settingsCopy.toolsCounter(activeCount, counted.length)}
        ariaLabel={panelCopy.teamToolsTitle}
        meta={canManage ? undefined : <ReadOnlyBadge />}
        helper={settingsCopy.toolsHelper}
      >
        <p role="status" aria-live="polite" className={styles.notice}>
          {notice}
        </p>
        {error && !pending ? (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        ) : null}
      </Section>

      <Section title={panelCopy.teamToolsLevelTitle} helper={panelCopy.teamToolsLevelHint}>
        <CleanList>
          <CleanRow name={settingsCopy.levelRow}>
            {canManage ? (
              <QuietToggle<ExperienceLevel>
                ariaLabel={panelCopy.teamToolsLevelGroup}
                value={data.level}
                onChange={changeLevel}
                options={LEVEL_OPTIONS}
              />
            ) : (
              <span className={styles.label}>
                {panelCopy.teamToolsLevelCurrent(levelLabel(data.level))}
              </span>
            )}
          </CleanRow>
        </CleanList>
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
      </Section>

      <Section title={settingsCopy.presetsTitle} helper={panelCopy.teamToolsPresetsHint}>
        <CleanList>
          {data.presets.map((preset) => (
            <PresetRow
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
        </CleanList>
      </Section>

      {groupTools(data.modules).map((group) => (
        <Section key={group.title} title={group.title}>
          <CleanList>
            {group.tools.map((tool) => (
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
          </CleanList>
        </Section>
      ))}

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
    </>
  )
}

interface PresetCardProps {
  readonly preset: TeamPresetDto
  readonly canManage: boolean
  readonly disabled: boolean
  readonly onApply: () => void
}

function PresetRow({ preset, canManage, disabled, onApply }: PresetCardProps) {
  return (
    <CleanRow
      name={preset.label}
      description={`${panelCopy.teamPresetDescription[preset.id]} ${panelCopy.teamPresetSuggested(levelLabel(preset.suggestedLevel))}`}
    >
      {canManage ? (
        <Button
          type="button"
          size="sm"
          aria-label={panelCopy.teamPresetApply(preset.label)}
          disabled={disabled}
          onClick={onApply}
        >
          {panelCopy.teamPresetApplyLabel}
        </Button>
      ) : null}
    </CleanRow>
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
  const description = [
    settingsCopy.toolDescriptions[tool.id] ?? panelCopy.teamToolMinLevel(levelLabel(tool.minLevel)),
    soon ? panelCopy.teamToolSoon : null,
  ]
    .filter(Boolean)
    .join(' · ')
  return (
    <CleanRow
      name={tool.label}
      description={description}
      extra={
        <>
          {tool.id === 'sprints' && tool.state === 'active' ? (
            <SprintLimitField value={sprintLimitOf(tool.config)} canManage={canManage} />
          ) : null}
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
        </>
      }
    >
      {winding ? <span className={styles.state}>{STATE_LABEL.winding_down}</span> : null}
      {core ? (
        canManage ? (
          <span className={styles.muted}>{panelCopy.teamToolAlwaysOn}</span>
        ) : null
      ) : winding && canManage ? (
        <div className={styles.actions}>
          <Button type="button" size="sm" disabled={busy} onClick={() => onToggle(true)}>
            {panelCopy.teamToolReactivate}
          </Button>
          <Button type="button" size="sm" disabled={busy} onClick={() => onAskWindDown('now')}>
            {panelCopy.teamToolWindDownNow}
          </Button>
          <Button type="button" size="sm" disabled={busy} onClick={() => onAskWindDown('complete')}>
            {panelCopy.teamToolWindDownComplete}
          </Button>
        </div>
      ) : (
        <Switch
          checked={tool.state === 'active'}
          label={panelCopy.teamToolSwitch(tool.label)}
          disabled={!canManage || busy || soon || winding}
          onChange={(on) => onToggle(on)}
        />
      )}
    </CleanRow>
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
