import { useState } from 'react'
import { Button, Modal } from '@agilebox/ui'
import type { ProjectDto } from '@agilebox/contract'
import { useCreateProject } from '../hooks/use-create-project'
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
}: ProjectDialogProps) {
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const createProject = useCreateProject()
  const selectedProject = projects.find((project) => project.id === selectedProjectId)
  const membersAllowed =
    selectedProject !== undefined &&
    onManageMembers !== undefined &&
    canManageMembers?.(selectedProject)
  const existing = projects.find((project) => projectNameKey(project.name) === projectNameKey(name))

  function close() {
    setCreating(false)
    setName('')
    createProject.reset()
    onClose()
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
