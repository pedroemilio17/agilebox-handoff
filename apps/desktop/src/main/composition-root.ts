import { randomBytes } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createUseCases } from '@agilebox/application'
import type { Clock, IdGenerator } from '@agilebox/application'
import { createSqliteAdapters, seedDemo } from '@agilebox/infra-sqlite'
import { createActorSession } from './actor-session.js'
import { ChangeBroadcaster } from './ipc/change-broadcaster.js'

// O bundle do main não carrega o diretório `migrations/` do pacote: ele é lido pelo link do workspace.
const migrationsFolder = fileURLToPath(
  new URL('../../node_modules/@agilebox/infra-sqlite/migrations', import.meta.url),
)

const alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

function createIdGenerator(): IdGenerator {
  return {
    generate() {
      const timestamp = Date.now()
      let timePart = ''
      let remaining = BigInt(timestamp)
      for (let index = 0; index < 10; index += 1) {
        timePart = alphabet[Number(remaining % 32n)]! + timePart
        remaining /= 32n
      }
      const randomPart = [...randomBytes(16)].map((byte) => alphabet[byte % 32]).join('')
      return Promise.resolve(`${timePart}${randomPart}`)
    },
  }
}

const systemClock: Clock = {
  now() {
    return Promise.resolve(new Date().toISOString())
  },
}

export interface CompositionRootOptions {
  readonly databasePath: string
  readonly isProduction: boolean
  /** Pasta das migrações; omitida, vale a do pacote `infra-sqlite` (desenvolvimento). */
  readonly migrationsFolder?: string
  readonly windows: ConstructorParameters<typeof ChangeBroadcaster>[0]
}

export async function createCompositionRoot(options: CompositionRootOptions) {
  if (options.databasePath !== ':memory:')
    await mkdir(dirname(options.databasePath), { recursive: true })
  const adapters = createSqliteAdapters(
    options.databasePath,
    options.migrationsFolder ?? migrationsFolder,
  )
  try {
    if (!(await adapters.hasOrganizations())) {
      if (options.isProduction) throw new Error('O banco não contém dados iniciais')
      await seedDemo({
        ...adapters,
        changeNotifier: new ChangeBroadcaster(options.windows),
      })
    }
    const actorSession = await createActorSession(adapters.users, {
      ...adapters.settings,
      getFirstOrganizationId: () => adapters.getFirstOrganizationId(),
    })
    return {
      useCases: createUseCases({
        ...adapters,
        actorSession,
        changeNotifier: new ChangeBroadcaster(options.windows),
        clock: systemClock,
        idGenerator: createIdGenerator(),
      }),
      actorSession,
      close: adapters.close,
    }
  } catch (error) {
    adapters.close()
    throw error
  }
}
