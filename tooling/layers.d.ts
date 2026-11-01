export interface Layer {
  directory: string
  allowed: readonly string[]
  forbiddenRuntime: readonly string[]
  forbidNodeBuiltins: boolean
}

export const layers: readonly Layer[]
