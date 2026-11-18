import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Button } from '@agilebox/ui'
import { guidedFieldLabel, nextFieldIndex } from './wbs-screen'
import styles from './WbsView.module.css'

export const wbsCopy = {
  newDeliverable: 'Nova entrega',
  create: 'Criar',
  cancel: 'Cancelar',
  save: 'Salvar',
  subdeliverable: 'Subentrega',
  rename: 'Renomear',
  moveUp: 'Subir',
  moveDown: 'Descer',
  remove: 'Remover',
  confirmRemove: 'Confirmar remoção',
  startTitle: 'Liste as entregas principais',
  startStep: 'Passo 1',
  startText:
    'A EAP divide o projeto pelo que será entregue, não pelo que será feito. Comece com 3 a 6 grandes entregas. As tarefas vêm no passo 2.',
  startNote: 'O passo se conclui sozinho ao criar a primeira entrega.',
  tipNouns: 'Use substantivos',
  tipNounsText:
    '“Módulo financeiro configurado”, e não “configurar o financeiro”. Assim fica claro quando a entrega está pronta.',
  tipComplete: 'Nada fica de fora',
  tipCompleteText:
    'Tudo o que o projeto entrega precisa caber em alguma entrega. O que não couber, não está no escopo.',
  enterHint: 'Enter cria e vai para o próximo',
  done: 'Fechar passo',
} as const

interface NewDeliverableFormProps {
  /** Rótulo do campo, que diz onde a entrega entra. */
  readonly label: string
  readonly submitLabel?: string
  readonly autoFocus?: boolean
  /** Devolve `true` quando criou, para o formulário limpar e fechar. */
  readonly onSubmit: (title: string) => Promise<boolean>
  readonly onCancel: () => void
  readonly disabled?: boolean
}

/** Campo de nome de entrega: Enter cria, Esc cancela, "Criar" fica desligado com texto vazio. */
export function NewDeliverableForm({
  label,
  submitLabel = wbsCopy.create,
  autoFocus = true,
  onSubmit,
  onCancel,
  disabled = false,
}: NewDeliverableFormProps) {
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const inputId = useId()
  const trimmed = title.trim()
  const canSubmit = trimmed !== '' && !busy && !disabled

  async function submit(event?: FormEvent) {
    event?.preventDefault()
    if (!canSubmit) return
    setBusy(true)
    const created = await onSubmit(trimmed)
    setBusy(false)
    if (created) setTitle('')
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      onCancel()
    }
  }

  return (
    <form className={styles.inlineForm} onSubmit={(event) => void submit(event)}>
      <label className={styles.inlineLabel} htmlFor={inputId}>
        {label}
      </label>
      <input
        id={inputId}
        className={styles.inlineInput}
        type="text"
        value={title}
        autoFocus={autoFocus}
        maxLength={200}
        disabled={disabled}
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={onKeyDown}
      />
      <Button type="submit" variant="primary" disabled={!canSubmit}>
        {submitLabel}
      </Button>
      <Button type="button" onClick={onCancel}>
        {wbsCopy.cancel}
      </Button>
    </form>
  )
}

interface GuidedStartProps {
  /** Cria a entrega e devolve `true` quando deu certo. */
  readonly onCreate: (title: string) => Promise<boolean>
  /** Fecha o passo. Só aparece quando já há entregas (sem entrega, o passo é o estado vazio). */
  readonly onDone?: () => void
}

/**
 * Passo 1 do guia: campos numerados que criam entregas direto. Enter cria a entrega e foca o próximo
 * campo; no último, abre um campo novo.
 */
export function GuidedStart({ onCreate, onDone }: GuidedStartProps) {
  const [drafts, setDrafts] = useState<string[]>(['', ''])
  const inputs = useRef<(HTMLInputElement | null)[]>([])
  const pendingFocus = useRef<number | null>(null)
  const headingId = useId()

  // Foco pedido depois de uma criação (o campo novo só existe depois da renderização).
  useEffect(() => {
    const index = pendingFocus.current
    if (index === null) return
    pendingFocus.current = null
    inputs.current[index]?.focus()
  })

  function setDraft(index: number, value: string) {
    setDrafts((current) => current.map((item, position) => (position === index ? value : item)))
  }

  async function createAt(index: number) {
    const title = (drafts[index] ?? '').trim()
    if (title === '') return
    const created = await onCreate(title)
    if (!created) return
    setDrafts((current) => {
      const next = current.map((item, position) => (position === index ? '' : item))
      if (nextFieldIndex(index, next.length) === null) next.push('')
      return next
    })
    pendingFocus.current = nextFieldIndex(index, drafts.length) ?? drafts.length
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>, index: number) {
    if (event.key !== 'Enter') return
    event.preventDefault()
    void createAt(index)
  }

  return (
    <section aria-labelledby={headingId} className={styles.start}>
      <div className={styles.startHead}>
        <span className={styles.startStep}>{wbsCopy.startStep}</span>
        <h2 id={headingId} className={styles.startTitle}>
          {wbsCopy.startTitle}
        </h2>
        <p className={styles.startText}>{wbsCopy.startText}</p>
      </div>

      <div className={styles.startFields}>
        {drafts.map((draft, index) => {
          const label = guidedFieldLabel(index)
          return (
            <label key={index} className={styles.startField}>
              <span className={styles.startNumber} aria-hidden="true">
                {index + 1}
              </span>
              <input
                ref={(element) => {
                  inputs.current[index] = element
                }}
                className={styles.startInput}
                type="text"
                aria-label={label}
                placeholder={index === 0 ? undefined : 'Próxima entrega'}
                maxLength={200}
                value={draft}
                onChange={(event) => setDraft(index, event.target.value)}
                onKeyDown={(event) => onKeyDown(event, index)}
              />
              {index === 0 ? <span className={styles.startHint}>{wbsCopy.enterHint}</span> : null}
            </label>
          )
        })}
      </div>

      <div className={styles.tips}>
        <div className={styles.tip}>
          <span className={styles.tipTitle}>{wbsCopy.tipNouns}</span>
          <span className={styles.tipText}>{wbsCopy.tipNounsText}</span>
        </div>
        <div className={styles.tip}>
          <span className={styles.tipTitle}>{wbsCopy.tipComplete}</span>
          <span className={styles.tipText}>{wbsCopy.tipCompleteText}</span>
        </div>
      </div>

      <div className={styles.startFooter}>
        <span className={styles.muted}>{wbsCopy.startNote}</span>
        {onDone ? (
          <Button type="button" onClick={onDone}>
            {wbsCopy.done}
          </Button>
        ) : null}
      </div>
    </section>
  )
}
