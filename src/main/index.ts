import { app, BrowserWindow, ipcMain } from 'electron'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { Config, PersistedState } from '../shared/types'
import { listDoingTasks, syncDay } from './vault'

const DEFAULT_CONFIG: Config = {
  vaultPath: '/Users/neil/own_kits/mac-notes-obsidian',
  tasksDir: '40_Tasks',
  logsDir: '70_Logs'
}

// Packaged builds embed build/icon.{icns,ico}; in dev we set it explicitly.
const devIcon = join(__dirname, '../../build/icon.png')

const file = (name: string) => join(app.getPath('userData'), name)

async function readJson<T>(name: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(file(name), 'utf8')) as T
  } catch {
    return null
  }
}

async function writeJson(name: string, data: unknown) {
  await mkdir(dirname(file(name)), { recursive: true })
  const tmp = file(name) + '.tmp'
  await writeFile(tmp, JSON.stringify(data, null, 2), 'utf8')
  await rename(tmp, file(name))
}

const getConfig = async (): Promise<Config> => ({
  ...DEFAULT_CONFIG,
  ...((await readJson<Partial<Config>>('config.json')) ?? {})
})

function createWindow() {
  const win = new BrowserWindow({
    width: 980,
    height: 680,
    minWidth: 820,
    minHeight: 560,
    titleBarStyle: 'hiddenInset',
    ...(app.isPackaged ? {} : { icon: devIcon }),
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false
    }
  })
  win.once('ready-to-show', () => win.show())
  if (process.env.ELECTRON_RENDERER_URL) win.loadURL(process.env.ELECTRON_RENDERER_URL)
  else win.loadFile(join(__dirname, '../renderer/index.html'))
}

app.whenReady().then(() => {
  if (!app.isPackaged) app.dock?.setIcon(devIcon)
  ipcMain.handle('config:get', getConfig)
  ipcMain.handle('config:set', async (_e, c: Config) => {
    await writeJson('config.json', c)
    return getConfig()
  })
  ipcMain.handle('tasks:doing', async () => {
    try {
      return await listDoingTasks(await getConfig())
    } catch (e) {
      return { weekKey: '', tasks: [], error: (e as Error).message }
    }
  })
  ipcMain.handle('state:load', () => readJson<PersistedState>('state.json'))
  ipcMain.handle('state:save', (_e, s: PersistedState) => writeJson('state.json', s))
  ipcMain.handle('log:sync', async (_e, ts: number) => {
    try {
      const state = await readJson<PersistedState>('state.json')
      const path = await syncDay(await getConfig(), state?.sessions ?? [], ts, state?.breaks ?? [])
      return { ok: true, file: path }
    } catch (e) {
      return { ok: false, error: (e as Error).message }
    }
  })
  createWindow()
  app.on('activate', () => BrowserWindow.getAllWindows().length === 0 && createWindow())
})

app.on('window-all-closed', () => app.quit())
