import type { TopicTabItem } from './project-nav'
import styles from './TopicTabs.module.css'

export interface TopicTabsProps<T extends string> {
  readonly ariaLabel: string
  readonly items: readonly TopicTabItem<T>[]
  readonly activeId: T
  readonly onSelect: (id: T) => void
}

/** Barra sóbria de tópicos internos dentro de telas consolidadas (Sprints, Entregas, Cronograma, Configurações). */
export function TopicTabs<T extends string>({
  ariaLabel,
  items,
  activeId,
  onSelect,
}: TopicTabsProps<T>) {
  if (items.length <= 1) return null
  return (
    <nav aria-label={ariaLabel} className={styles.bar}>
      {items.map((item) => {
        const active = item.id === activeId
        return (
          <button
            key={item.id}
            type="button"
            className={`${styles.tab} ${active ? styles.active : ''}`}
            aria-current={active ? 'page' : undefined}
            aria-label={item.count ? item.label : undefined}
            onClick={() => onSelect(item.id)}
          >
            <span>{item.label}</span>
            {item.count ? (
              <span className={styles.count} aria-hidden="true">
                {item.count}
              </span>
            ) : null}
          </button>
        )
      })}
    </nav>
  )
}
