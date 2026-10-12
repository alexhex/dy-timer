import { contextBridge, ipcRenderer } from 'electron'
import type { Api } from '../shared/types'

const api: Api = {
  getConfig: () => ipcRenderer.invoke('config:get'),
  setConfig: (c) => ipcRenderer.invoke('config:set', c),
  listDoingTasks: () => ipcRenderer.invoke('tasks:doing'),
  loadState: () => ipcRenderer.invoke('state:load'),
  saveState: (s) => ipcRenderer.invoke('state:save', s),
  syncDay: (ts) => ipcRenderer.invoke('log:sync', ts)
}

contextBridge.exposeInMainWorld('api', api)
