import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

declare const __AGILEBOX_BUILD_ID__: string | undefined

/** Identificador deste build (gravado pelo electron-vite na compilação; `dev` nos testes). */
export const BUILD_ID: string =
  typeof __AGILEBOX_BUILD_ID__ === 'string' ? __AGILEBOX_BUILD_ID__ : 'dev'

export interface InstanceRequest {
  readonly buildId: string
  /** A instância nova pede que a aberta (de outro build) saia para ela assumir. */
  readonly replace: boolean
}

export interface RunningInstance {
  readonly buildId: string
  readonly pid: number
}

const FILE = 'instance.json'

export function readRunningInstance(userDataPath: string): RunningInstance | undefined {
  try {
    const data = JSON.parse(
      readFileSync(join(userDataPath, FILE), 'utf8'),
    ) as Partial<RunningInstance>
    return typeof data.buildId === 'string' && typeof data.pid === 'number'
      ? { buildId: data.buildId, pid: data.pid }
      : undefined
  } catch {
    return undefined
  }
}

export function writeRunningInstance(userDataPath: string, instance: RunningInstance): void {
  mkdirSync(userDataPath, { recursive: true })
  writeFileSync(join(userDataPath, FILE), JSON.stringify(instance))
}

/** Uma instância de outro build está aberta: a nova deve substituí-la. */
export function shouldReplace(running: RunningInstance | undefined, buildId: string): boolean {
  return running !== undefined && running.buildId !== buildId
}

export function isReplaceRequest(data: unknown, ownBuildId: string): boolean {
  if (typeof data !== 'object' || data === null) return false
  const request = data as Partial<InstanceRequest>
  return (
    request.replace === true &&
    typeof request.buildId === 'string' &&
    request.buildId !== ownBuildId
  )
}

/**
 * Tenta ser a instância única. Se outra de outro build estiver aberta, pede que ela saia e espera
 * até `timeoutMs` para assumir; se for do mesmo build, desiste (a aberta só traz a janela à frente).
 */
export async function acquireInstanceLock(options: {
  readonly buildId: string
  readonly running: RunningInstance | undefined
  readonly requestLock: (request: InstanceRequest) => boolean
  readonly sleep: (ms: number) => Promise<void>
  readonly timeoutMs?: number
}): Promise<boolean> {
  const replace = shouldReplace(options.running, options.buildId)
  const request: InstanceRequest = { buildId: options.buildId, replace }
  if (options.requestLock(request)) return true
  if (!replace) return false
  const deadline = options.timeoutMs ?? 10_000
  for (let waited = 0; waited < deadline; waited += 400) {
    await options.sleep(400)
    if (options.requestLock(request)) return true
  }
  return false
}
