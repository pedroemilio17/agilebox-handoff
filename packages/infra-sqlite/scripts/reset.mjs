import { rm } from 'node:fs/promises'
import { databasePath } from './runtime.mjs'

await rm(databasePath, { force: true })
await rm(`${databasePath}-shm`, { force: true })
await rm(`${databasePath}-wal`, { force: true })
