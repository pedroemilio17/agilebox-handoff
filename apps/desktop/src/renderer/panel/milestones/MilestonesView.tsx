import { useId, useState, type FormEvent } from 'react'
import type { MilestoneListItemDto } from '@agilebox/contract'
import { AddButton, Button, EmptyState } from '@agilebox/ui'
import { useCapabilities } from '../../shared/capabilities/capabilities-context'
import { todayDateOnly } from '../../shared/lib/today'
import { ModuleEmptyState } from '../guide/ModuleEmptyState'
import { ModuleHelpButton } from '../guide/ModuleHelpButton'
import type { PanelView } from '../layout/PanelShell'
import { useWbs } from '../hooks/use-wbs'
import {
  useCreateMilestone,
  useMilestones,
  useRemoveMilestone,
  useUpdateMilestone,
} from '../hooks/use-milestones'
import { actionErrorText } from '../wbs/wbs-screen'
import {
  criterionOrNull,
  daysLeftText,
  deliverableLabel,
  shortDateLabel,
  validateMilestoneForm,
  type MilestoneFormErrors,
  type MilestoneFormValues,
} from './milestone-rules'
import styles from './MilestonesView.module.css'

const copy = {
  title: 'Marcos',
  noProject: 'Escolha um projeto para ver os marcos.',
  listLabel: 'Lista de marcos',
  loading: 'Carregando os marcos…',
  loadError: 'Não foi possível carregar os marcos deste projeto.',
  retry: 'Tentar de novo',
  readOnly: 'Só o gestor ou quem criou o projeto edita os marcos.',
  newMilestone: 'Novo marco',
  save: 'Salvar',
  cancel: 'Cancelar',
  edit: 'Editar',
  remove: 'Remover',
  confirmRemove: 'Confirmar remoção',
  titleLabel: 'Título do marco',
  dateLabel: 'Data',
  deliverableLabel: 'Entrega',
  noDeliverable: 'Sem entrega',
  criterionLabel: 'Critério (opcional)',
  deliverableText: 'Entrega',
  criterionText: 'Critério',
  formTitleNew: 'Novo marco',
  formTitleEdit: 'Editar marco',
} as const

export interface MilestonesViewProps {
  /** Projeto selecionado no painel. Sem ele, a tela pede para escolher um. */
  readonly projectId: string | null
  readonly projectName: string | null
  /** Leva a outra tela, pelo painel de ajuda. */
  readonly onNavigate?: (view: PanelView) => void
}

/** Valores que a tela envia ao criar ou editar. A entrega só vai quando a EAP está ligada. */
interface MilestoneSubmit {
  readonly title: string
  readonly dueOn: string
  /** Ausente quando a EAP não está ligada: na criação vira nulo, na edição o marco mantém a entrega. */
  readonly deliverableId?: string | null
  readonly criterion: string | null
}

/**
 * Marcos do projeto: lista por data, com criação, edição e remoção para quem pode editar a
 * estrutura. Quem não pode vê tudo em leitura. Toda ação espera o servidor.
 */
