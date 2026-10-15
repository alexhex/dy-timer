import type { BreakRecord, TimerState } from '../shared/types'

export const initialTimer: TimerState = {
  phase: 'idle',
  phaseBeforePause: null,
  phaseStartedAt: null,
  phaseBaseElapsedMs: 0,
  focusStartedAt: null,
  breakStartedAt: null,
  breakDurationMs: 0,
  breakOvertime: false,
  lastFocusDurationMs: 0,
  task: '',
  deliverable: '',
  taskLocked: false,
  stopAsDone: false
}

export const activePhase = (s: TimerState) => (s.phase === 'paused' ? s.phaseBeforePause : s.phase)

export function elapsedMs(s: TimerState, now: number): number {
  if (s.phase === 'idle') return 0
  if (s.phase === 'paused') return s.phaseBaseElapsedMs
  return s.phaseBaseElapsedMs + Math.max(0, now - (s.phaseStartedAt ?? now))
}

export const DEFAULT_BREAK_RATIO = 0.25

/** Break target = focus time × ratio, whole seconds, at least one second. */
export function breakTargetMs(focusMs: number, ratio = DEFAULT_BREAK_RATIO): number {
  const r = Number.isFinite(ratio) && ratio > 0 ? ratio : DEFAULT_BREAK_RATIO
  return Math.max(1000, Math.floor((Math.floor(focusMs / 1000) * r) + 1e-9) * 1000)
}

export function formatClock(ms: number): string {
  const t = Math.max(0, Math.floor(ms / 1000))
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(Math.floor(t / 3600))}:${p(Math.floor((t % 3600) / 60))}:${p(t % 60)}`
}

export function startFocus(s: TimerState, now: number): TimerState {
  return { ...s, phase: 'focus', phaseBeforePause: null, phaseStartedAt: now, phaseBaseElapsedMs: 0, focusStartedAt: now, stopAsDone: false }
}

export function pauseResume(s: TimerState, now: number): TimerState {
  if (s.phase === 'idle') return s
  if (s.phase === 'paused') return { ...s, phase: s.phaseBeforePause!, phaseBeforePause: null, phaseStartedAt: now }
  return { ...s, phaseBaseElapsedMs: elapsedMs(s, now), phaseBeforePause: s.phase, phase: 'paused', phaseStartedAt: null }
}

/** Ticks further apart than this mean the machine slept, or the app was closed, in between. */
export const SLEEP_GAP_MS = 60_000

export const isRunning = (s: TimerState) => s.phase === 'focus' || s.phase === 'break'

/**
 * Pause a running timer as of `at` (when the machine went to sleep, the screen locked or the app
 * was last seen running), so that time is not counted. Idle or already-paused timers are unchanged.
 */
export function pauseAt(s: TimerState, at: number): TimerState {
  if (!isRunning(s)) return s
  return pauseResume(s, Math.max(at, s.phaseStartedAt ?? at))
}

/** Ends focus and starts the break; the caller records the session. */
export function stopFocus(s: TimerState, now: number, breakRatio = DEFAULT_BREAK_RATIO): { next: TimerState; focusMs: number; startedAt: number } {
  const focusMs = elapsedMs(s, now)
  const startedAt = s.focusStartedAt ?? now - focusMs
  return {
    focusMs,
    startedAt,
    next: {
      ...s,
      phase: 'break',
      phaseBeforePause: null,
      phaseStartedAt: now,
      phaseBaseElapsedMs: 0,
      focusStartedAt: null,
      breakStartedAt: now,
      lastFocusDurationMs: focusMs,
      breakDurationMs: breakTargetMs(focusMs, breakRatio),
      breakOvertime: false,
      taskLocked: !s.stopAsDone,
      stopAsDone: false
    }
  }
}

/** Rest taken so far in the current break, overtime included, pauses excluded. */
export function breakRestedMs(s: TimerState, now: number): number {
  return activePhase(s) === 'break' ? elapsedMs(s, now) : 0
}

/** True once a running break first reaches its target (the caller chimes and stores the flag). */
export function reachesBreakTarget(s: TimerState, now: number): boolean {
  return s.phase === 'break' && !s.breakOvertime && s.breakDurationMs > 0 && elapsedMs(s, now) >= s.breakDurationMs
}

/** Ends the break; returns the record of the rest taken (null if there was no break running). */
export function endBreak(s: TimerState, now: number): { next: TimerState; rest: BreakRecord | null } {
  const durationMs = breakRestedMs(s, now)
  const rest =
    activePhase(s) === 'break' && durationMs > 0
      ? { startedAt: s.breakStartedAt ?? now - durationMs, endedAt: now, durationMs }
      : null
  return {
    rest,
    next: { ...s, phase: 'idle', phaseBeforePause: null, phaseStartedAt: null, phaseBaseElapsedMs: 0, breakStartedAt: null, breakDurationMs: 0, breakOvertime: false }
  }
}
