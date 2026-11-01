import { UPDATE_CHANNELS } from '@agilebox/contract'
import type { SourceUpdater } from './source-updater'

export interface UpdateIpcMainLike {
  handle(channel: string, listener: () => unknown): void
}

export function registerUpdateHandlers(ipcMain: UpdateIpcMainLike, updater: SourceUpdater): void {
  ipcMain.handle(UPDATE_CHANNELS.check, () => updater.check())
  ipcMain.handle(UPDATE_CHANNELS.apply, () => updater.apply())
  ipcMain.handle(UPDATE_CHANNELS.lastRun, () => updater.lastRun())
}
