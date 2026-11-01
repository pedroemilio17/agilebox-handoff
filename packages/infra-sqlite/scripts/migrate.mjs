import { createRuntime, databasePath } from './runtime.mjs'

const vite = await createRuntime()
try {
  const { createSqliteClient } = await vite.ssrLoadModule('/packages/infra-sqlite/src/client.ts')
  createSqliteClient(databasePath).$client.close()
} finally {
  await vite.close()
}
