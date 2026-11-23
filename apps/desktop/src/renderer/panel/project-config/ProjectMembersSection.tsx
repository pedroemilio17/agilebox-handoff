import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ProjectDto } from '@agilebox/contract'
import { AddButton, ReadOnlyBadge } from '@agilebox/ui'
import { useApi } from '../../shared/api/ApiProvider'
import { queryKeys } from '../../shared/query/keys'
import { panelCopy } from '../copy'
import { useSessionUsers } from '../hooks/use-session-users'
import styles from './ProjectConfigView.module.css'

export interface ProjectMembersSectionProps {
  readonly project: ProjectDto
  readonly canManage: boolean
}

const READ_ONLY_NOTE = 'Somente leitura: só o gestor e o criador do projeto gerenciam os membros.'

/** Equipe com acesso ao projeto: listagem e gerenciamento para gestor ou criador. */
export function ProjectMembersSection({ project, canManage }: ProjectMembersSectionProps) {
  const api = useApi()
  const queryClient = useQueryClient()
  const [selected, setSelected] = useState('')
  const users = useSessionUsers()
  const members = useQuery({
    queryKey: queryKeys.projects.members(project.id),
    queryFn: () => api.projects.listMembers({ projectId: project.id }),
  })
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.projects.members(project.id) })
  const add = useMutation({
    mutationFn: (userId: string) => api.projects.addMember({ projectId: project.id, userId }),
    onSuccess: () => {
      setSelected('')
      return refresh()
    },
  })
  const remove = useMutation({
    mutationFn: (userId: string) => api.projects.removeMember({ projectId: project.id, userId }),
    onSuccess: refresh,
  })

  const memberIds = new Set((members.data ?? []).map((member) => member.id))
  const candidates = (users.data ?? []).filter((user) => !memberIds.has(user.id))

  return (
    <section aria-label={panelCopy.members} className={styles.card}>
      <header className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>{panelCopy.membersOf(project.name)}</h2>
        {canManage ? null : <ReadOnlyBadge />}
      </header>
      {canManage ? null : (
        <p role="note" className={styles.helper}>
          {READ_ONLY_NOTE}
        </p>
      )}
      {members.data?.length === 0 ? <p className={styles.helper}>{panelCopy.noMembers}</p> : null}
      <ul className={styles.list}>
        {(members.data ?? []).map((member) => (
          <li key={member.id} className={styles.listRow}>
            <span>{member.name}</span>
            {canManage ? (
              <button
                type="button"
                className={styles.removeButton}
                aria-label={panelCopy.removeMember(member.name)}
                disabled={remove.isPending}
                onClick={() => remove.mutate(member.id)}
              >
                ×
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      {canManage ? (
        <div className={styles.addRow}>
          <select
            aria-label={panelCopy.addMember}
            className={styles.select}
            value={selected}
            onChange={(event) => setSelected(event.currentTarget.value)}
          >
            <option value="">{panelCopy.addMember}</option>
            {candidates.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
          <AddButton
            type="button"
            variant="primary"
            disabled={!selected || add.isPending}
            onClick={() => add.mutate(selected)}
          >
            {panelCopy.addMember}
          </AddButton>
        </div>
      ) : null}
      {add.isError || remove.isError ? (
        <p role="alert" className={styles.error}>
          {panelCopy.membersError}
        </p>
      ) : null}
    </section>
  )
}
