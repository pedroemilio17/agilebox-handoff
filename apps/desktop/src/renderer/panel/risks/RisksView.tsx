import { useId, useState, type FormEvent } from 'react'
import type { RiskListItemDto } from '@agilebox/contract'
import { AddButton, Button, EmptyState } from '@agilebox/ui'
import { useCapabilities } from '../../shared/capabilities/capabilities-context'
import type { PanelView } from '../layout/PanelShell'
import { useWbs } from '../hooks/use-wbs'
import {
  useCreateRisk,
  useRemoveRisk,
  useRiskOwners,
  useRisks,
  useUpdateRisk,
} from '../hooks/use-risks'
import { actionErrorText } from '../wbs/wbs-screen'
import {
  idOrNull,
  levelLabel,
  RISK_LEVEL_OPTIONS,
  RISK_STATUS_OPTIONS,
  riskCopy,
  riskSummary,
  statusLabel,
  textOrNull,
  validateRiskForm,
  type RiskFormErrors,
  type RiskFormValues,
} from './risk-rules'
import { RiskMatrix, type RiskCell } from './RiskMatrix'
import styles from './RisksView.module.css'

export interface RisksViewProps {
  /** Projeto selecionado no painel. Sem ele, a tela pede para escolher um. */
  readonly projectId: string | null
  readonly projectName: string | null
  /** Leva a outra tela, pelo painel de ajuda. */
  readonly onNavigate?: (view: PanelView) => void
}

/** Valores que a tela envia. Dono e entrega só vão quando a tela os mostra (EAP ligada). */
interface RiskSubmit {
  readonly title: string
  readonly description: string | null
  readonly probability: RiskFormValues['probability']
  readonly impact: RiskFormValues['impact']
  readonly response: string | null
  readonly ownerId: string | null
  readonly deliverableId?: string | null
  readonly status?: RiskFormValues['status']
}

/**
 * Riscos do projeto, do maior para o menor (probabilidade × impacto). Criar, editar e remover é do
 * gestor ou de quem criou o projeto; os outros veem a lista em leitura. Toda ação espera o servidor.
 */
