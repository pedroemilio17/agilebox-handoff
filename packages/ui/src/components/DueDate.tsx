import styles from './DueDate.module.css'

export interface DueDateProps {
  /** Data no formato AAAA-MM-DD. */
  readonly date: string
  /** Vencido e não feito. O texto "atrasado" aparece junto, nunca só a cor. */
  readonly overdue?: boolean
}

/** Prazo em mono no formato dd/mm/aaaa. Vencido ganha o rótulo "atrasado" em vermelho. */
export function DueDate({ date, overdue = false }: DueDateProps) {
  const [year, month, day] = date.split('-')
  return (
    <span className={styles.due}>
      <time dateTime={date}>{`${day}/${month}/${year}`}</time>
      {overdue ? <span className={styles.overdue}>atrasado</span> : null}
    </span>
  )
}
