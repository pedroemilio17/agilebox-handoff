import type { CSSProperties, ReactNode } from 'react'
import styles from './clean-ui.module.css'

/** Cabeçalho de página do desenho (`.ab-page-head`): título, subtítulo e ações à direita. */
export function PageHead({
  title,
  subtitle,
  actions,
}: {
  readonly title: string
  readonly subtitle?: string
  readonly actions?: ReactNode
}) {
  return (
    <header className={styles.pageHead}>
      <div className={styles.pageHeadMain}>
        <h1 className={styles.pageTitle}>{title}</h1>
        {subtitle ? <p className={styles.pageSub}>{subtitle}</p> : null}
      </div>
      {actions ? <div className={styles.pageActions}>{actions}</div> : null}
    </header>
  )
}

/** Selo do desenho; `manager` é o selo violeta "Gestor". */
export function Badge({
  children,
  manager = false,
}: {
  readonly children: ReactNode
  readonly manager?: boolean
}) {
  return <span className={`${styles.badge} ${manager ? styles.badgeManager : ''}`}>{children}</span>
}

export interface RailItem<T extends string> {
  readonly id: T
  readonly label: string
  readonly count?: string | undefined
}

export interface RailGroup<T extends string> {
  readonly label?: string
  readonly items: readonly RailItem<T>[]
}

export interface TopicLayoutProps<T extends string> {
  readonly ariaLabel: string
  readonly groups: readonly RailGroup<T>[]
  readonly activeId: T
  readonly onSelect: (id: T) => void
  /** Largura máxima da coluna de conteúdo (720 em Configurações, 840 em Entregas e Cronograma). */
  readonly stageWidth?: number | 'full'
  readonly children: ReactNode
}

/** `.topic-layout`: rail de 188px à esquerda e coluna única (`.topic-stage`) à direita. */
export function TopicLayout<T extends string>({
  ariaLabel,
  groups,
  activeId,
  onSelect,
  stageWidth = 720,
  children,
}: TopicLayoutProps<T>) {
  return (
    <div className={styles.topicLayout}>
      <nav className={styles.rail} aria-label={ariaLabel}>
        {groups.map((group, index) => (
          <div key={group.label ?? index} className={styles.railGroup}>
            {group.label ? <span className={styles.railLabel}>{group.label}</span> : null}
            {group.items.map((item) => {
              const active = item.id === activeId
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`${styles.topicBtn} ${active ? styles.topicBtnActive : ''}`}
                  aria-current={active ? 'page' : undefined}
                  aria-label={item.count ? item.label : undefined}
                  onClick={() => onSelect(item.id)}
                >
                  <span>{item.label}</span>
                  {item.count ? (
                    <span className={styles.topicCount} aria-hidden="true">
                      {item.count}
                    </span>
                  ) : null}
                </button>
              )
            })}
          </div>
        ))}
      </nav>
      <div
        className={styles.stage}
        style={
          { '--stage-width': stageWidth === 'full' ? 'none' : `${stageWidth}px` } as CSSProperties
        }
      >
        {children}
      </div>
    </div>
  )
}

/** `.topic-section`: bloco com título 13.5/600, meta opcional e divisória inferior. */
export function Section({
  title,
  meta,
  helper,
  ariaLabel,
  children,
}: {
  readonly title?: string
  readonly meta?: ReactNode
  readonly helper?: string
  readonly ariaLabel?: string
  readonly children: ReactNode
}) {
  return (
    <section className={styles.section} aria-label={ariaLabel ?? title}>
      {title || meta ? (
        <div className={styles.sectionHead}>
          {title ? <h2 className={styles.sectionTitle}>{title}</h2> : <span />}
          {meta ? <span className={styles.sectionMeta}>{meta}</span> : null}
        </div>
      ) : null}
      {helper ? <p className={styles.helper}>{helper}</p> : null}
      {children}
    </section>
  )
}

/** Linha limpa: nome + descrição à esquerda, controle à direita, divisória de 1px. */
export function CleanRow({
  name,
  description,
  children,
  extra,
}: {
  readonly name: ReactNode
  readonly description?: ReactNode
  readonly children?: ReactNode
  readonly extra?: ReactNode
}) {
  return (
    <li className={styles.row}>
      <div className={styles.rowInfo}>
        <strong className={styles.rowName}>{name}</strong>
        {description ? <span className={styles.rowDesc}>{description}</span> : null}
      </div>
      {children ? <div className={styles.rowControl}>{children}</div> : null}
      {extra ? <div className={styles.rowExtra}>{extra}</div> : null}
    </li>
  )
}

export function CleanList({
  children,
  ariaLabel,
}: {
  readonly children: ReactNode
  readonly ariaLabel?: string
}) {
  return (
    <ul className={styles.list} aria-label={ariaLabel}>
      {children}
    </ul>
  )
}

/** Switch `.ab-switch` 40x22, monocromático. */
export function Switch({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  readonly checked: boolean
  readonly onChange: (next: boolean) => void
  readonly label: string
  readonly disabled?: boolean
}) {
  return (
    <label className={styles.switch}>
      <input
        type="checkbox"
        role="switch"
        className={styles.switchInput}
        checked={checked}
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onChange={(event) => onChange(event.currentTarget.checked)}
      />
      <span className={styles.switchTrack} aria-hidden="true" />
    </label>
  )
}

export interface QuietOption<T extends string> {
  readonly value: T
  readonly label: string
}

/** Controle calmo (`.quiet-toggle`): botões com aria-pressed, um selecionado. */
export function QuietToggle<T extends string>({
  ariaLabel,
  value,
  options,
  onChange,
  disabled = false,
}: {
  readonly ariaLabel: string
  readonly value: T
  readonly options: readonly QuietOption<T>[]
  readonly onChange: (next: T) => void
  readonly disabled?: boolean
}) {
  return (
    <div className={styles.quietToggle} role="group" aria-label={ariaLabel}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`${styles.quietBtn} ${option.value === value ? styles.quietBtnActive : ''}`}
          aria-pressed={option.value === value}
          disabled={disabled}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

/** Botões do desenho (`.btn-secondary` / ghost) para as telas sem cartões. */
export function SoftButton({ children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={styles.softBtn} {...rest}>
      {children}
    </button>
  )
}

export const cleanStyles = styles
