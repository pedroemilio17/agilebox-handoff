import { useState } from 'react'
import type { GetTaskDto, Participant } from '@agilebox/contract'
import { useSessionUsers } from '../hooks/use-session-users'
import { panelCopy } from '../copy'
import { PropertyRow } from './PropertyRow'
import { SaveError } from './SaveError'
import { taskCopy } from './task-detail-copy'
import {
  useAddParticipation,
  useContributors,
  useCreateContributor,
  useRemoveParticipation,
} from './use-participations'
import styles from './TaskDetailView.module.css'

export interface ParticipantsCardProps {
  readonly task: GetTaskDto
  readonly readOnly: boolean
}

function encode(participant: Participant): string {
  return participant.kind === 'user'
    ? `user:${participant.userId}`
    : `contributor:${participant.contributorId}`
}

/** Usuários da tarefa (Responsável e Apoio): quem participa, com papel; adicionar e remover. */
export function ParticipantsCard({ task, readOnly }: ParticipantsCardProps) {
  const users = useSessionUsers()
  const add = useAddParticipation(task.id)
  const remove = useRemoveParticipation(task.id)
  const [selected, setSelected] = useState('')
  const [role, setRole] = useState<'responsible' | 'support'>('support')

  const people = task.participations.filter(
    (participation) => participation.participant.kind === 'user',
  )
  const taken = new Set(
    task.participations.map((participation) => encode(participation.participant)),
  )
  const availableUsers = (users.data ?? []).filter((user) => !taken.has(`user:${user.id}`))

  function submitAdd() {
    if (!selected) return
    add.mutate(
      { participant: { kind: 'user', userId: selected }, role },
      { onSuccess: () => setSelected('') },
    )
  }

  return (
    <PropertyRow label={panelCopy.participantsCard}>
      <div className={styles.kvStack}>
        {people.length === 0 ? (
          <p className={styles.kvHint}>{panelCopy.noParticipants}</p>
        ) : (
          <ul className={styles.extChips} aria-label={panelCopy.participantsCard}>
            {people.map((participation) => (
              <li key={participation.id} className={styles.extChip}>
                <span>{participation.participantName}</span>
                <span className={styles.chipRole}>
                  {participation.role === 'responsible' ? panelCopy.responsible : panelCopy.support}
                </span>
                {readOnly ? null : (
                  <button
                    type="button"
                    className={styles.extChipRemove}
                    aria-label={panelCopy.removeParticipant(participation.participantName)}
                    disabled={remove.isPending}
                    onClick={() => remove.mutate(participation.id)}
                  >
                    ×
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {readOnly ? null : (
          <div className={styles.kvValue}>
            <select
              aria-label={panelCopy.participantToAdd}
              className={styles.kvSelect}
              value={selected}
              onChange={(event) => setSelected(event.currentTarget.value)}
            >
              <option value="">{taskCopy.addPersonPlaceholder}</option>
              {availableUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
            <select
              aria-label={panelCopy.participantRole}
              className={styles.kvSelect}
              style={{ maxWidth: 140 }}
              value={role}
              onChange={(event) => setRole(event.currentTarget.value as 'responsible' | 'support')}
            >
              <option value="support">{panelCopy.support}</option>
              <option value="responsible">{panelCopy.responsible}</option>
            </select>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnSecondary}`}
              disabled={!selected || add.isPending}
              onClick={submitAdd}
            >
              {panelCopy.addParticipant}
            </button>
          </div>
        )}
        <SaveError error={add.error ?? remove.error} />
      </div>
    </PropertyRow>
  )
}

/**
 * Pessoas externas (entidades): só identificação, nunca dão acesso nem recebem avisos.
 * Escrever um nome novo cria a entidade e a vincula como Apoio.
 */
export function ExternalPeopleSection({ task, readOnly }: ParticipantsCardProps) {
  const contributors = useContributors()
  const add = useAddParticipation(task.id)
  const remove = useRemoveParticipation(task.id)
  const createContributor = useCreateContributor()
  const [name, setName] = useState('')

  const externals = task.participations.filter(
    (participation) => participation.participant.kind === 'contributor',
  )
  const taken = new Set(
    task.participations.map((participation) => encode(participation.participant)),
  )
  const available = (contributors.data ?? []).filter(
    (contributor) => !taken.has(`contributor:${contributor.id}`),
  )

  function link(contributorId: string) {
    add.mutate(
      { participant: { kind: 'contributor', contributorId }, role: 'support' },
      { onSuccess: () => setName('') },
    )
  }

  function submit() {
    const text = name.trim()
    if (!text) return
    const existing = available.find(
      (contributor) =>
        contributor.name.toLocaleLowerCase('pt-BR') === text.toLocaleLowerCase('pt-BR'),
    )
    if (existing) return link(existing.id)
    createContributor.mutate(text, { onSuccess: (contributor) => link(contributor.id) })
  }

  return (
    <section className={styles.topicSection} aria-labelledby="task-section-ext">
      <div className={styles.topicSectionHead}>
        <h2 className={styles.topicSectionTitle} id="task-section-ext">
          {taskCopy.externalTitle}
        </h2>
      </div>
      <p className={styles.topicHelper}>{taskCopy.externalHelper}</p>
      <div className={styles.extChips}>
        {externals.length === 0 ? (
          <span className={styles.emptyNote}>{taskCopy.externalNone}</span>
        ) : (
          externals.map((participation) => (
            <span key={participation.id} className={styles.extChip}>
              <span>{participation.participantName}</span>
              {readOnly ? null : (
                <button
                  type="button"
                  className={styles.extChipRemove}
                  aria-label={taskCopy.externalRemove(participation.participantName)}
                  disabled={remove.isPending}
                  onClick={() => remove.mutate(participation.id)}
                >
                  ×
                </button>
              )}
            </span>
          ))
        )}
      </div>
      {readOnly ? null : (
        <form
          className={styles.inlineAddRow}
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            submit()
          }}
        >
          <input
            type="text"
            className={styles.input}
            list="task-externals-list"
            placeholder={taskCopy.externalPlaceholder}
            aria-label={taskCopy.externalAria}
            value={name}
            onChange={(event) => setName(event.currentTarget.value)}
          />
          <datalist id="task-externals-list">
            {available.map((contributor) => (
              <option key={contributor.id} value={contributor.name} />
            ))}
          </datalist>
          <button
            type="submit"
            className={`${styles.btn} ${styles.btnSecondary}`}
            disabled={!name.trim() || add.isPending || createContributor.isPending}
          >
            {taskCopy.externalAdd}
          </button>
        </form>
      )}
      <SaveError error={add.error ?? remove.error ?? createContributor.error} />
    </section>
  )
}
