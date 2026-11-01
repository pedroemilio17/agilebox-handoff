import { contextBridge, ipcRenderer } from 'electron'
import { CHANGE_CHANNEL, type AgileBoxBridge, type ShellChannel } from '@agilebox/contract'

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
  },
}

function invokeShell(channel: ShellChannel, input?: unknown): void {
  void ipcRenderer.invoke(channel, input)
}

contextBridge.exposeInMainWorld('agilebox', bridge)
