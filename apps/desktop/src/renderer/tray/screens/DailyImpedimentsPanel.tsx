import { Button } from '@agilebox/ui'
import { impedimentCopy } from '../../panel/impediments/impediment-copy'
import { byOldestFirst } from '../../panel/impediments/impediment-rules'
import { useImpedimentList } from '../../panel/impediments/use-impediments'
import styles from './Daily.module.css'

export interface DailyImpedimentsPanelProps {
  /** Quem está fazendo a daily; sem ela (ainda carregando) nada é pedido. */
  readonly userId: string | undefined
  readonly disabled: boolean
  /** Coloca o texto no campo de impedimento, como texto editável. Não grava nada. */
  readonly onUse: (text: string) => void
}

/**
 * "Seus impedimentos abertos" (passo 3 da daily): leitura dos impedimentos com o responsável na
 * pessoa. "Usar" só escreve no campo; quem grava é o "Concluir" da daily. Só monta com o módulo
 * `impediments` ativo, por quem chama.
 */
export function DailyImpedimentsPanel({ userId, disabled, onUse }: DailyImpedimentsPanelProps) {
  const list = useImpedimentList({ ownerId: userId }, userId !== undefined)
  const items = [...(list.data ?? [])].sort(byOldestFirst)
  return (
    <section className={styles.suggestion} aria-labelledby="daily-impediments-title">
      <h4 id="daily-impediments-title" className={styles.suggestionTitle}>
        {impedimentCopy.trayTitle}
      </h4>
      {list.isPending ? (
        <p role="status" className={styles.stepHint}>
          {impedimentCopy.trayLoading}
        </p>
      ) : list.isError ? (
        <p role="alert" className={styles.stepHint}>
          {impedimentCopy.trayError}
        </p>
      ) : items.length === 0 ? (
        <p className={styles.stepHint}>{impedimentCopy.trayEmpty}</p>
      ) : (
        <ul className={styles.impedimentList}>
          {items.map((item) => {
            const text = `${item.taskKey} · ${item.reason}`
            return (
              <li key={item.id} className={styles.impedimentRow}>
                <span className={styles.impedimentText}>{text}</span>
                <Button type="button" disabled={disabled} onClick={() => onUse(text)}>
                  {impedimentCopy.trayUse}
                </Button>
              </li>
            )
          })}
        </ul>
      )}
      <p className={styles.stepHint}>{impedimentCopy.trayHint}</p>
    </section>
  )
}
