import { mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

export const packageDirectory = fileURLToPath(new URL('../', import.meta.url))
export const repositoryDirectory = resolve(packageDirectory, '../..')
export const databasePath = resolve(repositoryDirectory, '.data/agilebox.db')

export async function createRuntime() {
  await mkdir(dirname(databasePath), { recursive: true })
  const vite = await createServer({
    configFile: false,
    root: repositoryDirectory,
    server: { middlewareMode: true },
    appType: 'custom',
    logLevel: 'error',
  })
  return vite
}