export function RisksView({ projectId, projectName }: RisksViewProps) {
  const capabilities = useCapabilities()
  // A entrega só aparece (e só se consulta) quando o módulo `wbs` está ligado no projeto selecionado.
  const wbsOn = capabilities.showScreen('wbs')
  const query = useRisks(projectId)
  const wbs = useWbs(wbsOn ? projectId : null)
  const owners = useRiskOwners(projectId)
  const create = useCreateRisk()
  const update = useUpdateRisk()
  const remove = useRemoveRisk()
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  // Quadrante da matriz 3×3 escolhido: filtra a lista. Nulo mostra todos.
  const [cell, setCell] = useState<RiskCell | null>(null)

  if (projectId === null) {
    return (
      <section aria-label={riskCopy.title} className={styles.view}>
        <EmptyState title={riskCopy.noProject} />
      </section>
    )
  }

  if (query.isPending) {
    return (
      <section aria-label={riskCopy.title} className={styles.view}>
        <p role="status" className={styles.muted}>
          {riskCopy.loading}
        </p>
      </section>
    )
  }

  if (query.isError || !query.data) {
    return (
      <section aria-label={riskCopy.title} className={styles.view}>
        <div role="alert" className={styles.errorBox}>
          <p className={styles.error}>{riskCopy.loadError}</p>
          <Button type="button" onClick={() => void query.refetch()}>
            {riskCopy.retry}
          </Button>
        </div>
      </section>
    )
  }

  const view = query.data
  const { canEdit } = view
  const empty = view.risks.length === 0
  const shownRisks =
    cell === null
      ? view.risks
      : view.risks.filter(
          (risk) => risk.probability === cell.probability && risk.impact === cell.impact,
        )
  const deliverables = (wbs.data?.deliverables ?? []).flatMap((row) =>
    row.kind === 'deliverable' ? [row] : [],
  )
  const ownerOptions = (owners.data ?? []).map((member) => ({ id: member.id, name: member.name }))

  async function submit(values: RiskSubmit, riskId: string | null): Promise<boolean> {
    setActionError(null)
    try {
      if (riskId === null) {
        await create.mutateAsync({
          projectId: projectId!,
          title: values.title,
          description: values.description,
          probability: values.probability,
          impact: values.impact,
          response: values.response,
          ownerId: values.ownerId,
          deliverableId: values.deliverableId ?? null,
        })
        setAdding(false)
      } else {
        await update.mutateAsync({ riskId, ...values })
        setEditingId(null)
      }
      return true
    } catch (error) {
      setActionError(actionErrorText(error))
      return false
    }
  }

  async function removeRisk(riskId: string): Promise<boolean> {
    setActionError(null)
    try {
      await remove.mutateAsync({ riskId })
      return true
    } catch (error) {
      setActionError(actionErrorText(error))
      return false
    }
  }

  return (
    <section aria-label={riskCopy.title} className={styles.view}>
      <header className={styles.header}>
        <div className={styles.titleRow}>
          <h2 className={styles.title}>{riskCopy.title}</h2>
          {projectName ? <span className={styles.project}>{projectName}</span> : null}
          <span className={styles.spacer} />
          {canEdit && !empty && !adding ? (
            <AddButton type="button" variant="primary" onClick={() => setAdding(true)}>
              {riskCopy.newRisk}
            </AddButton>
          ) : null}
        </div>
        {canEdit ? null : (
          <p role="note" className={styles.note}>
            {riskCopy.readOnly}
          </p>
        )}
      </header>

      {actionError ? (
        <p role="alert" className={styles.error}>
          {actionError}
        </p>
      ) : null}

      {canEdit && adding ? (
        <RiskForm
          heading={riskCopy.formTitleNew}
          wbsOn={wbsOn}
          deliverables={deliverables}
          owners={ownerOptions}
          onSubmit={(values) => submit(values, null)}
          onCancel={() => setAdding(false)}
        />
      ) : null}

      {empty && !adding ? (
        <>
          <EmptyState title="Nenhum risco registrado." />
          {canEdit ? (
            <AddButton type="button" variant="primary" onClick={() => setAdding(true)}>
              {riskCopy.newRisk}
            </AddButton>
          ) : null}
        </>
      ) : null}

      {!empty ? (
        <div className={styles.risksLayout}>
          <RiskMatrix risks={view.risks} selected={cell} onSelect={setCell} />
          <div className={styles.risksColumn}>
            {shownRisks.length === 0 ? (
              <p className={styles.muted}>Nenhum risco neste quadrante.</p>
            ) : null}

            {shownRisks.length > 0 ? (
              <ol className={styles.list} aria-label={riskCopy.listLabel}>
                {shownRisks.map((risk) =>
                  canEdit && editingId === risk.id ? (
                    <li key={risk.id} className={styles.item}>
                      <RiskForm
                        heading={riskCopy.formTitleEdit}
                        wbsOn={wbsOn}
                        deliverables={deliverables}
                        owners={ownerOptions}
                        initial={risk}
                        onSubmit={(values) => submit(values, risk.id)}
                        onCancel={() => setEditingId(null)}
                      />
                    </li>
                  ) : (
                    <RiskRow
                      key={risk.id}
                      risk={risk}
                      canEdit={canEdit}
                      onEdit={() => setEditingId(risk.id)}
                      onRemove={() => removeRisk(risk.id)}
                    />
                  ),
                )}
              </ol>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  )
}

const BAND_CLASS = {
  low: styles.bandLow,
  medium: styles.bandMedium,
  high: styles.bandHigh,
} as const

interface RiskRowProps {
  readonly risk: RiskListItemDto
  readonly canEdit: boolean
  readonly onEdit: () => void
  readonly onRemove: () => Promise<boolean>
}

function RiskRow({ risk, canEdit, onEdit, onRemove }: RiskRowProps) {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const summary = riskSummary(risk.probability, risk.impact)

  async function confirm() {
    setBusy(true)
    const removed = await onRemove()
    setBusy(false)
    if (!removed) setConfirming(false)
  }

  return (
    <li className={styles.item}>
      <div className={styles.body}>
        <div className={styles.chipRow}>
          <span className={`${styles.chip} ${BAND_CLASS[summary.band]}`}>{summary.text}</span>
          <span className={styles.status}>{statusLabel(risk.status)}</span>
        </div>
        <h3 className={styles.itemTitle}>{risk.title}</h3>
        <p className={styles.meta}>
          Probabilidade {levelLabel(risk.probability).toLowerCase()} · Impacto{' '}
          {levelLabel(risk.impact).toLowerCase()}
        </p>
        {risk.description ? <p className={styles.detail}>{risk.description}</p> : null}
        <p className={styles.detail}>
          {riskCopy.ownerText}: {risk.ownerName ?? riskCopy.noOwner}
        </p>
        {risk.deliverableTitle ? (
          <p className={styles.detail}>
            {riskCopy.deliverableText}: {risk.deliverableTitle}
          </p>
        ) : null}
        {risk.response ? (
          <p className={styles.detail}>
            {riskCopy.responseText}: {risk.response}
          </p>
        ) : null}
        {canEdit && !confirming ? (
          <div className={styles.actions}>
            <Button type="button" onClick={onEdit}>
              {riskCopy.edit}
            </Button>
            <Button type="button" onClick={() => setConfirming(true)}>
              {riskCopy.remove}
            </Button>
          </div>
        ) : null}
        {canEdit && confirming ? (
          <div
            className={styles.confirm}
            role="group"
            aria-label={`Confirmar remoção de ${risk.title}`}
          >
            <span>Remover “{risk.title}”?</span>
            <Button type="button" disabled={busy} onClick={() => void confirm()}>
              {riskCopy.confirmRemove}
            </Button>
            <Button type="button" onClick={() => setConfirming(false)}>
              {riskCopy.cancel}
            </Button>
          </div>
        ) : null}
      </div>
    </li>
  )
}

interface DeliverableOption {
  readonly id: string
  readonly code: string
  readonly title: string
}

interface RiskFormProps {
  readonly heading: string
  readonly wbsOn: boolean
  readonly deliverables: readonly DeliverableOption[]
  readonly owners: readonly { readonly id: string; readonly name: string }[]
  readonly initial?: RiskListItemDto
  readonly onSubmit: (values: RiskSubmit) => Promise<boolean>
  readonly onCancel: () => void
}

/** Formulário inline de criar e editar. Situação só aparece na edição; entrega só com a EAP ligada. */
function RiskForm({
  heading,
  wbsOn,
  deliverables,
  owners,
  initial,
  onSubmit,
  onCancel,
}: RiskFormProps) {
  const ids = {
    title: useId(),
    description: useId(),
    probability: useId(),
    impact: useId(),
    response: useId(),
    owner: useId(),
    deliverable: useId(),
    status: useId(),
  }
  const [values, setValues] = useState<RiskFormValues>({
    title: initial?.title ?? '',
    description: initial?.description ?? '',
    probability: initial?.probability ?? 2,
    impact: initial?.impact ?? 2,
    response: initial?.response ?? '',
    ownerId: initial?.ownerId ?? '',
    deliverableId: initial?.deliverableId ?? '',
    status: initial?.status ?? 'open',
  })
  const [errors, setErrors] = useState<RiskFormErrors>({})
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    const found = validateRiskForm(values)
    setErrors(found)
    if (Object.keys(found).length > 0 || busy) return
    setBusy(true)
    await onSubmit({
      title: values.title.trim(),
      description: textOrNull(values.description),
      probability: values.probability,
      impact: values.impact,
      response: textOrNull(values.response),
      ownerId: idOrNull(values.ownerId),
      // Sem a EAP ligada, a entrega não é enviada: o risco mantém a que já tinha.
      ...(wbsOn ? { deliverableId: idOrNull(values.deliverableId) } : {}),
      ...(initial ? { status: values.status } : {}),
    })
    setBusy(false)
  }

  return (
    <form className={styles.form} onSubmit={(event) => void submit(event)} noValidate>
      <h3 className={styles.formHeading}>{heading}</h3>
      <div className={styles.fields}>
        <div className={styles.field}>
          <label htmlFor={ids.title}>{riskCopy.titleLabel}</label>
          <input
            id={ids.title}
            type="text"
            maxLength={200}
            value={values.title}
            aria-invalid={errors.title !== undefined}
            aria-describedby={errors.title ? `${ids.title}-error` : undefined}
            onChange={(event) => setValues({ ...values, title: event.target.value })}
          />
          {errors.title ? (
            <p id={`${ids.title}-error`} className={styles.fieldError}>
              {errors.title}
            </p>
          ) : null}
        </div>
        <div className={styles.field}>
          <label htmlFor={ids.probability}>{riskCopy.probabilityLabel}</label>
          <select
            id={ids.probability}
            value={values.probability}
            onChange={(event) =>
              setValues({ ...values, probability: Number(event.target.value) as 1 | 2 | 3 })
            }
          >
            {RISK_LEVEL_OPTIONS.map((level) => (
              <option key={level} value={level}>
                {levelLabel(level)}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.field}>
          <label htmlFor={ids.impact}>{riskCopy.impactLabel}</label>
          <select
            id={ids.impact}
            value={values.impact}
            onChange={(event) =>
              setValues({ ...values, impact: Number(event.target.value) as 1 | 2 | 3 })
            }
          >
            {RISK_LEVEL_OPTIONS.map((level) => (
              <option key={level} value={level}>
                {levelLabel(level)}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.field}>
          <label htmlFor={ids.owner}>{riskCopy.ownerLabel}</label>
          <select
            id={ids.owner}
            value={values.ownerId}
            onChange={(event) => setValues({ ...values, ownerId: event.target.value })}
          >
            <option value="">{riskCopy.noOwner}</option>
            {owners.map((owner) => (
              <option key={owner.id} value={owner.id}>
                {owner.name}
              </option>
            ))}
          </select>
        </div>
        {wbsOn ? (
          <div className={styles.field}>
            <label htmlFor={ids.deliverable}>{riskCopy.deliverableLabel}</label>
            <select
              id={ids.deliverable}
              value={values.deliverableId}
              onChange={(event) => setValues({ ...values, deliverableId: event.target.value })}
            >
              <option value="">{riskCopy.noDeliverable}</option>
              {deliverables.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.code} · {row.title}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        {initial ? (
          <div className={styles.field}>
            <label htmlFor={ids.status}>{riskCopy.statusLabel}</label>
            <select
              id={ids.status}
              value={values.status}
              onChange={(event) =>
                setValues({ ...values, status: event.target.value as RiskFormValues['status'] })
              }
            >
              {RISK_STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {statusLabel(status)}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <div className={`${styles.field} ${styles.wide}`}>
          <label htmlFor={ids.description}>{riskCopy.descriptionLabel}</label>
          <textarea
            id={ids.description}
            rows={2}
            maxLength={1000}
            value={values.description}
            aria-invalid={errors.description !== undefined}
            aria-describedby={errors.description ? `${ids.description}-error` : undefined}
            onChange={(event) => setValues({ ...values, description: event.target.value })}
          />
          {errors.description ? (
            <p id={`${ids.description}-error`} className={styles.fieldError}>
              {errors.description}
            </p>
          ) : null}
        </div>
        <div className={`${styles.field} ${styles.wide}`}>
          <label htmlFor={ids.response}>{riskCopy.responseLabel}</label>
          <input
            id={ids.response}
            type="text"
            maxLength={280}
            value={values.response}
            aria-invalid={errors.response !== undefined}
            aria-describedby={errors.response ? `${ids.response}-error` : undefined}
            onChange={(event) => setValues({ ...values, response: event.target.value })}
          />
          {errors.response ? (
            <p id={`${ids.response}-error`} className={styles.fieldError}>
              {errors.response}
            </p>
          ) : null}
        </div>
      </div>
      <div className={styles.actions}>
        <Button type="submit" variant="primary" disabled={busy}>
          {riskCopy.save}
        </Button>
        <Button type="button" onClick={onCancel}>
          {riskCopy.cancel}
        </Button>
      </div>
    </form>
  )
}
