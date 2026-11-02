import { useState } from 'react'
import { MODULE_LABELS, PRESET_IDS, PRESET_LABELS, canManageTeamModules } from '@agilebox/core'
import type { ModuleId, ModuleState, PresetId } from '@agilebox/core'
import { Button } from '@agilebox/ui'
import { useActor } from '../../shared/session/useActor'
import { panelCopy } from '../copy'
import { useTeamCapabilities } from '../hooks/use-team-capabilities'
import { ToolCard } from './ToolCard'
import {
  TOOL_IDS,
  applyPreset,
  draftFromStatuses,
  presetMatching,
  toggleTool,
  type ToggleResult,
  type ToolDraft,
} from './tool-draft'
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
 * Tela Ferramentas (quadro 06, M2.10a): cartões com interruptor, dependência e sinal de estado,
 * presets e um rascunho local. Nada é gravado aqui: Aplicar e Cancelar, com a prévia em vidro,
 * ficam para o M2.10b. Só o gestor vê a tela; o servidor também recusa a alteração.
 */
export function ToolsView() {
  const { actor } = useActor()
  const capabilities = useTeamCapabilities()
  const [draft, setDraft] = useState<ToolDraft | null>(null)
  const [notice, setNotice] = useState('')

  if (!actor || !canManageTeamModules(actor)) return null
  if (capabilities.isError) {
    return (
      <p role="alert" className={styles.alert}>
        {panelCopy.toolsError}
      </p>
    )
  }
  if (!capabilities.data) return <p className={styles.loading}>{panelCopy.toolsLoading}</p>

  const { statuses } = capabilities.data
  const current = draft ?? draftFromStatuses(statuses)
  const matching = presetMatching(current)
  const serverStateOf = (id: ModuleId): ModuleState =>
    statuses.find((status) => status.moduleId === id)?.state ?? 'disabled'

  function toggle(id: ModuleId, wanted: boolean) {
    const result = toggleTool(current, id, wanted)
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
    setDraft(applyPreset(presetId))
    setNotice(panelCopy.toolsPresetApplied(PRESET_LABELS[presetId].name))
  }

  return (
    <div className={styles.view}>
      <div className={styles.header}>
        <div role="group" aria-label={panelCopy.toolsPresets} className={styles.presets}>
          {PRESET_IDS.map((presetId) => (
            <Button
              key={presetId}
              aria-pressed={matching === presetId}
              onClick={() => choosePreset(presetId)}
            >
              {PRESET_LABELS[presetId].name}
            </Button>
          ))}
        </div>
        <p className={styles.presetHint}>
          {matching ? PRESET_LABELS[matching].description : panelCopy.toolsCustom}
        </p>
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
              onToggle={(wanted) => toggle(id, wanted)}
            />
          </li>
        ))}
      </ul>
    </div>
  )
}
