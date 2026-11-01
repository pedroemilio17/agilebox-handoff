import { execFile, spawn } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { UpdateRun, UpdateStatus } from '@agilebox/contract'
import { countLines, findRepoRoot, relaunchPlan, UPDATE_HELPER_SOURCE } from './source-update'

export interface SourceUpdaterOptions {
  readonly appPath: string
  readonly resourcesPath: string
  readonly userDataPath: string
  readonly isPackaged: boolean
  readonly platform: string
  readonly appImage: string | undefined
  readonly quit: () => void
}

const shell = process.platform === 'win32'

function run(command: string, args: readonly string[], cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      command,
      args,
      { cwd, shell, timeout: 10 * 60_000, maxBuffer: 10 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error)
          reject(new Error((stderr || error.message).trim().split('\n').slice(-3).join(' ')))
        else resolve(stdout)
      },
    )
  })
}

export function createSourceUpdater(options: SourceUpdaterOptions) {
  const resultPath = join(options.userDataPath, 'update-result.json')
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
        return {
          state: 'up-to-date',
          commit: (await run('git', ['rev-parse', '--short', 'HEAD'], root)).trim(),
        }
      }
      const log = await run('git', ['log', '--format=%s', '-n', '8', 'HEAD..@{u}'], root)
      return { state: 'available', behind, commits: log.split('\n').filter(Boolean) }
    } catch (error) {
      return { state: 'error', message: error instanceof Error ? error.message : String(error) }
    }
  }

  async function apply(): Promise<UpdateStatus> {
    const status = await check()
    if (status.state !== 'available') return status
    const root = repoRoot()!
    if (!options.isPackaged) {
      // Em `pnpm dev`: atualiza o código; o próprio pnpm dev precisa ser reiniciado.
      try {
        await run('git', ['pull', '--ff-only'], root)
        await run('pnpm', ['install'], root)
        return { state: 'done-dev' }
      } catch (error) {
        return { state: 'error', message: error instanceof Error ? error.message : String(error) }
      }
    }
    const plan = relaunchPlan({
      platform: options.platform,
      repoRoot: root,
      appImage: options.appImage,
    })
    const helperPath = join(tmpdir(), 'agilebox-update-helper.cjs')
    const logPath = join(options.userDataPath, 'update.log')
    writeFileSync(helperPath, UPDATE_HELPER_SOURCE)
    writeFileSync(logPath, '')
    const config = JSON.stringify({
      pid: process.pid,
      repoRoot: root,
      script: plan.script,
      exe: plan.exe,
      args: plan.args,
      logPath,
      resultPath,
    })
    const started = await new Promise<UpdateStatus>((resolve) => {
      const child = spawn('node', [helperPath, config], {
        detached: true,
        stdio: 'ignore',
        shell,
        cwd: root,
      })
      child.once('error', () =>
        resolve({ state: 'unsupported', reason: 'O Node.js precisa estar instalado no sistema.' }),
      )
      child.once('spawn', () => {
        child.unref()
        resolve({ state: 'started' })
      })
    })
    if (started.state === 'started') setTimeout(options.quit, 400)
    return started
  }

  function lastRun(): UpdateRun | null {
    try {
      return JSON.parse(readFileSync(resultPath, 'utf8')) as UpdateRun
    } catch {
      return null
    }
  }

  return { check, apply, lastRun }
}

export type SourceUpdater = ReturnType<typeof createSourceUpdater>
