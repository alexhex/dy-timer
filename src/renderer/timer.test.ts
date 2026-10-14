import { describe, expect, it } from 'vitest'
import { endBreak, initialTimer, pauseResume, reachesBreakTarget, startFocus, stopFocus } from './timer'

describe('break accounting', () => {
  const t0 = 1_000_000
  const focus = startFocus({ ...initialTimer, task: 'T', deliverable: 'd' }, t0)

  it('records rest time without paused time', () => {
    // 30 min focus → 10 min break target
    const { next: brk } = stopFocus(focus, t0 + 30 * 60_000)
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
    const { next: brk } = stopFocus(focus, b0) // 10 min target
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
    const { next: brk } = stopFocus(focus, b0)
    let s = pauseResume({ ...brk }, b0 + 12 * 60_000)
    expect(reachesBreakTarget(s, b0 + 60 * 60_000)).toBe(false)
    s = pauseResume(s, b0 + 60 * 60_000)
    expect(endBreak(s, b0 + 63 * 60_000).rest?.durationMs).toBe(15 * 60_000)
    expect(endBreak(focus, t0 + 5_000).rest).toBeNull()
  })
})
