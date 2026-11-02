import { ApiError } from '@agilebox/contract'
import type { ProjectDto } from '@agilebox/contract'
import { Button, GlassSurface } from '@agilebox/ui'
import { useActor } from '../../shared/session/useActor'
import { panelCopy } from '../copy'
import { useArchivedProjects } from './use-archived-projects'
import { useUnarchiveProject } from './use-unarchive-project'
import styles from './ArchivedProjectsSection.module.css'
import settingsStyles from './SettingsView.module.css'

/**
 * Projetos arquivados (M2.12c). Sem esta seção, um projeto arquivado e fora do Desfazer ficaria
 * inacessível. O botão aparece para quem pode arquivar (criador ou gestor, a mesma regra de
 * `canManageMembers` no core); a decisão final é do servidor, e a recusa aparece em role=alert.
 */
export function ArchivedProjectsSection() {
  const { actor } = useActor()
  const archived = useArchivedProjects()
  const unarchive = useUnarchiveProject()
  const projects = archived.data ?? []

  const canUnarchive = (project: ProjectDto) =>
    actor !== undefined && (actor.role === 'manager' || project.createdBy === actor.userId)

  const errorMessage =
    unarchive.error instanceof ApiError ? unarchive.error.message : panelCopy.unarchiveProjectError

  return (
    <GlassSurface
      variant="group"
      className={settingsStyles.section}
      aria-label={panelCopy.archivedProjects}
    >
      <h2 className={settingsStyles.sectionTitle}>{panelCopy.archivedProjects}</h2>
      {archived.isError ? (
        <p role="alert">{panelCopy.archivedProjectsError}</p>
      ) : archived.isSuccess && projects.length === 0 ? (
        <p className={settingsStyles.hint}>{panelCopy.noArchivedProjects}</p>
      ) : (
        <ul className={styles.list} aria-label={panelCopy.archivedProjects}>
          {projects.map((project) => (
            <li key={project.id} className={styles.item}>
              <span className={styles.name}>{project.name}</span>
              {canUnarchive(project) ? (
                <Button
                  type="button"
                  disabled={unarchive.isPending}
                  aria-label={panelCopy.unarchiveProject(project.name)}
                  onClick={() => unarchive.mutate(project.id)}
                >
                  Desarquivar
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {unarchive.isError ? <p role="alert">{errorMessage}</p> : null}
    </GlassSurface>
  )
}
