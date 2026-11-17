import { useQuery } from '@tanstack/react-query'
import { Button, Modal } from '@agilebox/ui'
import type { PreviewTeamToolsChangeInput, TeamToolsPreviewDto } from '@agilebox/contract'
import type { ExperienceLevel } from '@agilebox/core'
import { useApi } from '../../shared/api/ApiProvider'
import { queryKeys } from '../../shared/query/keys'
import { panelCopy } from '../copy'
import { dependentsToInclude, joinPt, levelLabel } from './team-tools-rules'
import styles from './TeamToolsSection.module.css'

/** O que a prévia calcula: uma mudança de ferramentas ou a aplicação de um preset. */
export type PendingChange =
  | {
      readonly kind: 'change'
      readonly enable: readonly string[]
      readonly disable: readonly string[]
    }
  | {
      readonly kind: 'preset'
      readonly presetId: 'kanban' | 'scrum' | 'kanban-flow' | 'scrum-complete'
      readonly name: string
      readonly suggestedLevel: ExperienceLevel
      readonly applySuggestedLevel: boolean
    }

export interface ToolsImpactDialogProps {
  readonly pending: PendingChange | null
  readonly labelOf: (id: string) => string
  readonly busy: boolean
  /** Erro da última tentativa de gravar: aparece aqui, e a prévia continua aberta. */
  readonly error: string | null
  readonly onConfirm: () => void
  readonly onCancel: () => void
  /** Pede a prévia de novo com os dependentes incluídos no mesmo pedido. */
  readonly onIncludeDependents: (ids: readonly string[]) => void
  readonly onToggleSuggestedLevel: (value: boolean) => void
}

function previewInput(pending: PendingChange): PreviewTeamToolsChangeInput {
  if (pending.kind === 'preset') return { presetId: pending.presetId }
  return {
    ...(pending.enable.length > 0 ? { enable: [...pending.enable] } : {}),
    ...(pending.disable.length > 0 ? { disable: [...pending.disable] } : {}),
  }
}

/** Prévia de impacto: nada é gravado aqui. Só "Confirmar" aplica, e só quando a prévia é aceita. */
export function ToolsImpactDialog({
  pending,
  labelOf,
  busy,
  error,
  onConfirm,
  onCancel,
  onIncludeDependents,
  onToggleSuggestedLevel,
}: ToolsImpactDialogProps) {
  const api = useApi()
  const input = pending ? previewInput(pending) : null
  const preview = useQuery({
    queryKey: [...queryKeys.teamTools.all, 'preview', input],
    queryFn: () => api.teamTools.previewChange(input ?? {}),
    enabled: input !== null,
    staleTime: 0,
  })

  if (!pending) return null
  const title =
    pending.kind === 'preset' ? panelCopy.impactPresetHeading(pending.name) : panelCopy.impactTitle
  const data = preview.data
  const canConfirm = data?.ok === true && !busy

  return (
    <Modal open title={title} onClose={onCancel}>
      <div className={styles.dialog}>
        <h2 className={styles.dialogTitle}>{title}</h2>
        {preview.isPending ? (
          <p role="status" className={styles.muted}>
            {panelCopy.impactPreviewLoading}
          </p>
        ) : preview.isError ? (
          <div className={styles.dialogBlock}>
            <p role="alert">{panelCopy.impactPreviewError}</p>
            <Button type="button" onClick={() => void preview.refetch()}>
              {panelCopy.retry}
            </Button>
          </div>
        ) : data ? (
          <PreviewBody
            pending={pending}
            preview={data}
            labelOf={labelOf}
            onIncludeDependents={onIncludeDependents}
            onToggleSuggestedLevel={onToggleSuggestedLevel}
          />
        ) : null}
        {error ? <p role="alert">{error}</p> : null}
        <div className={styles.dialogActions}>
          <Button type="button" onClick={onCancel}>
            {panelCopy.impactCancel}
          </Button>
          <Button type="button" variant="primary" disabled={!canConfirm} onClick={onConfirm}>
            {panelCopy.impactConfirm}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

interface PreviewBodyProps {
  readonly pending: PendingChange
  readonly preview: TeamToolsPreviewDto
  readonly labelOf: (id: string) => string
  readonly onIncludeDependents: (ids: readonly string[]) => void
  readonly onToggleSuggestedLevel: (value: boolean) => void
}

function PreviewBody({
  pending,
  preview,
  labelOf,
  onIncludeDependents,
  onToggleSuggestedLevel,
}: PreviewBodyProps) {
  if (pending.kind === 'preset') {
    return (
      <div className={styles.dialogBlock}>
        <p>{panelCopy.impactPresetDescription}</p>
        <p className={styles.muted}>
          {panelCopy.teamPresetSuggested(levelLabel(pending.suggestedLevel))}
        </p>
        <label className={styles.checkRow}>
          <input
            type="checkbox"
            checked={pending.applySuggestedLevel}
            onChange={(event) => onToggleSuggestedLevel(event.currentTarget.checked)}
          />
          {panelCopy.teamPresetApplySuggested(levelLabel(pending.suggestedLevel))}
        </label>
        <ImpactList preview={preview} labelOf={labelOf} />
      </div>
    )
  }

  const requested = pending.enable
  const auto = preview.autoEnabled.map(labelOf)
  const dependents = dependentsToInclude(preview)

  if (!preview.ok) {
    return (
      <div className={styles.dialogBlock}>
        <p role="alert">{preview.message}</p>
        {preview.dependents.map((item) => (
          <p key={item.module} className={styles.muted}>
            {panelCopy.impactDependents(
              labelOf(item.module),
              joinPt(item.requiredBy.map(labelOf)),
              item.requiredBy.length > 1,
            )}
          </p>
        ))}
        {dependents.length > 0 ? (
          <Button type="button" onClick={() => onIncludeDependents(dependents)}>
            {panelCopy.impactIncludeDependents}
          </Button>
        ) : null}
      </div>
    )
  }

  return (
    <div className={styles.dialogBlock}>
      {requested.length > 0 ? (
        <p>{panelCopy.impactEnables(joinPt(requested.map(labelOf)))}</p>
      ) : null}
      {auto.length > 0 ? <p>{panelCopy.impactAutoEnabled(joinPt(auto))}</p> : null}
      {preview.windingDown.length > 0 ? (
        <p>{panelCopy.impactWindingDown(joinPt(preview.windingDown.map(labelOf)))}</p>
      ) : null}
      <ImpactList preview={preview} labelOf={labelOf} />
    </div>
  )
}

/** Contagens do que já existe, pelas descrições do backend. Só mostra o que tem algo. */
function ImpactList({
  preview,
  labelOf,
}: {
  readonly preview: TeamToolsPreviewDto
  readonly labelOf: (id: string) => string
}) {
  const counted = preview.impact.filter((item) => item.count > 0)
  if (
    preview.windingDown.length === 0 &&
    preview.autoEnabled.length === 0 &&
    counted.length === 0
  ) {
    return null
  }
  if (counted.length === 0) {
    return <p className={styles.muted}>{panelCopy.impactNothingExisting}</p>
  }
  return (
    <section className={styles.dialogBlock} aria-label={panelCopy.impactExisting}>
      <h3 className={styles.sectionLabel}>{panelCopy.impactExisting}</h3>
      <ul className={styles.impactList}>
        {counted.map((item) => (
          <li key={item.module}>
            {item.description}
            <span className={styles.muted}> · {labelOf(item.module)}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
