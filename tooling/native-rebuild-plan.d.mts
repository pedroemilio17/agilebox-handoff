export type NativeTarget = 'node' | 'electron'

export function getNativeRebuildPlan(target: NativeTarget): {
  command: string
  args: string[]
}
