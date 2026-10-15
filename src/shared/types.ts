export interface Config {
  /** Obsidian vault root */
  vaultPath: string
  /** Folder (relative to vault) holding task notes */
  tasksDir: string
  /** Folder (relative to vault) holding weekly logs, e.g. 2026-W42.md */
  logsDir: string
  /** Break target = focus time × breakRatio (e.g. 0.25 → a quarter of the focus time) */
  breakRatio: number
}

export interface WeekTask {
  /** Note name without extension, used as [[wikilink]] */
  name: string
  path: string
  status: string
  priority: string
  alertDate: string
  dueDate: string
}

export interface Session {
  id: string
  task: string
  deliverable: string
  done: boolean
  startedAt: number
  endedAt: number
  durationMs: number
}

/** One finished break; durationMs is the time actually spent resting, overtime included, pauses excluded. */
export interface BreakRecord {
  startedAt: number
  endedAt: number
  durationMs: number
}

export interface TimerState {
  phase: 'idle' | 'focus' | 'break' | 'paused'
  phaseBeforePause: 'focus' | 'break' | null
  phaseStartedAt: number | null
  phaseBaseElapsedMs: number
  focusStartedAt: number | null
  breakStartedAt: number | null
  /** Break target (focus × breakRatio); after it the break keeps counting up until focus is started by hand */
  breakDurationMs: number
  /** the break target has been reached and the chime has played */
  breakOvertime: boolean
  lastFocusDurationMs: number
  task: string
  deliverable: string
  /** previous focus ended unfinished → task stays locked through the break */
  taskLocked: boolean
  stopAsDone: boolean
}

export interface PersistedState {
  timer: TimerState
  sessions: Session[]
  breaks?: BreakRecord[]
}

export interface SyncResult {
  ok: boolean
  file?: string
  error?: string
}

export interface Api {
  getConfig(): Promise<Config>
  setConfig(c: Config): Promise<Config>
  listDoingTasks(): Promise<{ weekKey: string; tasks: WeekTask[]; error?: string }>
  loadState(): Promise<PersistedState | null>
  saveState(s: PersistedState): Promise<void>
  /** Rewrite the day block of the weekly log for the day of `ts` */
  syncDay(ts: number): Promise<SyncResult>
}
