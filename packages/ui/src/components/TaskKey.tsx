import styles from './TaskKey.module.css'

export interface TaskKeyProps {
  /** ID legível da tarefa, ex.: "AB-118". Vai como texto real para leitores de tela. */
  readonly value: string
  readonly className?: string
}

export function TaskKey({ value, className }: TaskKeyProps) {
  return <span className={[styles.key, className].filter(Boolean).join(' ')}>{value}</span>
}
