import { Avatar, Button } from '@agilebox/ui'
import { panelCopy } from '../copy'
import type { CollaboratorStat } from './types'
import { StackedBar } from './StackedBar'
import styles from './Dashboard.module.css'

export interface CollaboratorTableProps {
  readonly collaborators: readonly CollaboratorStat[]
  readonly onOpenProjects: (user: CollaboratorStat['user']) => void
}

export function CollaboratorTable({ collaborators, onOpenProjects }: CollaboratorTableProps) {
  return (
    <table className={styles.table} aria-label={panelCopy.collaborators}>
      <thead>
        <tr>
          <th scope="col">{panelCopy.collaborator}</th>
          <th scope="col">{panelCopy.items}</th>
          <th scope="col">{panelCopy.statesBar}</th>
          <th scope="col">{panelCopy.completed}</th>
          <th scope="col">
            <span className={styles.srOnly}>{panelCopy.openProjects}</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {collaborators.map((stat) => (
          <tr key={stat.user.id}>
            <th scope="row" className={styles.person}>
              <Avatar name={stat.user.name} />
              <span>{stat.user.name}</span>
            </th>
            <td>{stat.taskCount}</td>
            <td>
              <StackedBar compact distribution={stat.distribution} label={`${stat.user.name}`} />
            </td>
            <td>{stat.completedPercentage}%</td>
            <td>
              <Button
                type="button"
                aria-label={panelCopy.openProjectsOf(stat.user.name)}
                onClick={() => onOpenProjects(stat.user)}
              >
                {panelCopy.openProjects}
              </Button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
