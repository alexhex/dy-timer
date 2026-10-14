import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { BreakRecord, Config, PersistedState, Session, TimerState, WeekTask } from '../shared/types'
import { activePhase, breakRestedMs, elapsedMs, endBreak, formatClock, initialTimer, pauseResume, startFocus, stopFocus } from './timer'

async function ding() {
  try {
    const ctx = new AudioContext()
    for (let i = 0; i < 3; i++) {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      const t = ctx.currentTime + i * 0.2
      o.frequency.value = 880
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(0.15, t + 0.01)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16)
      o.connect(g).connect(ctx.destination)
      o.start(t)
      o.stop(t + 0.18)
    }
  } catch {
    /* audio blocked */
  }
}

const sameDay = (a: number, b: number) => new Date(a).toDateString() === new Date(b).toDateString()

export function App() {
  const [timer, setTimer] = useState<TimerState>(initialTimer)
  const [sessions, setSessions] = useState<Session[]>([])
  const [breaks, setBreaks] = useState<BreakRecord[]>([])
  const [tasks, setTasks] = useState<WeekTask[]>([])
  const [weekKey, setWeekKey] = useState('')
  const [tasksError, setTasksError] = useState('')
  const [now, setNow] = useState(Date.now())
  const [message, setMessage] = useState('')
  const [config, setConfig] = useState<Config | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [loaded, setLoaded] = useState(false)

  // Latest state for the interval callback.
  const ref = useRef({ timer, sessions, breaks })
  ref.current = { timer, sessions, breaks }

  const loadTasks = useCallback(async () => {
    const r = await window.api.listDoingTasks()
    setTasks(r.tasks)
    setWeekKey(r.weekKey)
    setTasksError(r.error ?? '')
  }, [])

  useEffect(() => {
    ;(async () => {
      const saved = await window.api.loadState()
      if (saved) {
        setTimer({ ...initialTimer, ...saved.timer })
        setSessions(saved.sessions ?? [])
        setBreaks(saved.breaks ?? [])
      }
      setConfig(await window.api.getConfig())
      await loadTasks()
      setLoaded(true)
    })()
  }, [loadTasks])

  useEffect(() => {
    if (!loaded) return
    const s: PersistedState = { timer, sessions, breaks }
    const id = setTimeout(() => window.api.saveState(s), 120)
    return () => clearTimeout(id)
  }, [timer, sessions, breaks, loaded])

  const syncLog = useCallback(async (ts: number) => {
    // Give the debounced state save time to land before main reads it.
    await window.api.saveState(ref.current as PersistedState)
    const r = await window.api.syncDay(ts)
    setMessage(r.ok ? `已写入日志：${r.file}` : `写入日志失败：${r.error}`)
  }, [])

  const doStart = useCallback((t: TimerState): TimerState | null => {
    if (!t.task) {
      setMessage('请先选择一个任务')
      return null
    }
    if (!t.deliverable.trim()) {
      setMessage('请填写本次专注的交付物')
      return null
    }
    setMessage('')
    return startFocus(t, Date.now())
  }, [])

  const doStop = useCallback(() => {
    const t = Date.now()
    const cur = ref.current
    const { next, focusMs, startedAt } = stopFocus(cur.timer, t)
    const session: Session = {
      id: `${startedAt}`,
      task: cur.timer.task,
      deliverable: cur.timer.deliverable,
      done: cur.timer.stopAsDone,
      startedAt,
      endedAt: t,
      durationMs: focusMs
    }
    const nextSessions = [...cur.sessions, session]
    ref.current = { ...cur, timer: next, sessions: nextSessions }
    setSessions(nextSessions)
    setTimer(next)
    syncLog(startedAt)
  }, [syncLog])

  /** Ends the break (running or paused) and goes straight into the next focus. */
  const finishBreak = useCallback(
    (cur: TimerState) => {
      const { next: idle, rest } = endBreak(cur, Date.now())
      const started = doStart(idle)
      // Continue straight into the next focus; if that fails, release the lock.
      const next = started ?? { ...idle, taskLocked: false }
      const nextBreaks = rest ? [...ref.current.breaks, rest] : ref.current.breaks
      ref.current = { ...ref.current, timer: next, breaks: nextBreaks }
      setTimer(next)
      if (rest) {
        setBreaks(nextBreaks)
        syncLog(rest.startedAt)
      }
    },
    [doStart, syncLog]
  )

  useEffect(() => {
    const id = setInterval(() => {
      const t = Date.now()
      setNow(t)
      const cur = ref.current.timer
      if (cur.phase === 'break' && cur.breakDurationMs > 0 && elapsedMs(cur, t) >= cur.breakDurationMs) {
        ding()
        finishBreak(cur)
      }
    }, 250)
    return () => clearInterval(id)
  }, [finishBreak])

  const active = activePhase(timer)
  const elapsed = elapsedMs(timer, now)
  const display = active === 'break' ? Math.max(0, timer.breakDurationMs - elapsed) : elapsed
  const todayMs = useMemo(
    () =>
      sessions.filter((s) => sameDay(s.startedAt, now)).reduce((a, s) => a + s.durationMs, 0) +
      (active === 'focus' ? elapsed : 0),
    [sessions, now, active, elapsed]
  )
  const todayBreakMs = useMemo(
    () => breaks.filter((b) => sameDay(b.startedAt, now)).reduce((a, b) => a + b.durationMs, 0) + breakRestedMs(timer, now),
    [breaks, now, timer]
  )
  const todayTotals = useMemo(() => {
    const m = new Map<string, number>()
    for (const s of sessions) if (sameDay(s.startedAt, now)) m.set(s.task, (m.get(s.task) ?? 0) + s.durationMs)
    if (active === 'focus' && timer.task) m.set(timer.task, (m.get(timer.task) ?? 0) + elapsed)
    return [...m].map(([task, ms]) => ({ task, ms })).sort((a, b) => b.ms - a.ms)
  }, [sessions, now, active, elapsed, timer.task])
  const label = timer.phase === 'paused' ? (active === 'break' ? '休息 · 已暂停' : '专注 · 已暂停') : active === 'break' ? '休息' : '专注'
  const locked = active === 'focus'

  const selectTask = (name: string) => setTimer((t) => ({ ...t, task: name }))
  const pick = tasks.find((t) => t.name === timer.task)

  return (
    <div className={`app phase-${active ?? 'idle'}`}>
      <header className="titlebar">
        <span className="brand">Dynamic Timer</span>
        <span className="chip">{weekKey || '—'}</span>
        <button className="ghost" onClick={() => setShowSettings((v) => !v)}>设置</button>
      </header>

      <main>
        <section className="panel tasks">
          <div className="panel-head">
            <h2>进行中任务</h2>
            <button className="ghost" onClick={loadTasks} disabled={active === 'focus'}>刷新</button>
          </div>
          {tasksError && <p className="error">无法读取任务：{tasksError}</p>}
          {!tasksError && tasks.length === 0 && <p className="muted">没有状态为 “1 - Doing” 的任务。</p>}
          <ul className="task-list">
            {tasks.map((t) => (
              <li key={t.path}>
                <button
                  className={`task ${t.name === timer.task ? 'selected' : ''}`}
                  disabled={locked}
                  onClick={() => selectTask(t.name)}
                >
                  <span className="task-name">{t.name}</span>
                  <span className="task-meta">
                    {t.priority.replace(/^\d - /, '') || '—'}{t.dueDate ? ` · 截止 ${t.dueDate.slice(5)}` : ''}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel focus">
          <div className="label">{label}</div>
          <div className="clock">{formatClock(display)}</div>
          <div className="sub">
            {timer.phase === 'idle' && '准备开始'}
            {active === 'focus' && (timer.phase === 'paused' ? '已暂停' : '正计时')}
            {active === 'break' && (timer.phase === 'paused' ? '已暂停' : '倒计时 · 结束后自动开始下一轮专注')}
          </div>

          <div className="brief">
            <div className="brief-task">{(pick?.name ?? timer.task) ||'从左侧选择一个任务'}</div>
            <input
              placeholder="本次专注的交付物…"
              value={timer.deliverable}
              disabled={locked}
              onChange={(e) => setTimer((t) => ({ ...t, deliverable: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && active === 'idle') {
                  const s = doStart(timer)
                  if (s) setTimer(s)
                }
              }}
            />
          </div>

          <div className="controls">
            <button
              className="primary"
              onClick={() => {
                if (active === 'focus') doStop()
                else if (active === 'break') finishBreak(ref.current.timer)
                else if (active === 'idle') {
                  const s = doStart(timer)
                  if (s) setTimer(s)
                }
              }}
            >
              {active === 'focus' ? '结束专注' : active === 'break' ? '结束休息 · 开始专注' : '开始专注'}
            </button>
            <button disabled={timer.phase === 'idle'} onClick={() => setTimer((t) => pauseResume(t, Date.now()))}>
              {timer.phase === 'paused' ? '继续' : '暂停'}
            </button>
            <button
              className={timer.stopAsDone ? 'done on' : 'done'}
              disabled={active !== 'focus'}
              onClick={() => setTimer((t) => ({ ...t, stopAsDone: !t.stopAsDone }))}
            >
              {timer.stopAsDone ? '交付物已完成 ✅' : '交付物未完成 ⏳'}
            </button>
          </div>
          {message && <p className="message">{message}</p>}
        </section>

        <section className="panel today">
          <div className="panel-head">
            <h2>今日</h2>
            <span className="chip" title="专注">{formatClock(todayMs)}</span>
          </div>
          <div className="row rest-total">
            <span className="muted">休息累计（不含暂停）</span>
            <span>{formatClock(todayBreakMs)}</span>
          </div>
          {todayTotals.length === 0 && <p className="muted">还没有记录。</p>}
          <ul className="history">
            {todayTotals.map((t) => (
              <li key={t.task}>
                <div className="row">
                  <span className="task-name">{t.task}</span>
                  <span>{formatClock(t.ms)}</span>
                </div>
              </li>
            ))}
          </ul>
          <button className="ghost" onClick={() => syncLog(Date.now())}>重新写入今日日志</button>
        </section>
      </main>

      {showSettings && config && (
        <div className="settings">
          {(['vaultPath', 'tasksDir', 'logsDir'] as const).map((k) => (
            <label key={k}>
              {k === 'vaultPath' ? 'Vault 路径' : k === 'tasksDir' ? '任务目录' : '日志目录'}
              <input value={config[k]} onChange={(e) => setConfig({ ...config, [k]: e.target.value })} />
            </label>
          ))}
          <button
            onClick={async () => {
              setConfig(await window.api.setConfig(config))
              await loadTasks()
              setShowSettings(false)
            }}
          >
            保存并刷新
          </button>
        </div>
      )}
    </div>
  )
}
