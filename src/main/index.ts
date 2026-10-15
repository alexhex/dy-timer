import { app, BrowserWindow, ipcMain, screen, type Rectangle } from 'electron'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { Config, PersistedState } from '../shared/types'
import { listDoingTasks, syncDay } from './vault'

const DEFAULT_CONFIG: Config = {
  vaultPath: '/Users/neil/own_kits/mac-notes-obsidian',
  tasksDir: '40_Tasks',
  logsDir: '70_Logs',
  breakRatio: 0.25
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

const getConfig = async (): Promise<Config> => {
  const c = { ...DEFAULT_CONFIG, ...((await readJson<Partial<Config>>('config.json')) ?? {}) }
  const r = Number(c.breakRatio)
  return { ...c, breakRatio: Number.isFinite(r) && r > 0 ? r : DEFAULT_CONFIG.breakRatio }
}

const NORMAL_MIN = { width: 820, height: 560 }
const MINI_SIZE = { width: 260, height: 104 }
/** Bounds to go back to when leaving mini mode, and where the mini window was last left. */
let normalBounds: Rectangle | null = null
let miniPos: { x: number; y: number } | null = null

/**
 * Mini mode: shrink to a small clock + task window and float it above all other windows
 * (incl. other apps' full-screen spaces on macOS). Calling it with false restores the window.
 */
function setMini(win: BrowserWindow, on: boolean): boolean {
  const mac = process.platform === 'darwin'
  if (on === (normalBounds !== null)) return on
  if (on) {
    normalBounds = win.getBounds()
    const area = screen.getDisplayMatching(normalBounds).workArea
    const pos = miniPos ?? { x: area.x + area.width - MINI_SIZE.width - 16, y: area.y + 16 }
    if (mac) win.setWindowButtonVisibility(false)
    win.setMenuBarVisibility(false)
    win.setMinimumSize(MINI_SIZE.width, MINI_SIZE.height)
    win.setPosition(pos.x, pos.y)
    // Content size, so the Windows title bar doesn't eat into the mini layout.
    win.setContentSize(MINI_SIZE.width, MINI_SIZE.height)
    win.setResizable(false)
    win.setAlwaysOnTop(true, 'floating')
    if (mac) win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  } else {
    const b = win.getBounds()
    miniPos = { x: b.x, y: b.y }
    win.setAlwaysOnTop(false)
    if (mac) win.setVisibleOnAllWorkspaces(false)
    win.setResizable(true)
    win.setMinimumSize(NORMAL_MIN.width, NORMAL_MIN.height)
    win.setMenuBarVisibility(true)
    if (normalBounds) win.setBounds(normalBounds)
    if (mac) win.setWindowButtonVisibility(true)
    normalBounds = null
  }
  return on
}

function createWindow() {
  const win = new BrowserWindow({
    width: 980,
    height: 680,
    minWidth: NORMAL_MIN.width,
    minHeight: NORMAL_MIN.height,
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
  normalBounds = null
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
  ipcMain.handle('window:mini', (e, on: boolean) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    return win ? setMini(win, on) : false
  })
  createWindow()
  app.on('activate', () => BrowserWindow.getAllWindows().length === 0 && createWindow())
})

app.on('window-all-closed', () => app.quit())
