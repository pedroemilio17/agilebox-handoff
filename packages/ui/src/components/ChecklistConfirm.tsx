import styles from './ChecklistConfirm.module.css'

export interface ChecklistConfirmItem {
  readonly id: string
  readonly title: string
}

export interface ChecklistConfirmProps {
  /** Nome acessível da lista (ex.: "Itens da definição de pronto"). */
  readonly label: string
  readonly items: readonly ChecklistConfirmItem[]
  /** Ids já marcados; a lista é controlada pelo chamador. */
  readonly checkedIds: ReadonlySet<string>
  readonly onToggle: (id: string, checked: boolean) => void
  readonly disabled?: boolean
}

/** Lista de conferência: um checkbox com rótulo real por item, para confirmar antes de concluir. */
export function ChecklistConfirm({
  label,
  items,
  checkedIds,
  onToggle,
  disabled = false,
}: ChecklistConfirmProps) {
  return (
    <ul aria-label={label} className={styles.list}>
      {items.map((item) => (
        <li key={item.id} className={styles.item}>
          <label className={styles.label}>
            <input
              type="checkbox"
              className={styles.checkbox}
              checked={checkedIds.has(item.id)}
              disabled={disabled}
              onChange={(event) => onToggle(item.id, event.currentTarget.checked)}
            />
            <span className={checkedIds.has(item.id) ? styles.checkedText : undefined}>
              {item.title}
            </span>
          </label>
        </li>
      ))}
    </ul>
  )
}
