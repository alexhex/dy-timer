import { describe, expect, it } from 'vitest'
import { upsertDayBlock, BLOCK_START } from './log'
import { isoWeekKey, dayHeading } from './week'
import { isDoing } from './vault'
import type { Session } from '../shared/types'

const at = (h: number, m: number) => new Date(2026, 9, 12, h, m).getTime()
const s = (id: string, a: number, b: number, task = 'VE Workshop', deliverable = 'draft', done = id === '1'): Session => ({
  id, task, deliverable, done, startedAt: a, endedAt: b, durationMs: b - a
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

  it('adds the day break total (pauses already excluded) when at least a minute', () => {
    const b = (a: number, ms: number) => ({ startedAt: a, endedAt: a + ms, durationMs: ms })
    const sess = [s('1', at(9, 0), at(9, 35))]
    const out = upsertDayBlock(base, day, sess, [b(at(9, 35), 11 * 60_000), b(at(10, 30), 4 * 60_000)])
    expect(out).toContain('**专注合计 35m** · **休息合计 15m**')
    expect(upsertDayBlock(base, day, sess, [b(at(9, 35), 20_000)])).not.toContain('休息合计')
    expect(upsertDayBlock(out, day, sess)).not.toContain('休息合计')
  })

  it('lists each task\'s deliverables under it, merged by text, in the order worked on', () => {
    const sess = [
      s('a', at(9, 0), at(9, 30), 'VE Workshop', '写大纲', false),
      s('b', at(10, 0), at(10, 20), 'VE Workshop', '画流程图', true),
      s('c', at(11, 0), at(11, 15), 'VE Workshop', ' 写大纲 ', true),
      s('d', at(14, 0), at(14, 40), 'Other', 'review\nPR', false)
    ]
    const out = upsertDayBlock(base, day, sess)
    expect(out).toContain(
      [
        '- [[VE Workshop]] — 1h 5m',
        '\t- ✅ 写大纲 — 45m',
        '\t- ✅ 画流程图 — 20m',
        '- [[Other]] — 40m',
        '\t- ⏳ review PR — 40m'
      ].join('\n')
    )
    expect(upsertDayBlock(out, day, sess)).toBe(out)
  })

  it('creates the day section when missing and skips tiny sessions', () => {
    const out = upsertDayBlock('# x\n', day, [s('1', at(9, 0), at(9, 35))])
    expect(out).toContain('## 12-Oct-2026')
    expect(upsertDayBlock('# x\n', day, [s('2', at(9, 0), at(9, 0) + 20_000)])).toBe('# x\n')
  })
})

describe('isDoing', () => {
  it('matches status 1 - Doing only', () => {
    expect(isDoing({ status: ['1 - Doing'] })).toBe(true)
    expect(isDoing({ status: '1 - Doing' })).toBe(true)
    expect(isDoing({ status: ['1 - Doing', '2 - To Do'] })).toBe(false)
    expect(isDoing({ status: ['2 - To Do'] })).toBe(false)
    expect(isDoing({ status: ['6 - Done'] })).toBe(false)
    expect(isDoing({})).toBe(false)
  })
})
