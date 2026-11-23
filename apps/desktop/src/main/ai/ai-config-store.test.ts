import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createAiConfigStore, type SecretBox } from './ai-config-store'

const tempDirs: string[] = []

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'agilebox-ai-store-'))
  tempDirs.push(dir)
  return dir
}

const encryptedBox: SecretBox = {
  isEncryptionAvailable: () => true,
  encrypt: (plain) => `enc:${plain}`,
  decrypt: (cipher) => cipher.replace(/^enc:/u, ''),
}

const plainFallbackBox: SecretBox = {
  isEncryptionAvailable: () => false,
  encrypt: () => {
    throw new Error('indisponível')
  },
  decrypt: () => {
    throw new Error('indisponível')
  },
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()!
    rmSync(dir, { recursive: true, force: true })
  }
})

describe('ai-config-store', () => {
  it('inicia não configurado com o modelo padrão', () => {
    const store = createAiConfigStore(makeTempDir(), encryptedBox)
    expect(store.getStatus()).toEqual({
      configured: false,
      model: 'gemini-2.5-flash',
      encrypted: false,
    })
    expect(store.readApiKey()).toBeNull()
  })

  it('salva chave criptografada, preserva chave ao trocar só o modelo e permite limpar', () => {
    const dir = makeTempDir()
    const store = createAiConfigStore(dir, encryptedBox)

    const saved = store.save({ apiKey: '  AIzaTeste123  ', model: 'gemini-2.5-flash-lite' })
    expect(saved).toEqual({
      configured: true,
      model: 'gemini-2.5-flash-lite',
      encrypted: true,
    })
    expect(store.readApiKey()).toBe('AIzaTeste123')

    const disk = readFileSync(join(dir, 'ai-config.json'), 'utf8')
    expect(disk).toContain('enc:AIzaTeste123')
    expect(disk).not.toContain('"AIzaTeste123"')

    const modelOnly = store.save({ model: 'gemini-2.0-flash' })
    expect(modelOnly).toEqual({
      configured: true,
      model: 'gemini-2.0-flash',
      encrypted: true,
    })
    expect(store.readApiKey()).toBe('AIzaTeste123')

    const cleared = store.clearKey()
    expect(cleared).toEqual({
      configured: false,
      model: 'gemini-2.0-flash',
      encrypted: false,
    })
    expect(store.readApiKey()).toBeNull()
  })

  it('usa codificação local quando safeStorage não está disponível e marca encrypted=false', () => {
    const store = createAiConfigStore(makeTempDir(), plainFallbackBox)
    const saved = store.save({ apiKey: 'AIzaFallback', model: 'gemini-2.5-flash' })
    expect(saved).toEqual({
      configured: true,
      model: 'gemini-2.5-flash',
      encrypted: false,
    })
    expect(store.readApiKey()).toBe('AIzaFallback')
  })
})
