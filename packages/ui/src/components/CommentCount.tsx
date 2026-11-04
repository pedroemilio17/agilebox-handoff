import styles from './CommentCount.module.css'

export interface CommentCountProps {
  readonly count: number
}

/** Contador compacto de comentários: balão e número em mono. Sem comentários, não aparece. */
export function CommentCount({ count }: CommentCountProps) {
  if (count <= 0) return null
  const label = count === 1 ? '1 comentário' : `${count} comentários`
  return (
    <span className={styles.count} role="img" aria-label={label} title={label}>
      <svg
        aria-hidden="true"
        width="11"
        height="11"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      >
        <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />
      </svg>
      <span aria-hidden="true">{count}</span>
    </span>
  )
}
