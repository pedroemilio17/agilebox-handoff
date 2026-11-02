import { useState } from 'react'
import type { GetTaskDto, Participant } from '@agilebox/contract'
import { Avatar, Button } from '@agilebox/ui'
import { useSessionUsers } from '../hooks/use-session-users'
import { panelCopy } from '../copy'
import { PropertyRow } from './PropertyRow'
import { SaveError } from './SaveError'
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

function decode(value: string): Participant | null {
  const [kind, id] = value.split(':')
  if (!id) return null
  if (kind === 'user') return { kind: 'user', userId: id }
  if (kind === 'contributor') return { kind: 'contributor', contributorId: id }
  return null
}

export function ParticipantsCard({ task, readOnly }: ParticipantsCardProps) {
  const users = useSessionUsers()
  const contributors = useContributors()
  const add = useAddParticipation(task.id)
  const remove = useRemoveParticipation(task.id)
  const createContributor = useCreateContributor()
  const [selected, setSelected] = useState('')
  const [role, setRole] = useState<'responsible' | 'support'>('support')
  const [entityName, setEntityName] = useState('')

  const taken = new Set(
    task.participations.map((participation) => encode(participation.participant)),
  )
  const availableUsers = (users.data ?? []).filter((user) => !taken.has(`user:${user.id}`))
  const availableContributors = (contributors.data ?? []).filter(
    (contributor) => !taken.has(`contributor:${contributor.id}`),
  )
  const participant = decode(selected)
  const roleAllowed = participant?.kind === 'user' || role === 'support'

  function submitAdd() {
    if (!participant) return
    add.mutate(
      { participant, role: roleAllowed ? role : 'support' },
      { onSuccess: () => setSelected('') },
    )
  }

  function submitEntity() {
    const name = entityName.trim()
    if (!name) return
    createContributor.mutate(name, {
      onSuccess: (contributor) => {
        setEntityName('')
        setSelected(`contributor:${contributor.id}`)
        setRole('support')
      },
    })
  }

  return (
    <PropertyRow label={panelCopy.participantsCard}>
      <div className={styles.propertyContent}>
        {task.participations.length === 0 ? (
          <p className={styles.helper}>{panelCopy.noParticipants}</p>
        ) : (
          <ul className={styles.list}>
            {task.participations.map((participation) => (
              <li key={participation.id} className={styles.participant}>
                <Avatar name={participation.participantName} />
                <span className={styles.grow}>{participation.participantName}</span>
                <span className={styles.helper}>
                  {participation.role === 'responsible' ? panelCopy.responsible : panelCopy.support}
                </span>
                {readOnly ? null : (
                  <button
                    type="button"
                    className={styles.iconButton}
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
          <div className={styles.addForm}>
            <select
              aria-label={panelCopy.participantToAdd}
              className={styles.select}
              value={selected}
              onChange={(event) => setSelected(event.currentTarget.value)}
            >
              <option value="">{panelCopy.addParticipant}</option>
              <optgroup label={panelCopy.users}>
                {availableUsers.map((user) => (
                  <option key={user.id} value={`user:${user.id}`}>
                    {user.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label={panelCopy.entities}>
                {availableContributors.map((contributor) => (
                  <option key={contributor.id} value={`contributor:${contributor.id}`}>
                    {contributor.name}
                  </option>
                ))}
              </optgroup>
            </select>
            <select
              aria-label={panelCopy.participantRole}
              className={styles.select}
              value={roleAllowed ? role : 'support'}
              onChange={(event) => setRole(event.currentTarget.value as 'responsible' | 'support')}
            >
              <option value="support">{panelCopy.support}</option>
              <option value="responsible" disabled={participant?.kind === 'contributor'}>
                {panelCopy.responsible}
              </option>
            </select>
            <Button type="button" disabled={!participant || add.isPending} onClick={submitAdd}>
              {panelCopy.add}
            </Button>
            <input
              aria-label={panelCopy.newEntityName}
              className={styles.select}
              placeholder={panelCopy.newEntityName}
              value={entityName}
              onChange={(event) => setEntityName(event.currentTarget.value)}
            />
            <Button
              type="button"
              disabled={!entityName.trim() || createContributor.isPending}
              onClick={submitEntity}
            >
              {panelCopy.createEntity}
            </Button>
            <SaveError error={add.error ?? remove.error ?? createContributor.error} />
          </div>
        )}
      </div>
    </PropertyRow>
  )
}
