import { join } from 'node:path'

export function getDatabasePath(userDataPath: string): string {
  return join(userDataPath, 'AgileBox', 'agilebox.sqlite')
}

/** Empacotado, as migrações vão para os recursos do app; em desenvolvimento vale o padrão do pacote. */
export function getMigrationsFolder(
  isPackaged: boolean,
  resourcesPath: string,
): string | undefined {
  return isPackaged ? join(resourcesPath, 'migrations') : undefined
}
