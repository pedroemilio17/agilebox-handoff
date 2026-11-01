// Fonte única das fronteiras entre camadas (PLANO 3.1).
// Usada pelo eslint.config.js e pelos testes, para um não se afastar do outro.

/** Pacotes de runtime que não podem vazar para camadas puras ou de interface. */
const RUNTIME_PACKAGES = ['electron', 'better-sqlite3', 'drizzle-orm', 'drizzle-orm/*']

/**
 * @type {ReadonlyArray<{
 *   directory: string,
 *   allowed: readonly string[],
 *   forbiddenRuntime: readonly string[],
 *   forbidNodeBuiltins: boolean,
 * }>}
 */
export const layers = [
  {
    directory: 'packages/core',
    allowed: [],
    forbiddenRuntime: RUNTIME_PACKAGES,
    forbidNodeBuiltins: true,
  },
  {
    directory: 'packages/contract',
    allowed: [],
    forbiddenRuntime: RUNTIME_PACKAGES,
    forbidNodeBuiltins: false,
  },
  {
    directory: 'packages/application',
    allowed: ['core', 'contract'],
    forbiddenRuntime: RUNTIME_PACKAGES,
    forbidNodeBuiltins: false,
  },
  {
    directory: 'packages/infra-sqlite',
    allowed: ['core', 'application'],
    forbiddenRuntime: [],
    forbidNodeBuiltins: false,
  },
  {
    directory: 'packages/ui',
    allowed: ['core'],
    forbiddenRuntime: RUNTIME_PACKAGES,
    forbidNodeBuiltins: true,
  },
  {
    directory: 'apps/desktop/src/main',
    allowed: ['core', 'contract', 'application', 'infra-sqlite'],
    forbiddenRuntime: [],
    forbidNodeBuiltins: false,
  },
  {
    // O preload usa o `electron` (contextBridge), mas nunca o banco.
    directory: 'apps/desktop/src/preload',
    allowed: ['contract'],
    forbiddenRuntime: ['better-sqlite3', 'drizzle-orm', 'drizzle-orm/*'],
    forbidNodeBuiltins: false,
  },
  {
    directory: 'apps/desktop/src/renderer',
    allowed: ['core', 'contract', 'ui'],
    forbiddenRuntime: RUNTIME_PACKAGES,
    forbidNodeBuiltins: true,
  },
  {
    directory: 'apps/server',
    allowed: ['core', 'contract', 'application', 'infra-sqlite', 'infra-postgres'],
    forbiddenRuntime: [],
    forbidNodeBuiltins: false,
  },
]
