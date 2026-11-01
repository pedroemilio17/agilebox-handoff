import { spawnSync } from 'node:child_process'
import console from 'node:console'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import process from 'node:process'
import { getNativeRebuildPlan } from '../tooling/native-rebuild-plan.mjs'

const require = createRequire(import.meta.url)
const target = process.argv[2]
const moduleDir = resolve('packages/infra-sqlite')

if (target !== 'node' && target !== 'electron') {
  console.error('Uso: node scripts/ensure-native.mjs <node|electron>')
  process.exit(2)
}

let packagePath
try {
  packagePath = require.resolve('better-sqlite3', {
    paths: [moduleDir],
  })
} catch {
  console.log('better-sqlite3 não está instalado; nenhuma ação necessária.')
  process.exit(0)
}

let electronPath
if (target === 'electron') {
  try {
    electronPath = createRequire(resolve('apps/desktop/package.json'))('electron')
  } catch {
    console.log('Electron não está instalado; nenhuma ação necessária.')
    process.exit(0)
  }
}

function loadNativeModule() {
  if (target === 'node') {
    try {
      require(packagePath)
      return { status: 0, output: '' }
    } catch (error) {
      return { status: 1, output: error instanceof Error ? error.message : String(error) }
    }
  }

  const result = spawnSync(electronPath, ['-e', `require(${JSON.stringify(packagePath)})`], {
    encoding: 'utf8',
    cwd: resolve('packages/infra-sqlite'),
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
  })
  return {
    status: result.status ?? 1,
    output: `${result.stdout ?? ''}${result.stderr ?? ''}`,
  }
}

const initialLoad = loadNativeModule()
if (initialLoad.status === 0) {
  process.exit(0)
}

const isAbiMismatch = /NODE_MODULE_VERSION|compiled against a different Node\.js version/i.test(
  initialLoad.output,
)
if (!isAbiMismatch) {
  console.error(
    `Não foi possível carregar better-sqlite3 no alvo ${target}:\n${initialLoad.output}`,
  )
  process.exit(1)
}

const plan = getNativeRebuildPlan(target, moduleDir)
console.log(`ABI incompatível no alvo ${target}; reconstruindo better-sqlite3.`)
const rebuilt = spawnSync(plan.command, plan.args, {
  cwd: target === 'node' ? moduleDir : process.cwd(),
  stdio: 'inherit',
  env: process.env,
})
if (rebuilt.error || rebuilt.status !== 0) {
  console.error(
    `Falha ao reconstruir better-sqlite3 para ${target}. Verifique compilador, headers e dependências locais.`,
  )
  if (rebuilt.error) console.error(rebuilt.error.message)
  process.exit(rebuilt.status ?? 1)
}

const finalLoad = loadNativeModule()
if (finalLoad.status !== 0) {
  console.error(
    `A reconstrução terminou, mas better-sqlite3 ainda não carrega no alvo ${target}:\n${finalLoad.output}`,
  )
  process.exit(1)
}
