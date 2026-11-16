import { useState } from 'react'
import { Button, Modal } from '@agilebox/ui'
import { ApiError, type ProjectDto } from '@agilebox/contract'
import { useCreateProject } from '../hooks/use-create-project'
import { useArchiveProject, useUnarchiveProject } from '../hooks/use-archive-project'
import { useRenameProject } from '../hooks/use-rename-project'
import { SaveError } from '../task-detail/SaveError'
import { DefinitionOfDoneEditor } from './DefinitionOfDoneEditor'
import { panelCopy } from '../copy'
import styles from './ProjectDialog.module.css'

export interface ProjectDialogProps {
  readonly open: boolean
  readonly projects: readonly ProjectDto[]
  readonly selectedProjectId: string | null
  readonly onSelect: (projectId: string | null) => void
  readonly onClose: () => void
  readonly canManageMembers?: (project: ProjectDto) => boolean
  readonly onManageMembers?: (project: ProjectDto) => void
  /** Quem edita a definição de pronto (mesma regra do botão Membros). */
  readonly canEditDefinition?: (project: ProjectDto) => boolean
  /** Quem arquiva e desarquiva o projeto: gestor e quem criou (mesma regra do botão Membros). */
  readonly canArchiveProject?: (project: ProjectDto) => boolean
  /** Quem renomeia o projeto: gestor e quem criou (mesma regra do botão Membros). */
  readonly canRenameProject?: (project: ProjectDto) => boolean
  /** Mostra projetos arquivados (desligado por padrão). A consulta é feita pelo pai. */
  readonly showArchived?: boolean
  readonly onShowArchivedChange?: (show: boolean) => void
}

function projectNameKey(name: string): string {
  return name
    .trim()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/\s+/gu, ' ')
}

