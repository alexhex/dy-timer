import { contextBridge, ipcRenderer } from 'electron'
import type { Api, AutoPauseReason } from '../shared/types'

const api: Api = {
  getConfig: () => ipcRenderer.invoke('config:get'),
  setConfig: (c) => ipcRenderer.invoke('config:set', c),
  listDoingTasks: () => ipcRenderer.invoke('tasks:doing'),
  loadState: () => ipcRenderer.invoke('state:load'),
  saveState: (s) => ipcRenderer.invoke('state:save', s),
  syncDay: (ts) => ipcRenderer.invoke('log:sync', ts),
  setMini: (on) => ipcRenderer.invoke('window:mini', on),
  onAutoPause: (cb) => {
    const h = (_e: unknown, p: { reason: AutoPauseReason; at: number }) => cb(p)
    ipcRenderer.on('power:pause', h)
    return () => ipcRenderer.removeListener('power:pause', h)
  }
}

contextBridge.exposeInMainWorld('api', api)
