import type { BreakRecord, TimerState } from '../shared/types'

export const initialTimer: TimerState = {
  phase: 'idle',
  phaseBeforePause: null,
  phaseStartedAt: null,
  phaseBaseElapsedMs: 0,
  focusStartedAt: null,
  breakStartedAt: null,
  breakDurationMs: 0,
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

/** Break is one third of the focus time, at least one second. */
export function breakTargetMs(focusMs: number): number {
  return Math.max(1000, Math.floor(Math.floor(focusMs / 1000) / 3) * 1000)
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

/** Ends focus and starts the break; the caller records the session. */
export function stopFocus(s: TimerState, now: number): { next: TimerState; focusMs: number; startedAt: number } {
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
      breakDurationMs: breakTargetMs(focusMs),
      taskLocked: !s.stopAsDone,
      stopAsDone: false
    }
  }
}

/** Rest actually taken so far in the current break: pauses excluded, capped at the break target. */
export function breakRestedMs(s: TimerState, now: number): number {
  if (activePhase(s) !== 'break') return 0
  return Math.min(elapsedMs(s, now), s.breakDurationMs)
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
    next: { ...s, phase: 'idle', phaseBeforePause: null, phaseStartedAt: null, phaseBaseElapsedMs: 0, breakStartedAt: null, breakDurationMs: 0 }
  }
}
