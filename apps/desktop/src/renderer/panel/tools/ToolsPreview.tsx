import type { RefObject } from 'react'
import { ApiError, type TeamModuleImpactDto } from '@agilebox/contract'
import { MODULE_LABELS, TEAM_SCOPE_NOTICE } from '@agilebox/core'
import type { ModuleId } from '@agilebox/core'
import { Button, useReducedMotion } from '@agilebox/ui'
import { panelCopy } from '../copy'
import { TOOL_IDS } from './tool-draft'
import { DISABLE_DESTINATIONS } from './tool-texts'
import type { ChangePlan } from './change-plan'
import type { ImpactState } from './use-tool-change'
import styles from './ToolsPreview.module.css'

type ItemImpact = TeamModuleImpactDto['items'][number]

export interface ToolsPreviewProps {
  readonly plan: ChangePlan
  /** Prévia do servidor para os módulos que a mudança desliga. */
  readonly impacts: readonly TeamModuleImpactDto[]
  /** Se a prévia está carregando, falhou ou chegou. Sem ela pronta, Aplicar fica travado. */
  readonly impact: ImpactState
  /** Falha da última tentativa de aplicar. Some quando o rascunho muda ou é cancelado. */
  readonly error: Error | null
  readonly pending: boolean
  readonly headingRef: RefObject<HTMLHeadingElement | null>
  readonly onApply: () => void
  readonly onCancel: () => void
}

const names = (ids: readonly ModuleId[]) => ids.map((id) => MODULE_LABELS[id]).join(' e ')
const isVisible = (id: ModuleId) => TOOL_IDS.includes(id)

/** Soma os itens de todos os módulos por tipo e destino, sem contagens zeradas. */
function aggregate(impacts: readonly TeamModuleImpactDto[]): ItemImpact[] {
  const totals = new Map<string, ItemImpact>()
  for (const impact of impacts) {
    for (const item of impact.items) {
      if (item.count === 0) continue
      const key = `${item.kind}:${item.destination}`
      const previous = totals.get(key)
      totals.set(key, { ...item, count: (previous?.count ?? 0) + item.count })
    }
  }
  return [...totals.values()]
}

function titleOf(plan: ChangePlan): string {
  if (plan.isEmpty) return panelCopy.previewNothing
  if (plan.enable.length > 0 && plan.disable.length > 0) return panelCopy.previewTitleMixed
  if (plan.disable.length > 0) return panelCopy.previewTitleOff(names(plan.disableRoots))
  return panelCopy.previewTitleOn(names(plan.enableRoots))
}

function Chips({ ids, tone }: { readonly ids: readonly ModuleId[]; readonly tone: Tone }) {
  return (
    <ul className={styles.chips}>
      {ids.map((id) => (
        <li key={id} className={`${styles.chip} ${styles[tone]}`}>
          {MODULE_LABELS[id]}
        </li>
      ))}
    </ul>
  )
}

type Tone = 'leaving' | 'entering' | 'hidden'

/**
 * Prévia da mudança em vidro, à direita do quadro 06 (M2.10b). Mostra o que muda, o que sai ou
 * entra por dependência, o destino de cada item e o aviso de escopo. Aplicar e Cancelar são
 * decididos na tela; aqui só se apresenta o estado.
 */
export function ToolsPreview({
  plan,
  impacts,
  impact,
  error,
  pending,
  headingRef,
  onApply,
  onCancel,
}: ToolsPreviewProps) {
  const reducedMotion = useReducedMotion()
  const cascadeVisible = plan.disableCascaded.filter(isVisible)
  const hiddenOut = plan.disable.filter((id) => !isVisible(id))
  // Destino de cada módulo que sai e tem destino próprio (backlog, aceite, estimativa).
  const destinations = plan.disable.flatMap((id) => {
    const text = DISABLE_DESTINATIONS[id]
    return text ? [text] : []
  })
  const items = aggregate(impacts)
  // Aplicar só libera com a prévia pronta: sem ela, não se sabe o que sai com os itens.
  const impactBlocking = impact === 'loading' || impact === 'error'
  const reason = error instanceof ApiError ? ` ${error.message}` : ''

  return (
    <aside
      aria-label={panelCopy.previewAria}
      className={`${styles.panel} ${reducedMotion ? '' : 'motion-fade-enter'}`.trim()}
    >
      <div className={styles.heading}>
        <span className={styles.label}>{panelCopy.previewLabel}</span>
        <h2 ref={headingRef} tabIndex={-1} className={styles.title}>
          {titleOf(plan)}
        </h2>
      </div>

      {plan.isEmpty ? (
        <p className={styles.muted}>{panelCopy.previewNothingHint}</p>
      ) : (
        <>
          {plan.enablePulled.length > 0 ? (
            <div className={styles.section}>
              <p className={styles.lead}>{panelCopy.previewPulled}</p>
              <Chips ids={plan.enablePulled} tone="entering" />
            </div>
          ) : null}

          {cascadeVisible.length > 0 ? (
            <div className={styles.section}>
              <p className={styles.lead}>{panelCopy.previewCascade(names(plan.disableRoots))}</p>
              <Chips ids={cascadeVisible} tone="leaving" />
            </div>
          ) : null}

          {destinations.length > 0 ? (
            <div className={styles.section}>
              {destinations.map((text) => (
                <p key={text} className={styles.lead}>
                  {text}
                </p>
              ))}
            </div>
          ) : null}

          {hiddenOut.length > 0 ? (
            <div className={styles.section}>
              <span className={styles.sectionLabel}>{panelCopy.previewHiddenOut}</span>
              <Chips ids={hiddenOut} tone="hidden" />
            </div>
          ) : null}

          {plan.disable.length > 0 ? (
            <div className={styles.section}>
              <span className={styles.sectionLabel}>{panelCopy.previewItems}</span>
              {impact === 'loading' ? (
                <p className={styles.lead}>{panelCopy.previewCalculating}</p>
              ) : impact === 'error' ? (
                <p role="alert" className={styles.alert}>
                  {panelCopy.previewImpactError}
                </p>
              ) : items.length === 0 ? (
                <p className={styles.lead}>{panelCopy.previewNoItems}</p>
              ) : (
                items.map((item) => (
                  <div key={`${item.kind}:${item.destination}`} className={styles.row}>
                    <span>{panelCopy.impactKindLabel[item.kind]}</span>
                    <span className={styles.destination}>
                      {panelCopy.impactRow(
                        item.count,
                        panelCopy.impactDestinationLabel[item.destination],
                      )}
                    </span>
                  </div>
                ))
              )}
            </div>
          ) : null}
        </>
      )}

      <div className={styles.notice}>
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
          className={styles.noticeIcon}
        >
          <circle cx="9" cy="8" r="3" />
          <circle cx="17" cy="9" r="2.5" />
          <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
          <path d="M15.5 14.2c3 .1 5.5 2.4 5.5 5.8" />
        </svg>
        <span>{TEAM_SCOPE_NOTICE}</span>
      </div>

      {error ? (
        <p role="alert" className={styles.alert}>
          {panelCopy.toolsApplyError}
          {reason}
        </p>
      ) : null}

      <div className={styles.actions}>
        <Button
          variant="primary"
          className={styles.apply}
          disabled={plan.isEmpty || pending || impactBlocking}
          onClick={onApply}
        >
          {panelCopy.previewApply}
        </Button>
        <Button className={styles.cancel} disabled={plan.isEmpty || pending} onClick={onCancel}>
          {panelCopy.previewCancel}
        </Button>
      </div>
      <p className={styles.footnote}>{panelCopy.previewFootnote}</p>
    </aside>
  )
}
