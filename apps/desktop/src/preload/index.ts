import { contextBridge, ipcRenderer } from 'electron'
import {
  AI_CHANNELS,
  CHANGE_CHANNEL,
  UPDATE_CHANNELS,
  type AgileBoxBridge,
  type AiCompleteResult,
  type AiConfigStatus,
  type AiTestResult,
  type ShellChannel,
} from '@agilebox/contract'

const bridge: AgileBoxBridge = {
  invoke: (channel, input) => ipcRenderer.invoke(channel, input),
  onChanges: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, change: Parameters<typeof callback>[0]) =>
      callback(change)
    ipcRenderer.on(CHANGE_CHANNEL, listener)
    return () => ipcRenderer.removeListener(CHANGE_CHANNEL, listener)
  },
  shell: {
    minimize: () => invokeShell('window.minimize'),
    close: () => invokeShell('window.close'),
    toggleTray: () => invokeShell('window.toggleTray'),
    openPanel: () => invokeShell('window.openPanel'),
    setTrayHeight: (input) => invokeShell('window.setTrayHeight', input),
    setAppearance: (input) => invokeShell('window.setAppearance', input),
  },
  updates: {
    check: () => ipcRenderer.invoke(UPDATE_CHANNELS.check),
    apply: () => ipcRenderer.invoke(UPDATE_CHANNELS.apply),
    restart: () => ipcRenderer.invoke(UPDATE_CHANNELS.restart),
    lastRun: () => ipcRenderer.invoke(UPDATE_CHANNELS.lastRun),
    info: () => ipcRenderer.invoke(UPDATE_CHANNELS.info),
    onProgress: (callback) => {
      const listener = (_event: Electron.IpcRendererEvent, step: Parameters<typeof callback>[0]) =>
        callback(step)
      ipcRenderer.on(UPDATE_CHANNELS.progress, listener)
      return () => ipcRenderer.removeListener(UPDATE_CHANNELS.progress, listener)
    },
  },
  ai: {
    getConfig: () => ipcRenderer.invoke(AI_CHANNELS.getConfig) as Promise<AiConfigStatus>,
    saveConfig: (input) =>
      ipcRenderer.invoke(AI_CHANNELS.saveConfig, input) as Promise<AiConfigStatus>,
    clearKey: () => ipcRenderer.invoke(AI_CHANNELS.clearKey) as Promise<AiConfigStatus>,
    testConnection: () => ipcRenderer.invoke(AI_CHANNELS.testConnection) as Promise<AiTestResult>,
    complete: (input) =>
      ipcRenderer.invoke(AI_CHANNELS.complete, input) as Promise<AiCompleteResult>,
  },
}

function invokeShell(channel: ShellChannel, input?: unknown): void {
  void ipcRenderer.invoke(channel, input)
}

contextBridge.exposeInMainWorld('agilebox', bridge)
