import { createRuntime, databasePath } from './runtime.mjs'

const vite = await createRuntime()
let adapters
let client
try {
  const [{ createSqliteAdapters }, { createSqliteClient }, { seedDemo }] = await Promise.all([
    vite.ssrLoadModule('/packages/infra-sqlite/src/create-sqlite-adapters.ts'),
    vite.ssrLoadModule('/packages/infra-sqlite/src/client.ts'),
    vite.ssrLoadModule('/packages/infra-sqlite/src/seed/seed.ts'),
  ])
  adapters = createSqliteAdapters(databasePath)
  client = createSqliteClient(databasePath)
  await seedDemo({
    ...adapters,
    saveOrganization: async (organization) => {
      client.$client
        .prepare(
          'INSERT INTO organizations (id, name, created_at) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, created_at = excluded.created_at',
        )
        .run(organization.id, organization.name, organization.createdAt)
    },
  })
} finally {
  adapters?.close()
  client?.$client.close()
  await vite.close()
}
