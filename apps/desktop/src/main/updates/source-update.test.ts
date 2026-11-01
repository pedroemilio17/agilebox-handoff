import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { countLines, findRepoRoot, STAGING_OUTPUT, updatePlan } from './source-update'

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

describe('updatePlan', () => {
  it('Windows constrói a pasta nova em release/next e troca a win-unpacked', () => {
    expect(updatePlan({ platform: 'win32', repoRoot: repo })).toEqual({
      builderArgs: ['--dir', '--win', `--config.directories.output=${STAGING_OUTPUT}`],
      current: join(repo, 'release', 'win-unpacked'),
      staged: join(repo, 'release', 'next', 'win-unpacked'),
      kind: 'dir',
      exe: join(repo, 'release', 'win-unpacked', 'AgileBox.exe'),
      args: [],
    })
  })

  it('Linux: AppImage é regerado e substituído; a pasta desempacotada abre sem sandbox', () => {
    expect(
      updatePlan({ platform: 'linux', repoRoot: repo, appImage: '/x/AgileBox.AppImage' }),
    ).toMatchObject({
      builderArgs: ['--linux', 'AppImage', `--config.directories.output=${STAGING_OUTPUT}`],
      current: '/x/AgileBox.AppImage',
      kind: 'appimage',
    })
    expect(updatePlan({ platform: 'linux', repoRoot: repo })).toMatchObject({
      current: join(repo, 'release', 'linux-unpacked'),
      staged: join(repo, 'release', 'next', 'linux-unpacked'),
      args: ['--no-sandbox'],
    })
  })

  it('a pasta de saída é relativa e sem espaços (vai pela linha de comando do Windows)', () => {
    expect(STAGING_OUTPUT).not.toMatch(/\s/)
  })
})

describe('countLines', () => {
  it('conta só linhas com conteúdo', () => {
    expect(countLines(' M a.ts\n M b.ts\n')).toBe(2)
    expect(countLines('\n')).toBe(0)
  })
})