export function ProjectDialog({
  open,
  projects,
  selectedProjectId,
  onSelect,
  onClose,
  canManageMembers,
  onManageMembers,
  canEditDefinition,
  canArchiveProject,
  canRenameProject,
  showArchived = false,
  onShowArchivedChange,
}: ProjectDialogProps) {
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [confirmingArchive, setConfirmingArchive] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [renameDraft, setRenameDraft] = useState('')
  const [renameMessage, setRenameMessage] = useState<string | null>(null)
  const createProject = useCreateProject()
  const archiveProject = useArchiveProject()
  const unarchiveProject = useUnarchiveProject()
  const renameProject = useRenameProject()
  const selectedProject = projects.find((project) => project.id === selectedProjectId)
  const archiveAllowed =
    selectedProject !== undefined && canArchiveProject?.(selectedProject) === true
  const selectedArchived = selectedProject?.archivedAt != null
  // Arquivado não se renomeia: a tela não oferece, e a aplicação recusa se chegar.
  const renameAllowed =
    selectedProject !== undefined &&
    !selectedArchived &&
    canRenameProject?.(selectedProject) === true
  const membersAllowed =
    selectedProject !== undefined &&
    onManageMembers !== undefined &&
    canManageMembers?.(selectedProject)
  const existing = projects.find((project) => projectNameKey(project.name) === projectNameKey(name))
  const definitionVisible = selectedProject !== undefined

  function close() {
    setCreating(false)
    setName('')
    setConfirmingArchive(false)
    setRenaming(false)
    setRenameDraft('')
    setRenameMessage(null)
    renameProject.reset()
    createProject.reset()
    onClose()
  }

  function startRename(project: ProjectDto) {
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

  function submitRename(project: ProjectDto) {
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

  function renameErrorMessage(error: unknown): string {
    // Conflito vindo do servidor traz a mensagem de domínio, já em português.
    if (error instanceof ApiError && error.code === 'CONFLICT') return error.message
    return panelCopy.renameProjectError
  }

  async function createOrSelect() {
    const trimmedName = name.trim()
    if (!trimmedName) return
    if (existing) {
      onSelect(existing.id)
      close()
      return
    }
    try {
      const project = await createProject.mutateAsync(trimmedName)
      onSelect(project.id)
      close()
    } catch {
      return
    }
  }

  return (
    <Modal open={open} title={panelCopy.projectDialogTitle} onClose={close}>
      <div className={styles.dialogContent}>
        <header className={styles.header}>
          <h2>{panelCopy.projectDialogTitle}</h2>
          <Button aria-label={panelCopy.close} onClick={close} type="button">
            ×
          </Button>
        </header>
        {onShowArchivedChange ? (
          <Button
            aria-pressed={showArchived}
            className={styles.newProject}
            onClick={() => onShowArchivedChange(!showArchived)}
            type="button"
          >
            {panelCopy.showArchived}
          </Button>
        ) : null}
        <div aria-label={panelCopy.projectOptions} className={styles.projectList} role="listbox">
          <button
            aria-selected={selectedProjectId === null}
            className={styles.projectOption}
            onClick={() => {
              onSelect(null)
              close()
            }}
            role="option"
            type="button"
          >
            <span>{panelCopy.allProjects}</span>
            {selectedProjectId === null ? <span aria-hidden="true">✓</span> : null}
          </button>
          {projects.map((project) => (
            <button
              aria-selected={selectedProjectId === project.id}
              className={styles.projectOption}
              key={project.id}
              onClick={() => {
                onSelect(project.id)
                close()
              }}
              role="option"
              type="button"
            >
              <span>{project.name}</span>
              {project.archivedAt != null ? (
                <span className={styles.archivedTag}>{panelCopy.archivedProject}</span>
              ) : null}
              {selectedProjectId === project.id ? <span aria-hidden="true">✓</span> : null}
            </button>
          ))}
        </div>
        {membersAllowed ? (
          <Button
            className={styles.newProject}
            onClick={() => {
              close()
              onManageMembers(selectedProject)
            }}
            type="button"
          >
            {panelCopy.members}
          </Button>
        ) : null}
        {renameAllowed && selectedProject && renaming ? (
          <div className={styles.createRow}>
            <input
              aria-invalid={renameMessage !== null}
              aria-label={panelCopy.renameProjectName}
              autoFocus
              className={styles.nameField}
              onChange={(event) => setRenameDraft(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !renameProject.isPending) {
                  event.preventDefault()
                  submitRename(selectedProject)
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
              onClick={() => submitRename(selectedProject)}
              type="button"
              variant="primary"
            >
              {panelCopy.renameProjectSave}
            </Button>
            <Button onClick={cancelRename} type="button">
              {panelCopy.renameProjectCancel}
            </Button>
            {renameMessage ? <p role="alert">{renameMessage}</p> : null}
            {renameProject.error instanceof ApiError && renameProject.error.code === 'FORBIDDEN' ? (
              <SaveError error={renameProject.error} />
            ) : renameProject.error ? (
              <p role="alert">{renameErrorMessage(renameProject.error)}</p>
            ) : null}
          </div>
        ) : null}
        {renameAllowed && selectedProject && !renaming ? (
          <Button
            className={styles.newProject}
            onClick={() => startRename(selectedProject)}
            type="button"
          >
            {panelCopy.renameProjectAction}
          </Button>
        ) : null}
        {archiveAllowed && selectedProject ? (
          <div className={styles.archiveRow}>
            {selectedArchived ? (
              <Button
                disabled={unarchiveProject.isPending}
                onClick={() => unarchiveProject.mutate(selectedProject.id)}
                type="button"
              >
                {panelCopy.unarchiveProjectAction}
              </Button>
            ) : confirmingArchive ? (
              <div role="group" aria-label={panelCopy.archiveProjectAction}>
                <p>{panelCopy.archiveConfirmProject}</p>
                <Button
                  disabled={archiveProject.isPending}
                  onClick={() =>
                    archiveProject.mutate(selectedProject.id, {
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
            ) : (
              <Button onClick={() => setConfirmingArchive(true)} type="button">
                {panelCopy.archiveProjectAction}
              </Button>
            )}
            <SaveError error={archiveProject.error ?? unarchiveProject.error} />
          </div>
        ) : null}
        {definitionVisible ? (
          <DefinitionOfDoneEditor
            key={selectedProject.id}
            projectId={selectedProject.id}
            canEdit={canEditDefinition?.(selectedProject) ?? false}
          />
        ) : null}
        {creating ? (
          <div className={styles.createRow}>
            <input
              aria-label={panelCopy.newProjectName}
              autoFocus
              className={styles.nameField}
              onChange={(event) => setName(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && name.trim() && !createProject.isPending) {
                  event.preventDefault()
                  void createOrSelect()
                }
              }}
              placeholder={panelCopy.projectNamePlaceholder}
              value={name}
            />
            <Button
              disabled={!name.trim() || createProject.isPending}
              onClick={() => void createOrSelect()}
              type="button"
              variant="primary"
            >
              {panelCopy.create}
            </Button>
          </div>
        ) : (
          <Button className={styles.newProject} onClick={() => setCreating(true)} type="button">
            <span aria-hidden="true">＋</span> {panelCopy.newProject}
          </Button>
        )}
        {createProject.isError ? <p role="alert">{panelCopy.createProjectError}</p> : null}
      </div>
    </Modal>
  )
}
