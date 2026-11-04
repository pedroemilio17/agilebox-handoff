import styles from './ActionCount.module.css'

export interface ActionCountProps {
  readonly done: number
  readonly total: number
}

/** Contagem compacta de combinados "2/3" em mono, com nome acessível. Sem combinados, não aparece. */
export function ActionCount({ done, total }: ActionCountProps) {
  if (total <= 0) return null
  const label = `${done} de ${total} ${total === 1 ? 'combinado feito' : 'combinados feitos'}`
  return (
    <span className={styles.count} role="img" aria-label={label} title={label}>
      {done}/{total}
    </span>
  )
}
