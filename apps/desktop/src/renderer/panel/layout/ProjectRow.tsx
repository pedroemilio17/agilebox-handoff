import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { GlassMenu, IconButton, ProjectSwatch } from '@agilebox/ui'
import { useApi } from '../../shared/api/ApiProvider'
import { useDismissOnOutside } from '../hooks/use-dismiss-on-outside'
import { queryKeys } from '../../shared/query/keys'
import { useUndo } from './UndoProvider'
import railStyles from './PanelShell.module.css'
import styles from './ProjectRow.module.css'

export interface ProjectRowProps {
  readonly project: { readonly id: string; readonly name: string }
  readonly count: number | string
  readonly selected: boolean
  /** Quem pode renomear e arquivar: a tela decide (criador ou gestor). Sem permissão, não há menu. */
  readonly canManage: boolean
  readonly onProjectSelect?: (projectId: string | null) => void
}

const MENU_WIDTH = 230

/**
 * Projeto na barra lateral com as ações de M2.12: renomear no lugar (F2, Enter salva, Esc cancela)
 * e arquivar pelo menu "⋯", sem confirmação, com desfazer no aviso de 8 s.
 */
export function ProjectRow({
  project,
  count,
  selected,
  canManage,
  onProjectSelect,
}: ProjectRowProps) {
  const api = useApi()
  const queryClient = useQueryClient()
  const { offer } = useUndo()
  const [renaming, setRenaming] = useState(false)
  const [draft, setDraft] = useState(project.name)
  const [menuAt, setMenuAt] = useState<{ readonly top: number; readonly left: number } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const rowRef = useRef<HTMLDivElement>(null)
  // Edição em andamento: Enter, Esc e o blur podem disparar juntos; só o primeiro conta.
  const editing = useRef(false)
  // Só Enter e Esc devolvem o foco ao nome; um clique em outro lugar não pode ser roubado.
  const returnFocus = useRef(false)

  // Clique ou foco fora da linha fecha o menu; abrir o ⋯ de outro projeto também o fecha.
  useDismissOnOutside(rowRef, menuAt !== null, () => setMenuAt(null))

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.projects.all })
    void queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all })
  }

  const rename = useMutation({
    mutationFn: (name: string) => api.projects.renameProject({ projectId: project.id, name }),
    onSettled: refresh,
  })

  const archive = useMutation({
    mutationFn: () => api.projects.archiveProject({ projectId: project.id }),
    onSuccess: () => {
      if (selected) onProjectSelect?.(null)
      offer({
        message: `Projeto “${project.name}” arquivado`,
        undo: async () => {
          await api.projects.unarchiveProject({ projectId: project.id })
          refresh()
        },
      })
    },
    onSettled: refresh,
  })

  useEffect(() => {
    if (renaming) {
      inputRef.current?.focus()
      inputRef.current?.select()
    } else if (returnFocus.current) {
      returnFocus.current = false
      buttonRef.current?.focus()
    }
  }, [renaming])

  function startRename() {
    setMenuAt(null)
    setDraft(project.name)
    editing.current = true
    setRenaming(true)
  }

  function finishRename(save: boolean, keyboard: boolean) {
    if (!editing.current) return
    editing.current = false
    returnFocus.current = keyboard
    setRenaming(false)
    const next = draft.trim()
    if (save && next !== '' && next !== project.name) rename.mutate(next)
  }

  function onNameKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'F2' && canManage) {
      event.preventDefault()
      startRename()
    }
  }

  function onFieldKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault()
      finishRename(true, true)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      finishRename(false, true)
    }
  }

  function toggleMenu(event: MouseEvent<HTMLButtonElement>) {
    if (menuAt) {
      setMenuAt(null)
      return
    }
    const rect = event.currentTarget.getBoundingClientRect()
    setMenuAt({
      top: rect.bottom + 4,
      left: Math.max(8, Math.min(rect.left, window.innerWidth - MENU_WIDTH - 8)),
    })
  }

  function chooseFromMenu(id: string) {
    if (id === 'rename') startRename()
    if (id === 'archive') archive.mutate()
  }

  const failed = rename.isError || archive.isError

  return (
    <div ref={rowRef} className={styles.row}>
      {renaming ? (
        <input
          ref={inputRef}
          aria-label="Nome do projeto"
          className={styles.renameField}
          value={draft}
          onChange={(event) => setDraft(event.currentTarget.value)}
          onKeyDown={onFieldKeyDown}
          onBlur={() => finishRename(true, false)}
        />
      ) : (
        <button
          ref={buttonRef}
          type="button"
          className={`${railStyles.projectItem} ${styles.name}`}
          aria-pressed={selected}
          onClick={() => onProjectSelect?.(project.id)}
          onKeyDown={onNameKeyDown}
        >
          <ProjectSwatch
            index={Array.from(project.id).reduce((sum, char) => sum + char.charCodeAt(0), 0)}
            name={project.name}
          />
          <span className={railStyles.projectName}>{project.name}</span>
          <span className={railStyles.count}>{count}</span>
        </button>
      )}
      {canManage && !renaming ? (
        <IconButton
          type="button"
          className={styles.more}
          aria-label={`Ações do projeto ${project.name}`}
          aria-haspopup="menu"
          aria-expanded={menuAt !== null}
          onClick={toggleMenu}
        >
          <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="5" cy="12" r="1.8" />
            <circle cx="12" cy="12" r="1.8" />
            <circle cx="19" cy="12" r="1.8" />
          </svg>
        </IconButton>
      ) : null}
      {menuAt ? (
        // Fixo na tela: a lista da barra lateral rola e cortaria um menu absoluto.
        <div className={styles.menu} style={{ top: menuAt.top, left: menuAt.left }}>
          <GlassMenu
            label={`Ações do projeto ${project.name}`}
            items={[
              { id: 'rename', label: 'Renomear', shortcut: 'F2' },
              { id: 'archive', label: 'Arquivar', separatorBefore: true },
            ]}
            onSelect={chooseFromMenu}
            onClose={() => setMenuAt(null)}
          />
        </div>
      ) : null}
      {failed ? (
        <p role="alert" className={styles.error}>
          {archive.isError
            ? 'Não foi possível arquivar o projeto.'
            : 'Não foi possível salvar o nome do projeto.'}
        </p>
      ) : null}
    </div>
  )
}
