import { useState } from 'react'
import { Button, ReadOnlyBadge } from '@agilebox/ui'
import { ApiError, type ProjectDto } from '@agilebox/contract'
import { panelCopy } from '../copy'
import { useArchiveProject, useUnarchiveProject } from '../hooks/use-archive-project'
import { useRenameProject } from '../hooks/use-rename-project'
import { SaveError } from '../task-detail/SaveError'
import { projectNameKey } from './project-name-key'
import styles from './ProjectConfigView.module.css'

export interface ProjectGeneralSectionProps {
  readonly project: ProjectDto
  readonly projects: readonly ProjectDto[]
  readonly canManage: boolean
}

function renameErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.code === 'CONFLICT') return error.message
  return panelCopy.renameProjectError
}

/** Dados gerais do projeto: renomear e arquivar/desarquivar. */
export function ProjectGeneralSection({
  project,
  projects,
  canManage,
}: ProjectGeneralSectionProps) {
  const renameProject = useRenameProject()
  const archiveProject = useArchiveProject()
  const unarchiveProject = useUnarchiveProject()
  const [renaming, setRenaming] = useState(false)
  const [renameDraft, setRenameDraft] = useState(project.name)
  const [renameMessage, setRenameMessage] = useState<string | null>(null)
  const [confirmingArchive, setConfirmingArchive] = useState(false)

  const archived = project.archivedAt != null
  const renameAllowed = canManage && !archived

  function startRename() {
    setRenameDraft(project.name)
    setRenameMessage(null)
    renameProject.reset()
    setRenaming(true)
  }

  function cancelRename() {
    setRenaming(false)
    setRenameMessage(null)
    renameProject.reset()
  }

  function submitRename() {
    const trimmed = renameDraft.trim()
    if (!trimmed) {
      setRenameMessage(panelCopy.renameProjectEmpty)
      return
    }
    const nameTaken = projects.some(
      (other) => other.id !== project.id && projectNameKey(other.name) === projectNameKey(trimmed),
    )
    if (nameTaken) {
      setRenameMessage(panelCopy.renameProjectDuplicate)
      return
    }
    setRenameMessage(null)
    renameProject.mutate(
      { projectId: project.id, name: trimmed },
      { onSuccess: () => setRenaming(false) },
    )
  }

  return (
    <div className={styles.stack}>
      <section aria-label="Dados do projeto" className={styles.card}>
        <header className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Nome do projeto</h2>
          {canManage ? null : <ReadOnlyBadge />}
        </header>
        {renaming && renameAllowed ? (
          <div className={styles.renameColumn}>
            <div className={styles.addRow}>
              <input
                aria-invalid={renameMessage !== null}
                aria-label={panelCopy.renameProjectName}
                autoFocus
                className={styles.input}
                onChange={(event) => setRenameDraft(event.currentTarget.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !renameProject.isPending) {
                    event.preventDefault()
                    submitRename()
                  } else if (event.key === 'Escape') {
                    event.preventDefault()
                    event.stopPropagation()
                    cancelRename()
                  }
                }}
                value={renameDraft}
              />
              <Button
                disabled={renameProject.isPending}
                onClick={submitRename}
                type="button"
                variant="primary"
              >
                {panelCopy.renameProjectSave}
              </Button>
              <Button onClick={cancelRename} type="button">
                {panelCopy.renameProjectCancel}
              </Button>
            </div>
            {renameMessage ? (
              <p role="alert" className={styles.error}>
                {renameMessage}
              </p>
            ) : null}
            {renameProject.error instanceof ApiError && renameProject.error.code === 'FORBIDDEN' ? (
              <SaveError error={renameProject.error} />
            ) : renameProject.error ? (
              <p role="alert" className={styles.error}>
                {renameErrorMessage(renameProject.error)}
              </p>
            ) : null}
          </div>
        ) : (
          <div className={styles.nameRow}>
            <span className={styles.projectName}>{project.name}</span>
            {renameAllowed ? (
              <Button onClick={startRename} type="button">
                {panelCopy.renameProjectAction}
              </Button>
            ) : null}
          </div>
        )}
        {archived ? (
          <p role="note" className={styles.helper}>
            Projeto arquivado: desarquive antes de alterar o nome.
          </p>
        ) : !canManage ? (
          <p role="note" className={styles.helper}>
            Somente leitura: só o gestor e o criador alteram os dados do projeto.
          </p>
        ) : null}
      </section>

      {canManage ? (
        <section aria-label={panelCopy.archiveProjectAction} className={styles.card}>
          <header className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>
              {archived ? panelCopy.archivedProject : panelCopy.archiveProjectAction}
            </h2>
          </header>
          {archived ? (
            <div className={styles.nameRow}>
              <p className={styles.helper}>
                Este projeto está arquivado e não aceita tarefas novas.
              </p>
              <Button
                disabled={unarchiveProject.isPending}
                onClick={() => unarchiveProject.mutate(project.id)}
                type="button"
              >
                {panelCopy.unarchiveProjectAction}
              </Button>
            </div>
          ) : confirmingArchive ? (
            <div
              role="group"
              aria-label={panelCopy.archiveProjectAction}
              className={styles.confirmBox}
            >
              <p className={styles.helper}>{panelCopy.archiveConfirmProject}</p>
              <div className={styles.addRow}>
                <Button
                  disabled={archiveProject.isPending}
                  onClick={() =>
                    archiveProject.mutate(project.id, {
                      onSuccess: () => setConfirmingArchive(false),
                    })
                  }
                  type="button"
                  variant="primary"
                >
                  {panelCopy.blockConfirm}
                </Button>
                <Button onClick={() => setConfirmingArchive(false)} type="button">
                  {panelCopy.blockCancel}
                </Button>
              </div>
            </div>
          ) : (
            <div className={styles.nameRow}>
              <p className={styles.helper}>{panelCopy.archiveConfirmProject}</p>
              <Button onClick={() => setConfirmingArchive(true)} type="button">
                {panelCopy.archiveProjectAction}
              </Button>
            </div>
          )}
          <SaveError error={archiveProject.error ?? unarchiveProject.error} />
        </section>
      ) : null}
    </div>
  )
}
