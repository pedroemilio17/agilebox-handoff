export function getNativeRebuildPlan(target, moduleDir) {
  if (target === 'node') {
    return { command: 'npm', args: ['rebuild', 'better-sqlite3'] }
  }

  if (target === 'electron') {
    return {
      command: 'pnpm',
      args: [
        'exec',
        'electron-rebuild',
        '-f',
        '-w',
        'better-sqlite3',
        ...(moduleDir ? ['-m', moduleDir] : []),
      ],
    }
  }

  throw new Error(`Alvo nativo inválido: ${target}`)
}