export function MilestonesView({ projectId, projectName, onNavigate }: MilestonesViewProps) {
  const capabilities = useCapabilities()
  // A EAP só aparece (e só se consulta) quando o módulo `wbs` está ligado no projeto selecionado.
  const wbsOn = capabilities.showScreen('wbs')
  const query = useMilestones(projectId)
  const wbs = useWbs(wbsOn ? projectId : null)
  const create = useCreateMilestone()
  const update = useUpdateMilestone()
  const remove = useRemoveMilestone()
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

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

  const view = query.data
  const { canEdit } = view
  const empty = view.milestones.length === 0
  const today = todayDateOnly()
  const deliverables = (wbs.data?.deliverables ?? []).flatMap((row) =>
    row.kind === 'deliverable' ? [row] : [],
  )

  async function submit(values: MilestoneSubmit, milestoneId: string | null): Promise<boolean> {
    setActionError(null)
    try {
      if (milestoneId === null) {
        await create.mutateAsync({ projectId: projectId!, deliverableId: null, ...values })
        setAdding(false)
      } else {
        await update.mutateAsync({ milestoneId, ...values })
        setEditingId(null)
      }
      return true
    } catch (error) {
      setActionError(actionErrorText(error))
      return false
    }
  }

  async function removeMilestone(milestoneId: string): Promise<boolean> {
    setActionError(null)
    try {
      await remove.mutateAsync({ milestoneId })
      return true
    } catch (error) {
      setActionError(actionErrorText(error))
      return false
    }
  }

  return (
    <section aria-label={copy.title} className={styles.view}>
      <header className={styles.header}>
        <div className={styles.titleRow}>
          <h2 className={styles.title}>{copy.title}</h2>
          {projectName ? <span className={styles.project}>{projectName}</span> : null}
          <ModuleHelpButton
            moduleId="milestones"
            projectId={projectId}
            {...(onNavigate ? { onNavigate } : {})}
          />
          <span className={styles.spacer} />
          {canEdit && !empty && !adding ? (
            <AddButton type="button" variant="primary" onClick={() => setAdding(true)}>
              {copy.newMilestone}
            </AddButton>
          ) : null}
        </div>
        {canEdit ? null : (
          <p role="note" className={styles.note}>
            {copy.readOnly}
          </p>
        )}
      </header>

      {actionError ? (
        <p role="alert" className={styles.error}>
          {actionError}
        </p>
      ) : null}

      {canEdit && adding ? (
        <MilestoneForm
          heading={copy.formTitleNew}
          wbsOn={wbsOn}
          deliverables={deliverables}
          onSubmit={(values) => submit(values, null)}
          onCancel={() => setAdding(false)}
        />
      ) : null}

      {empty && !adding ? (
        <ModuleEmptyState
          moduleId="milestones"
          projectId={projectId}
          fallbackTitle="Nenhum marco ainda."
        >
          {canEdit ? (
            <AddButton type="button" variant="primary" onClick={() => setAdding(true)}>
              {copy.newMilestone}
            </AddButton>
          ) : null}
        </ModuleEmptyState>
      ) : null}

      {!empty ? (
        <ol className={styles.list} aria-label={copy.listLabel}>
          {view.milestones.map((milestone) =>
            canEdit && editingId === milestone.id ? (
              <li key={milestone.id} className={styles.item}>
                <MilestoneForm
                  heading={copy.formTitleEdit}
                  wbsOn={wbsOn}
                  deliverables={deliverables}
                  initial={milestone}
                  onSubmit={(values) => submit(values, milestone.id)}
                  onCancel={() => setEditingId(null)}
                />
              </li>
            ) : (
              <MilestoneRow
                key={milestone.id}
                milestone={milestone}
                today={today}
                canEdit={canEdit}
                onEdit={() => setEditingId(milestone.id)}
                onRemove={() => removeMilestone(milestone.id)}
              />
            ),
          )}
        </ol>
      ) : null}
    </section>
  )
}

interface MilestoneRowProps {
  readonly milestone: MilestoneListItemDto
  readonly today: string
  readonly canEdit: boolean
  readonly onEdit: () => void
  readonly onRemove: () => Promise<boolean>
}

