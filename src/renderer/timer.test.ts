import { describe, expect, it } from 'vitest'
import { breakTargetMs, elapsedMs, endBreak, initialTimer, pauseAt, pauseResume, reachesBreakTarget, startFocus, stopFocus } from './timer'

describe('break accounting', () => {
  const t0 = 1_000_000
  const focus = startFocus({ ...initialTimer, task: 'T', deliverable: 'd' }, t0)

  it('records rest time without paused time', () => {
    const { next: brk } = stopFocus(focus, t0 + 30 * 60_000, 1 / 3)
    const b0 = t0 + 30 * 60_000
    let s = pauseResume(brk, b0 + 3 * 60_000) // rest 3 min, then pause
    s = pauseResume(s, b0 + 120 * 60_000) // 2h lunch pause
    const { rest, next } = endBreak(s, b0 + 122 * 60_000) // 2 more min
    expect(rest).toEqual({ startedAt: b0, endedAt: b0 + 122 * 60_000, durationMs: 5 * 60_000 })
    expect(next.phase).toBe('idle')
    expect(next.breakStartedAt).toBeNull()
  })

  it('keeps counting rest after the target until focus starts by hand', () => {
    const b0 = t0 + 30 * 60_000
    const { next: brk } = stopFocus(focus, b0, 1 / 3) // 10 min target
    expect(reachesBreakTarget(brk, b0 + 9 * 60_000)).toBe(false)
    expect(reachesBreakTarget(brk, b0 + 10 * 60_000)).toBe(true)
    const over = { ...brk, breakOvertime: true }
    expect(reachesBreakTarget(over, b0 + 11 * 60_000)).toBe(false) // chime only once
    expect(over.phase).toBe('break')
    // still a break; changing task/deliverable doesn't disturb it
    const edited = { ...over, task: 'U', deliverable: 'e' }
    const { rest, next } = endBreak(edited, b0 + 25 * 60_000)
    expect(rest?.durationMs).toBe(25 * 60_000)
    expect(next.breakOvertime).toBe(false)
    expect(startFocus(next, b0 + 25 * 60_000).task).toBe('U')
  })

  it('pause during overtime is not counted, and non-break phases record nothing', () => {
    const b0 = t0 + 30 * 60_000
    const { next: brk } = stopFocus(focus, b0, 1 / 3)
    let s = pauseResume({ ...brk }, b0 + 12 * 60_000)
    expect(reachesBreakTarget(s, b0 + 60 * 60_000)).toBe(false)
    s = pauseResume(s, b0 + 60 * 60_000)
    expect(endBreak(s, b0 + 63 * 60_000).rest?.durationMs).toBe(15 * 60_000)
    expect(endBreak(focus, t0 + 5_000).rest).toBeNull()
  })

  it('break target is focus × ratio, default 0.25', () => {
    expect(breakTargetMs(40 * 60_000)).toBe(10 * 60_000)
    expect(stopFocus(focus, t0 + 40 * 60_000).next.breakDurationMs).toBe(10 * 60_000)
    expect(breakTargetMs(40 * 60_000, 0.5)).toBe(20 * 60_000)
    expect(breakTargetMs(30 * 60_000, 0.1)).toBe(3 * 60_000)
    expect(breakTargetMs(30 * 60_000, 0)).toBe(7.5 * 60_000) // invalid → default
    expect(breakTargetMs(1_000, 0.25)).toBe(1000) // at least one second
  })

  it('auto-pause stops counting at the given moment and leaves idle / paused timers alone', () => {
    // focus ran 40 min, then the laptop slept for the night
    const slept = pauseAt(focus, t0 + 40 * 60_000)
    expect(slept.phase).toBe('paused')
    expect(elapsedMs(slept, t0 + 10 * 3600_000)).toBe(40 * 60_000)
    expect(stopFocus(slept, t0 + 10 * 3600_000).focusMs).toBe(40 * 60_000)
    // resuming continues from 40 min
    expect(elapsedMs(pauseResume(slept, t0 + 10 * 3600_000), t0 + 10 * 3600_000 + 60_000)).toBe(41 * 60_000)
    // already paused: the first pause point wins
    expect(pauseAt(slept, t0 + 50 * 60_000)).toBe(slept)
    expect(pauseAt(initialTimer, t0)).toBe(initialTimer)
    // a moment before the phase started never yields negative time
    expect(elapsedMs(pauseAt(focus, t0 - 5_000), t0 + 60_000)).toBe(0)
    // works for breaks too: rest stops accruing while asleep
    const { next: brk } = stopFocus(focus, t0 + 40 * 60_000)
    const brkSlept = pauseAt(brk, t0 + 45 * 60_000)
    expect(endBreak(brkSlept, t0 + 10 * 3600_000).rest?.durationMs).toBe(5 * 60_000)
  })
})
