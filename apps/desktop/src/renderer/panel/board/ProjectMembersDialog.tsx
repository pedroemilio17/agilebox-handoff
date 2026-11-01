import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ProjectDto } from '@agilebox/contract'
import { Button, Modal } from '@agilebox/ui'
import { useApi } from '../../shared/api/ApiProvider'
import { queryKeys } from '../../shared/query/keys'
import { panelCopy } from '../copy'
import { useSessionUsers } from '../hooks/use-session-users'
import styles from './ProjectMembersDialog.module.css'

export interface ProjectMembersDialogProps {
  readonly project: ProjectDto | null
  readonly onClose: () => void
}

export function ProjectMembersDialog({ project, onClose }: ProjectMembersDialogProps) {
  const api = useApi()
  const queryClient = useQueryClient()
  const projectId = project?.id ?? ''
  const [selected, setSelected] = useState('')
  const users = useSessionUsers()
  const members = useQuery({
    queryKey: queryKeys.projects.members(projectId),
    queryFn: () => api.projects.listMembers({ projectId }),
    enabled: project !== null,
  })
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.projects.members(projectId) })
  const add = useMutation({
    mutationFn: (userId: string) => api.projects.addMember({ projectId, userId }),
    onSuccess: () => {
      setSelected('')
      return refresh()
    },
  })
  const remove = useMutation({
    mutationFn: (userId: string) => api.projects.removeMember({ projectId, userId }),
    onSuccess: refresh,
  })

  const memberIds = new Set((members.data ?? []).map((member) => member.id))
  const candidates = (users.data ?? []).filter((user) => !memberIds.has(user.id))

  return (
    <Modal
      open={project !== null}
      title={panelCopy.membersOf(project?.name ?? '')}
      onClose={onClose}
    >
      <div className={styles.content}>
        <header className={styles.header}>
          <h2>{panelCopy.membersOf(project?.name ?? '')}</h2>
          <Button aria-label={panelCopy.close} onClick={onClose} type="button">
            ×
          </Button>
        </header>
        {members.data?.length === 0 ? <p>{panelCopy.noMembers}</p> : null}
        <ul className={styles.list}>
          {(members.data ?? []).map((member) => (
            <li key={member.id} className={styles.row}>
              <span>{member.name}</span>
              <button
                type="button"
                className={styles.remove}
                aria-label={panelCopy.removeMember(member.name)}
                disabled={remove.isPending}
                onClick={() => remove.mutate(member.id)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
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
          <Button
            type="button"
            variant="primary"
            disabled={!selected || add.isPending}
            onClick={() => add.mutate(selected)}
          >
            {panelCopy.add}
          </Button>
        </div>
        {add.isError || remove.isError ? <p role="alert">{panelCopy.membersError}</p> : null}
      </div>
    </Modal>
  )
}
