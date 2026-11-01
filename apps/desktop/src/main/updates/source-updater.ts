import { execFile, spawn } from 'node:child_process'
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { UpdateRun, UpdateStatus, UpdateStep } from '@agilebox/contract'
import { countLines, findRepoRoot, RESTART_HELPER_SOURCE, updatePlan } from './source-update'

export interface SourceUpdaterOptions {
  readonly appPath: string
  readonly resourcesPath: string
  readonly userDataPath: string
  readonly isPackaged: boolean
  readonly platform: string
  readonly appImage: string | undefined
  readonly quit: () => void
  readonly notify: (step: UpdateStep) => void
}

// No Windows o pnpm é um .cmd, que só roda através do shell.
const shell = process.platform === 'win32'

function run(command: string, args: readonly string[], cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      command,
      args,
      { cwd, shell, timeout: 15 * 60_000, maxBuffer: 20 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          const detail = `${stderr}\n${stdout}`.trim().split('\n').slice(-4).join(' ')
          reject(new Error(detail || error.message))
        } else resolve(stdout)
      },
    )
  })
}

const message = (error: unknown) => (error instanceof Error ? error.message : String(error))

export function createSourceUpdater(options: SourceUpdaterOptions) {
  const resultPath = join(options.userDataPath, 'update-result.json')
  const logPath = join(options.userDataPath, 'update.log')
  let busy = false
  let ready = false

  const repoRoot = () =>
    findRepoRoot(
      [
        options.appPath,
        options.resourcesPath,
        options.appImage ? join(options.appImage, '..') : undefined,
      ],
      existsSync,
    )

  async function check(): Promise<UpdateStatus> {
    if (ready) return { state: 'ready' }
    const root = repoRoot()
    if (!root) {
      return {
        state: 'unsupported',
        reason: 'Este AgileBox não está dentro do repositório do código-fonte.',
      }
    }
    try {
      await run('git', ['--version'], root)
      await run('pnpm', ['--version'], root)
    } catch {
      return { state: 'unsupported', reason: 'git e pnpm precisam estar instalados.' }
    }
    try {
      const dirty = countLines(
        await run('git', ['status', '--porcelain', '--untracked-files=no'], root),
      )
      if (dirty > 0) return { state: 'dirty', files: dirty }
      await run('git', ['fetch', '--quiet'], root)
      const behind = Number((await run('git', ['rev-list', '--count', 'HEAD..@{u}'], root)).trim())
      if (behind === 0) {
        const commit = (await run('git', ['rev-parse', '--short', 'HEAD'], root)).trim()
        return { state: 'up-to-date', commit }
      }
      const log = await run('git', ['log', '--format=%s', '-n', '8', 'HEAD..@{u}'], root)
      return { state: 'available', behind, commits: log.split('\n').filter(Boolean) }
    } catch (error) {
      return { state: 'error', message: message(error) }
    }
  }

  /** Tudo com o app aberto: baixa, instala e constrói a versão nova numa pasta separada. */
  async function apply(): Promise<UpdateStatus> {
    if (busy) return { state: 'error', message: 'Uma atualização já está em andamento.' }
    const status = await check()
    if (status.state !== 'available') return status
    const root = repoRoot()!
    busy = true
    try {
      options.notify('pull')
      await run('git', ['pull', '--ff-only'], root)
      options.notify('install')
      await run('pnpm', ['install'], root)
      if (!options.isPackaged) return { state: 'done-dev' }
      const plan = updatePlan({
        platform: options.platform,
        repoRoot: root,
        appImage: options.appImage,
      })
      rmSync(join(root, 'release', 'next'), { recursive: true, force: true })
      options.notify('build')
      await run('pnpm', ['--filter', '@agilebox/desktop', 'run', 'build'], root)
      options.notify('package')
      await run(
        'pnpm',
        ['--filter', '@agilebox/desktop', 'exec', 'electron-builder', ...plan.builderArgs],
        root,
      )
      ready = true
      return { state: 'ready' }
    } catch (error) {
      return { state: 'error', message: message(error) }
    } finally {
      busy = false
    }
  }

  /** Troca pela versão já construída: o app fecha e o auxiliar move as pastas e reabre. */
  async function restart(): Promise<UpdateStatus> {
    const root = repoRoot()
    if (!ready || !root) return { state: 'error', message: 'Nenhuma versão nova pronta.' }
    const plan = updatePlan({
      platform: options.platform,
      repoRoot: root,
      appImage: options.appImage,
    })
    const helperPath = join(tmpdir(), 'agilebox-restart-helper.cjs')
    const configPath = join(tmpdir(), 'agilebox-restart-config.json')
    writeFileSync(helperPath, RESTART_HELPER_SOURCE)
    writeFileSync(logPath, '')
    writeFileSync(configPath, JSON.stringify({ pid: process.pid, ...plan, logPath, resultPath }))
    const started = await new Promise<UpdateStatus>((resolve) => {
      // Sem shell: os caminhos vão como argumentos separados, sem risco com espaços e aspas.
      const child = spawn('node', [helperPath, configPath], {
        detached: true,
        stdio: 'ignore',
        cwd: root,
        windowsHide: true,
      })
      child.once('error', () =>
        resolve({ state: 'unsupported', reason: 'O Node.js precisa estar instalado no sistema.' }),
      )
      child.once('spawn', () => {
        child.unref()
        resolve({ state: 'started' })
      })
    })
    if (started.state === 'started') setTimeout(options.quit, 300)
    return started
  }

  function lastRun(): UpdateRun | null {
    try {
      return JSON.parse(readFileSync(resultPath, 'utf8')) as UpdateRun
    } catch {
      return null
    }
  }

  return { check, apply, restart, lastRun }
}

export type SourceUpdater = ReturnType<typeof createSourceUpdater>
