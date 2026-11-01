import { dirname, join } from 'node:path'

/** Sobe a partir de cada ponto até achar a raiz do repositório (pnpm-workspace.yaml + .git). */
export function findRepoRoot(
  starts: readonly (string | undefined)[],
  exists: (path: string) => boolean,
): string | null {
  for (const start of starts) {
    if (!start) continue
    let current = start
    for (let depth = 0; depth < 8; depth += 1) {
      if (exists(join(current, 'pnpm-workspace.yaml')) && exists(join(current, '.git')))
        return current
      const parent = dirname(current)
      if (parent === current) break
      current = parent
    }
  }
  return null
}

export interface RelaunchPlan {
  /** Script do pacote desktop que reconstrói o app. */
  readonly script: 'pack:dir' | 'dist:linux'
  readonly exe: string
  readonly args: readonly string[]
}

/** O que reconstruir e o que reabrir, conforme o app foi aberto (pasta win/linux-unpacked ou AppImage). */
export function relaunchPlan(input: {
  readonly platform: string
  readonly repoRoot: string
  readonly appImage?: string | undefined
}): RelaunchPlan {
  const release = join(input.repoRoot, 'release')
  if (input.platform === 'win32') {
    return { script: 'pack:dir', exe: join(release, 'win-unpacked', 'AgileBox.exe'), args: [] }
  }
  if (input.appImage) return { script: 'dist:linux', exe: input.appImage, args: [] }
  return {
    script: 'pack:dir',
    exe: join(release, 'linux-unpacked', 'agilebox'),
    // A pasta desempacotada não tem o chrome-sandbox com setuid.
    args: ['--no-sandbox'],
  }
}

export function countLines(output: string): number {
  return output.split('\n').filter((line) => line.trim() !== '').length
}

/**
 * Auxiliar executado pelo `node` do sistema depois que o app fecha (no Windows os arquivos do app
 * aberto ficam travados). Recebe a configuração em JSON no primeiro argumento.
 */
export const UPDATE_HELPER_SOURCE = String.raw`'use strict'
const { spawn, spawnSync } = require('node:child_process')
const fs = require('node:fs')
const cfg = JSON.parse(process.argv[2])
const shell = process.platform === 'win32'
const log = (line) => fs.appendFileSync(cfg.logPath, '[' + new Date().toISOString() + '] ' + line + '\n')
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE

function waitForExit(pid) {
  for (let i = 0; i < 240; i += 1) {
    try { process.kill(pid, 0) } catch { return }
    sleep(500)
  }
}

function run(command, args) {
  log('$ ' + command + ' ' + args.join(' '))
  const result = spawnSync(command, args, { cwd: cfg.repoRoot, shell, env, encoding: 'utf8' })
  const output = ((result.stdout || '') + (result.stderr || '')).trim().split('\n').slice(-40).join('\n')
  if (output) log(output)
  if (result.error) log('erro: ' + result.error.message)
  return result.status === 0
}

function finish(ok, message) {
  log(message)
  fs.writeFileSync(cfg.resultPath, JSON.stringify({ ok, at: new Date().toISOString(), logPath: cfg.logPath, message }))
  if (fs.existsSync(cfg.exe)) {
    spawn(cfg.exe, cfg.args, { detached: true, stdio: 'ignore', cwd: require('node:path').dirname(cfg.exe), env }).unref()
  } else {
    log('app não encontrado para reabrir: ' + cfg.exe)
  }
}

log('atualização iniciada; esperando o app fechar')
waitForExit(cfg.pid)
sleep(800)
if (!run('git', ['pull', '--ff-only'])) finish(false, 'git pull falhou')
else if (!run('pnpm', ['install'])) finish(false, 'pnpm install falhou')
else if (!run('pnpm', ['--filter', '@agilebox/desktop', 'run', cfg.script])) finish(false, 'o reempacotamento falhou')
else finish(true, 'atualizado e reaberto')
`