function MilestoneRow({ milestone, today, canEdit, onEdit, onRemove }: MilestoneRowProps) {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const left = daysLeftText(milestone.dueOn, today)

  async function confirm() {
    setBusy(true)
    const removed = await onRemove()
    setBusy(false)
    if (!removed) setConfirming(false)
  }

  return (
    <li className={styles.item}>
      <span className={styles.diamond} aria-hidden="true" />
      <div className={styles.body}>
        <h3 className={styles.itemTitle}>{milestone.title}</h3>
        <p className={styles.meta}>
          <time dateTime={milestone.dueOn}>{shortDateLabel(milestone.dueOn)}</time>
          {left ? <span> · {left}</span> : null}
        </p>
        {milestone.deliverableTitle ? (
          <p className={styles.detail}>
            {copy.deliverableText}: {milestone.deliverableTitle}
          </p>
        ) : null}
        {milestone.criterion ? (
          <p className={styles.detail}>
            {copy.criterionText}: {milestone.criterion}
          </p>
        ) : null}
        {canEdit && !confirming ? (
          <div className={styles.actions}>
            <Button type="button" onClick={onEdit}>
              {copy.edit}
            </Button>
            <Button type="button" onClick={() => setConfirming(true)}>
              {copy.remove}
            </Button>
          </div>
        ) : null}
        {canEdit && confirming ? (
          <div
            className={styles.confirm}
            role="group"
            aria-label={`Confirmar remoção de ${milestone.title}`}
          >
            <span>Remover “{milestone.title}”?</span>
            <Button type="button" disabled={busy} onClick={() => void confirm()}>
              {copy.confirmRemove}
            </Button>
            <Button type="button" onClick={() => setConfirming(false)}>
              {copy.cancel}
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

interface MilestoneFormProps {
  readonly heading: string
  readonly wbsOn: boolean
  readonly deliverables: readonly DeliverableOption[]
  readonly initial?: MilestoneListItemDto
  readonly onSubmit: (values: MilestoneSubmit) => Promise<boolean>
  readonly onCancel: () => void
}

/**
 * Formulário inline de criar e editar. O campo de entrega só existe com a EAP ligada; sem ela, a
 * edição não mexe na entrega do marco.
 */
function MilestoneForm({
  heading,
  wbsOn,
  deliverables,
  initial,
  onSubmit,
  onCancel,
}: MilestoneFormProps) {
  const ids = { title: useId(), dueOn: useId(), deliverable: useId(), criterion: useId() }
  const [values, setValues] = useState<MilestoneFormValues & { readonly deliverableId: string }>({
    title: initial?.title ?? '',
    dueOn: initial?.dueOn ?? '',
    criterion: initial?.criterion ?? '',
    deliverableId: initial?.deliverableId ?? '',
  })
  const [errors, setErrors] = useState<MilestoneFormErrors>({})
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    const found = validateMilestoneForm(values)
    setErrors(found)
    if (Object.keys(found).length > 0 || busy) return
    setBusy(true)
    await onSubmit({
      title: values.title.trim(),
      dueOn: values.dueOn,
      criterion: criterionOrNull(values.criterion),
      // Sem a EAP ligada, a entrega não é enviada: o marco mantém a que já tinha.
      ...(wbsOn
        ? { deliverableId: values.deliverableId === '' ? null : values.deliverableId }
        : {}),
    })
    setBusy(false)
  }

  return (
    <form className={styles.form} onSubmit={(event) => void submit(event)} noValidate>
      <h3 className={styles.formHeading}>{heading}</h3>
      <div className={styles.fields}>
        <div className={styles.field}>
          <label htmlFor={ids.title}>{copy.titleLabel}</label>
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
          <label htmlFor={ids.dueOn}>{copy.dateLabel}</label>
          <input
            id={ids.dueOn}
            type="date"
            value={values.dueOn}
            aria-invalid={errors.dueOn !== undefined}
            aria-describedby={errors.dueOn ? `${ids.dueOn}-error` : undefined}
            onChange={(event) => setValues({ ...values, dueOn: event.target.value })}
          />
          {errors.dueOn ? (
            <p id={`${ids.dueOn}-error`} className={styles.fieldError}>
              {errors.dueOn}
            </p>
          ) : null}
        </div>
        {wbsOn ? (
          <div className={styles.field}>
            <label htmlFor={ids.deliverable}>{copy.deliverableLabel}</label>
            <select
              id={ids.deliverable}
              value={values.deliverableId}
              onChange={(event) => setValues({ ...values, deliverableId: event.target.value })}
            >
              <option value="">{copy.noDeliverable}</option>
              {deliverables.map((row) => (
                <option key={row.id} value={row.id}>
                  {deliverableLabel(row.code, row.title)}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <div className={styles.field}>
          <label htmlFor={ids.criterion}>{copy.criterionLabel}</label>
          <input
            id={ids.criterion}
            type="text"
            maxLength={280}
            value={values.criterion}
            aria-invalid={errors.criterion !== undefined}
            aria-describedby={errors.criterion ? `${ids.criterion}-error` : undefined}
            onChange={(event) => setValues({ ...values, criterion: event.target.value })}
          />
          {errors.criterion ? (
            <p id={`${ids.criterion}-error`} className={styles.fieldError}>
              {errors.criterion}
            </p>
          ) : null}
        </div>
      </div>
      <div className={styles.actions}>
        <Button type="submit" variant="primary" disabled={busy}>
          {copy.save}
        </Button>
        <Button type="button" onClick={onCancel}>
          {copy.cancel}
        </Button>
      </div>
    </form>
  )
}
