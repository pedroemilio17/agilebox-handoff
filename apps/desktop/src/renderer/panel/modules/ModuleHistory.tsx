import { useProjectModuleHistory } from '../hooks/use-project-module-history'
import { historyActionText, historyDateText } from './modules-history'
import styles from './ModuleHistory.module.css'

const copy = {
  title: 'Histórico',
  loading: 'Carregando o histórico…',
  loadError: 'Não foi possível carregar o histórico deste projeto.',
  empty: 'Nenhuma mudança ainda.',
  manager: 'Gestor',
}

/**
 * Histórico de mudanças de módulos do projeto (ADR-10). Recolhível (`details`), fechado por padrão.
 * Cada linha mostra quando, o que mudou e quem fez; as mudanças do gestor têm a marca "Gestor".
 */
export function ModuleHistory({ projectId }: { readonly projectId: string }) {
  const query = useProjectModuleHistory(projectId)

  return (
    <details className={styles.history}>
      <summary className={styles.summary}>{copy.title}</summary>
      {query.isPending ? (
        <p role="status" className={styles.muted}>
          {copy.loading}
        </p>
      ) : query.isError || !query.data ? (
        <p role="alert" className={styles.error}>
          {copy.loadError}
        </p>
      ) : query.data.events.length === 0 ? (
        <p className={styles.muted}>{copy.empty}</p>
      ) : (
        <ol className={styles.list}>
          {query.data.events.map((event) => (
            <li key={event.id} className={styles.item}>
              <time dateTime={event.at} className={styles.when}>
                {historyDateText(event.at)}
              </time>
              <span className={styles.text}>{historyActionText(event)}</span>
              <span className={styles.who}>
                {event.actorName}
                {event.actorRole === 'manager' ? (
                  <span className={styles.badge}>{copy.manager}</span>
                ) : null}
              </span>
            </li>
          ))}
        </ol>
      )}
    </details>
  )
}
