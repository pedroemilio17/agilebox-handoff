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

/** Pasta (relativa a apps/desktop, sem espaços) onde a versão nova é construída ao lado da atual. */
export const STAGING_OUTPUT = '../../release/next'

export interface UpdatePlan {
  /** Alvo do electron-builder para a versão nova. */
  readonly builderArgs: readonly string[]
  /** O que está em uso agora: a pasta desempacotada ou o arquivo .AppImage. */
  readonly current: string
  /** Onde a versão nova fica pronta; para AppImage, a pasta onde procurar o arquivo. */
  readonly staged: string
  readonly kind: 'dir' | 'appimage'
  readonly exe: string
  readonly args: readonly string[]
}

/** Como reconstruir e trocar, conforme o app foi aberto (win-unpacked, linux-unpacked ou AppImage). */
export function updatePlan(input: {
  readonly platform: string
  readonly repoRoot: string
  readonly appImage?: string | undefined
}): UpdatePlan {
  const release = join(input.repoRoot, 'release')
  const staging = join(release, 'next')
  const output = `--config.directories.output=${STAGING_OUTPUT}`
  if (input.platform === 'win32') {
    return {
      builderArgs: ['--dir', '--win', output],
      current: join(release, 'win-unpacked'),
      staged: join(staging, 'win-unpacked'),
      kind: 'dir',
      exe: join(release, 'win-unpacked', 'AgileBox.exe'),
      args: [],
    }
  }
  if (input.appImage) {
    return {
      builderArgs: ['--linux', 'AppImage', output],
      current: input.appImage,
      staged: staging,
      kind: 'appimage',
      exe: input.appImage,
      args: [],
    }
  }
  return {
    builderArgs: ['--dir', '--linux', output],
    current: join(release, 'linux-unpacked'),
    staged: join(staging, 'linux-unpacked'),
    kind: 'dir',
    exe: join(release, 'linux-unpacked', 'agilebox'),
    // A pasta desempacotada não tem o chrome-sandbox com setuid.
    args: ['--no-sandbox'],
  }
}

export function countLines(output: string): number {
  return output.split('\n').filter((line) => line.trim() !== '').length
}

/**
 * Auxiliar de reinício, executado pelo `node` do sistema: espera o app fechar, troca a versão em uso
 * pela já construída (com novas tentativas, porque o Windows demora a soltar os arquivos) e reabre.
 * Recebe o caminho de um arquivo JSON de configuração.
 */
export const RESTART_HELPER_SOURCE = String.raw`'use strict'
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')
const cfg = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
const log = (line) => fs.appendFileSync(cfg.logPath, '[' + new Date().toISOString() + '] ' + line + '\n')
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE

function waitForExit(pid) {
  for (let i = 0; i < 120; i += 1) {
    try { process.kill(pid, 0) } catch { return }
    sleep(250)
  }
}

function retry(label, action) {
  for (let i = 0; i < 40; i += 1) {
    try { action(); return true } catch (error) {
      if (i === 39) log(label + ' falhou: ' + error.message)
      sleep(500)
    }
  }
  return false
}

function swap() {
  if (cfg.kind === 'appimage') {
    const file = fs.readdirSync(cfg.staged).find((name) => name.endsWith('.AppImage'))
    if (!file) { log('AppImage novo não encontrado em ' + cfg.staged); return false }
    const next = path.join(cfg.staged, file)
    if (!retry('substituir o AppImage', () => fs.copyFileSync(next, cfg.current))) return false
    fs.chmodSync(cfg.current, 0o755)
    return true
  }
  const backup = cfg.current + '.old'
  fs.rmSync(backup, { recursive: true, force: true })
  if (fs.existsSync(cfg.current) && !retry('mover a versão antiga', () => fs.renameSync(cfg.current, backup))) return false
  if (!retry('colocar a versão nova', () => fs.renameSync(cfg.staged, cfg.current))) {
    retry('restaurar a versão antiga', () => fs.renameSync(backup, cfg.current))
    return false
  }
  fs.rmSync(backup, { recursive: true, force: true })
  return true
}

let ok = false
try {
  log('reiniciando: esperando o app fechar')
  waitForExit(cfg.pid)
  ok = swap()
  log(ok ? 'versão nova no lugar' : 'troca não concluída; reabrindo a versão anterior')
} catch (error) {
  log('erro: ' + (error && error.message))
}
fs.writeFileSync(cfg.resultPath, JSON.stringify({
  ok,
  at: new Date().toISOString(),
  logPath: cfg.logPath,
  message: ok ? 'atualizado e reaberto' : 'a troca pela versão nova falhou',
}))
if (fs.existsSync(cfg.exe)) {
  spawn(cfg.exe, cfg.args, { detached: true, stdio: 'ignore', cwd: path.dirname(cfg.exe), env }).unref()
} else {
  log('app não encontrado para reabrir: ' + cfg.exe)
}
`
