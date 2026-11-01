import { UPDATE_CHANNELS } from '@agilebox/contract'
import type { UpdateInfo, UpdateRun, UpdateStatus } from '@agilebox/contract'

export interface UpdateIpcMainLike {
  handle(channel: string, listener: () => unknown): void
}

export interface Updater {
  check(): Promise<UpdateStatus>
  apply(): Promise<UpdateStatus>
  restart(): Promise<UpdateStatus>
  lastRun(): UpdateRun | null
}

export function registerUpdateHandlers(
  ipcMain: UpdateIpcMainLike,
  updater: Updater,
  info: UpdateInfo,
): void {
  ipcMain.handle(UPDATE_CHANNELS.check, () => updater.check())
  ipcMain.handle(UPDATE_CHANNELS.apply, () => updater.apply())
  ipcMain.handle(UPDATE_CHANNELS.restart, () => updater.restart())
  ipcMain.handle(UPDATE_CHANNELS.lastRun, () => updater.lastRun())
  ipcMain.handle(UPDATE_CHANNELS.info, () => info)
}
