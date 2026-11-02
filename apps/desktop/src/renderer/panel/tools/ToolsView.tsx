import { useId, useRef, useState, type KeyboardEvent } from 'react'
import {
  MODULE_LABELS,
  PRESET_IDS,
  PRESET_LABELS,
  canManageTeamModules,
  type ModuleId,
  type ModuleState,
  type PresetId,
} from '@agilebox/core'
import { GlassToast } from '@agilebox/ui'
import { useActor } from '../../shared/session/useActor'
import { panelCopy } from '../copy'
import { useTeamCapabilities } from '../hooks/use-team-capabilities'
import { planChanges } from './change-plan'
import { ToolCard } from './ToolCard'
import { ToolsPreview } from './ToolsPreview'
import {
  TOOL_IDS,
  applyPreset,
  draftFromStatuses,
  presetMatching,
  toggleTool,
  type ToggleResult,
  type ToolDraft,
} from './tool-draft'
import { impactStateOf, useApplyToolChange, useToolImpact } from './use-tool-change'
import styles from './ToolsView.module.css'

const listNames = (ids: readonly ModuleId[]) => ids.map((id) => MODULE_LABELS[id]).join(' e ')

/** Texto que o rascunho mostra depois de cada mudança: o que entrou ou saiu por dependência. */
function noticeFor(id: ModuleId, wanted: boolean, result: Extract<ToggleResult, { ok: true }>) {
  const name = MODULE_LABELS[id]
  if (wanted) {
    return result.pulled.length > 0
      ? panelCopy.toolsEnteredWith(name, listNames(result.pulled))
      : panelCopy.toolsEntered(name)
  }
  return result.leaving.length > 0
    ? panelCopy.toolsLeftWith(name, listNames(result.leaving))
    : panelCopy.toolsLeft(name)
}

/**
 * Tela Ferramentas (quadro 06): cartões com interruptor, presets e rascunho local à esquerda; a
 * prévia em vidro à direita, com Aplicar e Cancelar (M2.10b). Só o gestor vê a tela; o servidor
 * também recusa a alteração. Esc cancela a prévia.
 */
export function ToolsView() {
  const { actor } = useActor()
  const capabilities = useTeamCapabilities()
  const [draft, setDraft] = useState<ToolDraft | null>(null)
  const [notice, setNotice] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const ids = useId()

  const statuses = capabilities.data?.statuses ?? []
  const current = draft ?? draftFromStatuses(statuses)
  const plan = planChanges(statuses, current)
  const windingDown = statuses
    .filter((status) => status.state === 'winding_down')
    .map((status) => status.moduleId)
  const canManage = !!actor && canManageTeamModules(actor)
  const impact = useToolImpact(plan.disable, canManage)
  const impactState = impactStateOf(plan.disable.length > 0, impact)
  const apply = useApplyToolChange()
  // Enquanto a mudança é gravada, o rascunho fica travado: o retorno da gravação depende dele.
  const busy = apply.isPending

  if (!actor || !canManage) return null
  if (capabilities.isError) {
    return (
      <p role="alert" className={styles.alert}>
        {panelCopy.toolsError}
      </p>
    )
  }
  if (!capabilities.data) return <p className={styles.loading}>{panelCopy.toolsLoading}</p>

  const matching = presetMatching(current)
  const serverStateOf = (id: ModuleId): ModuleState =>
    statuses.find((status) => status.moduleId === id)?.state ?? 'disabled'

  function focusPreview() {
    headingRef.current?.focus()
  }

  function toggle(id: ModuleId, wanted: boolean) {
    if (busy) return
    const result = toggleTool(current, id, wanted, windingDown)
    apply.reset()
    if (!result.ok) {
      setNotice(
        result.conflicts.length > 0
          ? panelCopy.toolsRefusedConflict(MODULE_LABELS[id], listNames(result.conflicts))
          : panelCopy.toolsRefusedMissing(MODULE_LABELS[id], listNames(result.missing)),
      )
      return
    }
    setDraft(result.draft)
    setNotice(noticeFor(id, wanted, result))
  }

  function choosePreset(presetId: PresetId) {
    if (busy) return
    apply.reset()
    setDraft(applyPreset(presetId))
    setNotice(panelCopy.toolsPresetApplied(PRESET_LABELS[presetId].name))
  }

  function cancel() {
    if (busy) return
    apply.reset()
    setDraft(null)
    setNotice('')
    focusPreview()
  }

  function applyChange() {
    apply.mutate(
      { enable: plan.enable, disable: plan.disable },
      {
        onSuccess: (result) => {
          const winding = result.windingDown.map((item) => item.moduleId)
          setDraft(null)
          setNotice('')
          setToast(
            winding.length > 0
              ? panelCopy.toolsAppliedWinding(listNames(winding))
              : panelCopy.toolsApplied,
          )
          focusPreview()
        },
      },
    )
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Escape' || plan.isEmpty || busy) return
    event.preventDefault()
    cancel()
  }

  return (
    <div className={styles.view} onKeyDown={onKeyDown}>
      <div className={styles.main}>
        <div className={styles.header}>
          <span className={styles.label}>{panelCopy.toolsStartingPoint}</span>
          <div role="group" aria-label={panelCopy.toolsPresets} className={styles.presets}>
            {PRESET_IDS.map((presetId) => {
              const descriptionId = `${ids}-${presetId}`
              return (
                <button
                  key={presetId}
                  type="button"
                  aria-label={PRESET_LABELS[presetId].name}
                  aria-describedby={descriptionId}
                  aria-pressed={matching === presetId}
                  className={styles.preset}
                  disabled={busy}
                  onClick={() => choosePreset(presetId)}
                >
                  <span className={styles.presetName}>{PRESET_LABELS[presetId].name}</span>
                  <span id={descriptionId} className={styles.presetDesc}>
                    {PRESET_LABELS[presetId].description}
                  </span>
                </button>
              )
            })}
          </div>
          {matching ? null : <p className={styles.presetHint}>{panelCopy.toolsCustom}</p>}
          <p className={styles.hint}>{panelCopy.toolsHint}</p>
          <p role="status" className={styles.notice}>
            {notice}
          </p>
        </div>
        <ul className={styles.grid}>
          {TOOL_IDS.map((id) => (
            <li key={id}>
              <ToolCard
                moduleId={id}
                on={current.includes(id)}
                serverState={serverStateOf(id)}
                disabled={busy}
                onToggle={(wanted) => toggle(id, wanted)}
              />
            </li>
          ))}
        </ul>
      </div>

      <ToolsPreview
        plan={plan}
        impacts={impact.data ?? []}
        impact={impactState}
        error={apply.error}
        pending={busy}
        headingRef={headingRef}
        onApply={applyChange}
        onCancel={cancel}
      />

      {toast ? <GlassToast message={toast} onDismiss={() => setToast(null)} /> : null}
    </div>
  )
}
