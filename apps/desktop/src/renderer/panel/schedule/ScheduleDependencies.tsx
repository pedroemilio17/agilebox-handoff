import { useId, useState, type FormEvent } from 'react'
import { AddButton } from '@agilebox/ui'
import type { ScheduleDependencyDto, ScheduleTaskDto } from '@agilebox/contract'
import { useAddDependency, useRemoveDependency } from '../hooks/use-schedule'
import { actionErrorText } from '../wbs/wbs-screen'
import styles from './ScheduleView.module.css'

export const dependencyCopy = {
  section: 'Dependências',
  empty: 'Nenhuma dependência ligada ainda.',
  dependsOn: 'depende de',
  conflict: 'Conflito',
  remove: 'Remover',
  removeLabel: (successor: string, predecessor: string) =>
    `Remover a dependência de ${successor} em ${predecessor}`,
  successor: 'Sucessora',
  predecessor: 'Predecessora',
  choose: 'Escolha a tarefa',
  add: 'Adicionar dependência',
  self: 'Uma tarefa não pode depender dela mesma.',
} as const

export interface ScheduleDependenciesProps {
  readonly tasks: readonly ScheduleTaskDto[]
  readonly dependencies: readonly ScheduleDependencyDto[]
}

/**
 * Dependências término→início. Quem edita a sucessora liga e desliga a predecessora. Dependência com
 * conflito aparece destacada. O servidor valida tudo o que grava.
 */
export function ScheduleDependencies({ tasks, dependencies }: ScheduleDependenciesProps) {
  const add = useAddDependency()
  const remove = useRemoveDependency()
  const successorId = useId()
  const predecessorId = useId()
  const [successor, setSuccessor] = useState('')
  const [predecessor, setPredecessor] = useState('')
  const [error, setError] = useState<string | null>(null)

  const titleOf = (taskId: string) => tasks.find((task) => task.taskId === taskId)?.title ?? ''
  const editable = tasks.filter((task) => task.canEdit)
  const canSubmit = successor !== '' && predecessor !== '' && successor !== predecessor

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSubmit) return
    setError(null)
    if (successor === predecessor) {
      setError(dependencyCopy.self)
      return
    }
    try {
      await add.mutateAsync({ predecessorId: predecessor, successorId: successor })
      setSuccessor('')
      setPredecessor('')
    } catch (caught) {
      setError(actionErrorText(caught))
    }
  }

  async function removeOne(dependency: ScheduleDependencyDto) {
    setError(null)
    try {
      await remove.mutateAsync({
        predecessorId: dependency.predecessorId,
        successorId: dependency.successorId,
      })
    } catch (caught) {
      setError(actionErrorText(caught))
    }
  }

  return (
    <section aria-label={dependencyCopy.section} className={styles.card}>
      <h3 className={styles.sectionTitle}>{dependencyCopy.section}</h3>

      {dependencies.length === 0 ? (
        <p className={styles.muted}>{dependencyCopy.empty}</p>
      ) : (
        <ul className={styles.dependencyList}>
          {dependencies.map((dependency) => {
            const successorTask = titleOf(dependency.successorId)
            const predecessorTask = titleOf(dependency.predecessorId)
            const canRemove = tasks.some(
              (task) => task.taskId === dependency.successorId && task.canEdit,
            )
            return (
              <li
                key={`${dependency.predecessorId}-${dependency.successorId}`}
                className={styles.dependencyItem}
              >
                <span>
                  {successorTask} {dependencyCopy.dependsOn} {predecessorTask}
                </span>
                {dependency.conflict ? (
                  <span className={styles.conflictTag}>{dependencyCopy.conflict}</span>
                ) : null}
                {canRemove ? (
                  <button
                    type="button"
                    className={styles.button}
                    aria-label={dependencyCopy.removeLabel(successorTask, predecessorTask)}
                    onClick={() => void removeOne(dependency)}
                  >
                    {dependencyCopy.remove}
                  </button>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}

      {editable.length > 0 ? (
        <form className={styles.form} onSubmit={(event) => void submit(event)}>
          <div className={styles.field}>
            <label htmlFor={successorId}>{dependencyCopy.successor}</label>
            <select
              id={successorId}
              className={styles.select}
              value={successor}
              onChange={(event) => setSuccessor(event.currentTarget.value)}
            >
              <option value="">{dependencyCopy.choose}</option>
              {editable.map((task) => (
                <option key={task.taskId} value={task.taskId}>
                  {task.key} {task.title}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.field}>
            <label htmlFor={predecessorId}>{dependencyCopy.predecessor}</label>
            <select
              id={predecessorId}
              className={styles.select}
              value={predecessor}
              onChange={(event) => setPredecessor(event.currentTarget.value)}
            >
              <option value="">{dependencyCopy.choose}</option>
              {tasks
                .filter((task) => task.taskId !== successor)
                .map((task) => (
                  <option key={task.taskId} value={task.taskId}>
                    {task.key} {task.title}
                  </option>
                ))}
            </select>
          </div>
          <AddButton type="submit" disabled={!canSubmit || add.isPending}>
            {dependencyCopy.add}
          </AddButton>
        </form>
      ) : null}

      {error ? (
        <p role="alert" className={styles.errorText}>
          {error}
        </p>
      ) : null}
    </section>
  )
}
