export type ChangeKind = 'task' | 'project' | 'meeting' | 'contributor' | 'user' | 'session'

export type ChangeEvent = {
  kind: ChangeKind
  ids: string[]
}
