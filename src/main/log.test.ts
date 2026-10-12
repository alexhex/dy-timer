import { describe, expect, it } from 'vitest'
import { upsertDayBlock, BLOCK_START } from './log'
import { isoWeekKey, dayHeading } from './week'
import { isThisWeekOpen } from './vault'
import type { Session } from '../shared/types'

const at = (h: number, m: number) => new Date(2026, 9, 12, h, m).getTime()
const s = (id: string, a: number, b: number, task = 'VE Workshop'): Session => ({
  id, task, deliverable: 'draft', done: id === '1', startedAt: a, endedAt: b, durationMs: b - a
})

describe('week helpers', () => {
  it('matches the vault naming', () => {
    expect(isoWeekKey(new Date(2026, 9, 12))).toBe('2026-W42')
    expect(isoWeekKey(new Date(2026, 0, 1))).toBe('2026-W01')
    expect(isoWeekKey(new Date(2027, 0, 1))).toBe('2026-W53')
    expect(dayHeading(new Date(2026, 9, 12))).toBe('12-Oct-2026')
  })
})

describe('upsertDayBlock', () => {
  const day = new Date(2026, 9, 12)
  const base = '# x\n\n## 12-Oct-2026\n\n1. a\n- [ ] b\n\n## 13-Oct-2026\n\nlater\n'

  it('appends inside the day section and keeps other text', () => {
    const out = upsertDayBlock(base, day, [s('1', at(9, 0), at(9, 35))])
    expect(out).toContain('- [ ] b\n\n' + BLOCK_START)
    expect(out).toContain('- [[VE Workshop]] — 35m')
    expect(out.indexOf(BLOCK_START)).toBeLessThan(out.indexOf('## 13-Oct-2026'))
    expect(out).toContain('later')
  })

  it('is idempotent and replaces the block on re-sync', () => {
    const one = upsertDayBlock(base, day, [s('1', at(9, 0), at(9, 35))])
    expect(upsertDayBlock(one, day, [s('1', at(9, 0), at(9, 35))])).toBe(one)
    const two = upsertDayBlock(one, day, [s('1', at(9, 0), at(9, 35)), s('2', at(10, 0), at(10, 25), 'Other')])
    expect(two.match(/dy-timer:start/g)).toHaveLength(1)
    expect(two).toContain('**专注合计 1h**')
    expect(two).toContain('- [[Other]] — 25m')
    const three = upsertDayBlock(two, day, [s('1', at(9, 0), at(9, 35)), s('3', at(11, 0), at(11, 10))])
    expect(three).toContain('- [[VE Workshop]] — 45m')
  })

  it('creates the day section when missing and skips tiny sessions', () => {
    const out = upsertDayBlock('# x\n', day, [s('1', at(9, 0), at(9, 35))])
    expect(out).toContain('## 12-Oct-2026')
    expect(upsertDayBlock('# x\n', day, [s('2', at(9, 0), at(9, 0) + 20_000)])).toBe('# x\n')
  })
})

describe('isThisWeekOpen', () => {
  it('follows the dataview rule', () => {
    expect(isThisWeekOpen({ alert_date: '2026-10-13', status: ['1 - Doing'] }, '2026-W42')).toBe(true)
    expect(isThisWeekOpen({ alert_date: '2026-10-13', status: ['6 - Done'] }, '2026-W42')).toBe(false)
    expect(isThisWeekOpen({ alert_date: '2026-10-19' }, '2026-W42')).toBe(false)
    expect(isThisWeekOpen({}, '2026-W42')).toBe(false)
  })
})
