export type ChangeKind = 'task' | 'project' | 'meeting' | 'contributor'

export type ChangeEvent = {
  kind: ChangeKind
  ids: string[]
}
