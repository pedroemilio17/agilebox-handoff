import { Buffer } from 'node:buffer'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  DEFAULT_AI_MODEL,
  aiModelSchema,
  type AiConfigStatus,
  type AiModel,
  type SaveAiConfigInput,
} from '@agilebox/contract'

const FILE = 'ai-config.json'

interface StoredAiConfig {
  readonly model: AiModel
  readonly encrypted: boolean
  readonly secret?: string
}

export interface SecretBox {
  isEncryptionAvailable(): boolean
  encrypt(plain: string): string
  decrypt(cipher: string): string
}

export interface AiConfigStore {
  getStatus(): AiConfigStatus
  readApiKey(): string | null
  save(input: SaveAiConfigInput): AiConfigStatus
  clearKey(): AiConfigStatus
}

const DEFAULT_CONFIG: StoredAiConfig = {
  model: DEFAULT_AI_MODEL,
  encrypted: false,
}

function parseStoredConfig(raw: unknown): StoredAiConfig {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return DEFAULT_CONFIG
  }
  const obj = raw as Record<string, unknown>
  const parsedModel = aiModelSchema.safeParse(obj.model)
  const model = parsedModel.success ? parsedModel.data : DEFAULT_AI_MODEL
  const encrypted = typeof obj.encrypted === 'boolean' ? obj.encrypted : false
  const secret = typeof obj.secret === 'string' && obj.secret.length > 0 ? obj.secret : undefined
  return secret === undefined ? { model, encrypted } : { model, encrypted, secret }
}

export function createAiConfigStore(userDataPath: string, secretBox: SecretBox): AiConfigStore {
  const filePath = join(userDataPath, FILE)

  const readStored = (): StoredAiConfig => {
    try {
      const raw: unknown = JSON.parse(readFileSync(filePath, 'utf8'))
      return parseStoredConfig(raw)
    } catch {
      return DEFAULT_CONFIG
    }
  }

  const writeStored = (config: StoredAiConfig): void => {
    mkdirSync(userDataPath, { recursive: true })
    writeFileSync(filePath, JSON.stringify(config, null, 2), { encoding: 'utf8', mode: 0o600 })
  }

  const decodeSecret = (config: StoredAiConfig): string | null => {
    if (!config.secret) return null
    try {
      const decoded = config.encrypted
        ? secretBox.isEncryptionAvailable()
          ? secretBox.decrypt(config.secret)
          : ''
        : Buffer.from(config.secret, 'base64').toString('utf8')
      const trimmed = decoded.trim()
      return trimmed.length > 0 ? trimmed : null
    } catch {
      return null
    }
  }

  const encodeSecret = (plainKey: string): Pick<StoredAiConfig, 'encrypted' | 'secret'> => {
    if (secretBox.isEncryptionAvailable()) {
      return { encrypted: true, secret: secretBox.encrypt(plainKey) }
    }
    return {
      encrypted: false,
      secret: Buffer.from(plainKey, 'utf8').toString('base64'),
    }
  }

  const statusOf = (config: StoredAiConfig): AiConfigStatus => ({
    configured: decodeSecret(config) !== null,
    model: config.model,
    encrypted: Boolean(config.secret && config.encrypted),
  })

  return {
    getStatus() {
      return statusOf(readStored())
    },

    readApiKey() {
      return decodeSecret(readStored())
    },

    save(input) {
      const current = readStored()
      const nextKey = input.apiKey?.trim()
      const nextSecret =
        nextKey && nextKey.length > 0
          ? encodeSecret(nextKey)
          : current.secret
            ? { encrypted: current.encrypted, secret: current.secret }
            : { encrypted: false }

      const next: StoredAiConfig = {
        model: input.model,
        ...nextSecret,
      }
      writeStored(next)
      return statusOf(next)
    },

    clearKey() {
      const current = readStored()
      const next: StoredAiConfig = {
        model: current.model,
        encrypted: false,
      }
      writeStored(next)
      return statusOf(next)
    },
  }
}
