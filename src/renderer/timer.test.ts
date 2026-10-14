import { describe, expect, it } from 'vitest'
import { endBreak, initialTimer, pauseResume, startFocus, stopFocus } from './timer'

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

  it('caps rest at the break target and ignores non-break phases', () => {
    const { next: brk } = stopFocus(focus, t0 + 30 * 60_000)
    expect(endBreak(brk, t0 + 60 * 60_000).rest?.durationMs).toBe(10 * 60_000)
    expect(endBreak(focus, t0 + 5_000).rest).toBeNull()
  })
})
