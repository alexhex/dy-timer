import { contextBridge, ipcRenderer } from 'electron'
import type { Api } from '../shared/types'

const api: Api = {
  getConfig: () => ipcRenderer.invoke('config:get'),
  setConfig: (c) => ipcRenderer.invoke('config:set', c),
  listWeekTasks: () => ipcRenderer.invoke('tasks:week'),
  loadState: () => ipcRenderer.invoke('state:load'),
  saveState: (s) => ipcRenderer.invoke('state:save', s),
  syncDay: (ts) => ipcRenderer.invoke('log:sync', ts)
}

contextBridge.exposeInMainWorld('api', api)
