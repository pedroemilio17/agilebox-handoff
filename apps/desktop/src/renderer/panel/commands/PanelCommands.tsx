import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { parseQuickAdd } from '@agilebox/core'
import type { ProjectDto, SessionUserDto } from '@agilebox/contract'
import { CommandPalette, Skeleton, type CommandAction } from '@agilebox/ui'
import { useApi } from '../../shared/api/ApiProvider'
import { todayDateOnly } from '../../shared/lib/today'
import { useCreateTask } from '../hooks/use-create-task'

export interface PanelCommandsProps {
  readonly projects: readonly ProjectDto[]
  readonly people: readonly SessionUserDto[]
  readonly selectedProjectId: string | null
  readonly isManager: boolean
  readonly onClose: () => void
  readonly onOpenTask: (id: string) => void
  readonly onNavigate: (view: 'projects' | 'dashboard' | 'agenda') => void
}
const fold = (text: string) =>
  text.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('pt-BR')
export function PanelCommands({
  projects,
  people,
  selectedProjectId,
  isManager,
  onClose,
  onOpenTask,
  onNavigate,
}: PanelCommandsProps) {
  const [value, setValue] = useState('')
  const api = useApi()
  const create = useCreateTask()
  const parsed = parseQuickAdd(value, { today: todayDateOnly(), people, projects })
  const projectId = parsed.projectId ?? selectedProjectId ?? projects[0]?.id
  const results = useQuery({
    queryKey: ['agilebox', 'tasks', 'search', parsed.title],
    queryFn: () => api.tasks.search({ query: parsed.title }),
    enabled: parsed.title.trim().length > 0,
  })
  function runCreate(open: boolean) {
    if (!projectId || !parsed.title || create.isPending) return
    create.mutate(
      {
        projectId,
        title: parsed.title,
        status: 'todo',
        ...(parsed.responsibleId ? { responsibleId: parsed.responsibleId } : {}),
        ...(parsed.deadline ? { deadline: parsed.deadline } : {}),
      },
      {
        onSuccess: (task) => {
          onClose()
          if (open) onOpenTask(task.id)
        },
      },
    )
  }
  const actions: CommandAction[] = []
  if (projectId && parsed.title)
    actions.push(
      {
        id: 'create',
        label: `Criar tarefa “${parsed.title}”`,
        section: 'Ações',
        shortcut: 'Enter',
        onSelect: (shift) => runCreate(shift),
      },
      {
        id: 'create-open',
        label: 'Criar e abrir detalhes',
        section: 'Ações',
        shortcut: 'Shift Enter',
        onSelect: () => runCreate(true),
      },
    )
  for (const task of results.data ?? [])
    actions.push({
      id: task.id,
      label: `${task.title} · ${task.projectName}`,
      section: 'Tarefas parecidas',
      onSelect: () => {
        onClose()
        onOpenTask(task.id)
      },
    })
  const destinations = [
    ...(isManager ? [{ view: 'dashboard' as const, label: 'Dashboard', shortcut: 'G D' }] : []),
    { view: 'agenda' as const, label: 'Agenda', shortcut: 'G A' },
    { view: 'projects' as const, label: 'Quadro', shortcut: 'G Q' },
  ]
  for (const destination of destinations)
    actions.push({
      id: destination.view,
      label: destination.label,
      shortcut: destination.shortcut,
      section: 'Ir para',
      onSelect: () => {
        onClose()
        onNavigate(destination.view)
      },
    })
  function complete() {
    const match = /(?:^|\s)([@#])([^@#]*)$/u.exec(value)
    if (!match) return false
    const prefix = fold(match[2]!.trim())
    const entries = match[1] === '@' ? people : projects
    const found = entries.find(
      (entry) =>
        fold(entry.name).startsWith(prefix) ||
        ('initials' in entry &&
          typeof entry.initials === 'string' &&
          fold(entry.initials).startsWith(prefix)),
    )
    if (!found) return false
    setValue(value.slice(0, value.lastIndexOf(match[1]!)) + match[1]! + found.name + ' ')
    return true
  }
  return (
    <CommandPalette
      value={value}
      onChange={setValue}
      onClose={onClose}
      onComplete={complete}
      pending={create.isPending}
      error={create.isError ? 'Não foi possível criar a tarefa.' : null}
      searchFeedback={
        parsed.title ? (
          results.isPending ? (
            <Skeleton aria-label="Buscando tarefas parecidas" />
          ) : results.isError ? (
            <p role="alert">Não foi possível buscar tarefas parecidas.</p>
          ) : results.data.length === 0 ? (
            <p>Nenhuma tarefa parecida.</p>
          ) : null
        ) : null
      }
      actions={actions}
      tokens={
        <>
          {parsed.tokens.map((token) => (
            <span key={`${token.kind}-${token.start}`}>
              {token.kind === 'person' ? '@' : token.kind === 'project' ? '#' : ''}
              {token.label}
            </span>
          ))}
          <span>
            entra em <strong>A fazer</strong>
          </span>
        </>
      }
    />
  )
}
