export type NativeTarget = 'node' | 'electron'

export function getNativeRebuildPlan(
  target: NativeTarget,
  moduleDir?: string,
): {
  command: string
  args: string[]
}
