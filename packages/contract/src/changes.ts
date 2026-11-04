export type ChangeKind =
  'task' | 'project' | 'meeting' | 'contributor' | 'user' | 'session' | 'board'

export type ChangeEvent = {
  kind: ChangeKind
  ids: string[]
}
