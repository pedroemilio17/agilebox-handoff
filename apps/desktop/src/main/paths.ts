import { join } from 'node:path'

export function getDatabasePath(userDataPath: string): string {
  return join(userDataPath, 'AgileBox', 'agilebox.sqlite')
}
