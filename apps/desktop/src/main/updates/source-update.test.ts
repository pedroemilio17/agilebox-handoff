import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { countLines, findRepoRoot, relaunchPlan } from './source-update'

const repo = join('/', 'dev', 'agilebox')
const existing = new Set([join(repo, 'pnpm-workspace.yaml'), join(repo, '.git')])
const exists = (path: string) => existing.has(path)

describe('findRepoRoot', () => {
  it('acha o repositório a partir do app desempacotado e do código-fonte', () => {
    expect(
      findRepoRoot([join(repo, 'release', 'win-unpacked', 'resources', 'app.asar')], exists),
    ).toBe(repo)
    expect(findRepoRoot([join(repo, 'apps', 'desktop')], exists)).toBe(repo)
  })

  it('tenta o próximo ponto de partida e devolve null fora do repositório', () => {
    expect(
      findRepoRoot([undefined, join('/', 'opt', 'AgileBox'), join(repo, 'release')], exists),
    ).toBe(repo)
    expect(findRepoRoot([join('/', 'opt', 'AgileBox', 'resources')], exists)).toBeNull()
  })
})

describe('relaunchPlan', () => {
  it('Windows reempacota e reabre o AgileBox.exe da pasta win-unpacked', () => {
    expect(relaunchPlan({ platform: 'win32', repoRoot: repo })).toEqual({
      script: 'pack:dir',
      exe: join(repo, 'release', 'win-unpacked', 'AgileBox.exe'),
      args: [],
    })
  })

  it('Linux: AppImage é regerado; a pasta desempacotada abre sem sandbox', () => {
    expect(
      relaunchPlan({ platform: 'linux', repoRoot: repo, appImage: '/x/AgileBox.AppImage' }),
    ).toEqual({
      script: 'dist:linux',
      exe: '/x/AgileBox.AppImage',
      args: [],
    })
    expect(relaunchPlan({ platform: 'linux', repoRoot: repo })).toMatchObject({
      script: 'pack:dir',
      args: ['--no-sandbox'],
    })
  })
})

describe('countLines', () => {
  it('conta só linhas com conteúdo', () => {
    expect(countLines(' M a.ts\n M b.ts\n')).toBe(2)
    expect(countLines('\n')).toBe(0)
  })
})
