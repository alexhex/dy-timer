import type { BreakRecord, Session } from '../shared/types'
import { dayHeading, fmtMinutes } from './week'

export const BLOCK_START = '<!-- dy-timer:start -->'
export const BLOCK_END = '<!-- dy-timer:end -->'
/** Tasks with less than this total for the day stay out of the log. */
export const MIN_LOGGED_MS = 60_000

export function newLogFile(weekKey: string, firstDay: Date): string {
  return `---
type: log
tags: weekly-log
---

## 本周到期任务

\`\`\`dataview
LIST  
WHERE dateformat(alert_date, "kkkk-WW")  
= dateformat(date("${ymd(firstDay)}"), "kkkk-WW")
AND !contains(status, "6 - Done")
\`\`\`
`
}

function ymd(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** One line per task with its accumulated time for the day, longest first. */
export function totalsByTask(sessions: Session[]): { task: string; ms: number }[] {
  const m = new Map<string, number>()
  for (const s of sessions) m.set(s.task, (m.get(s.task) ?? 0) + s.durationMs)
  return [...m].map(([task, ms]) => ({ task, ms })).sort((a, b) => b.ms - a.ms)
}

export function renderBlock(totals: { task: string; ms: number }[], breakMs = 0): string {
  const sum = totals.reduce((n, t) => n + t.ms, 0)
  const lines = totals.map((t) => `- [[${t.task}]] — ${fmtMinutes(t.ms)}`)
  const head = [`**专注合计 ${fmtMinutes(sum)}**`]
  if (breakMs >= MIN_LOGGED_MS) head.push(`**休息合计 ${fmtMinutes(breakMs)}**`)
  return [BLOCK_START, head.join(' · '), ...lines, BLOCK_END].join('\n')
}

/**
 * Put `sessions` and `breaks` (all belonging to `day`) into the weekly log as a managed block
 * at the end of that day's `## dd-Mmm-yyyy` section. Text outside the block is untouched.
 */
export function upsertDayBlock(content: string, day: Date, sessions: Session[], breaks: BreakRecord[] = []): string {
  const eol = content.includes('\r\n') ? '\r\n' : '\n'
  const lines = content.replace(/\r\n/g, '\n').split('\n')
  const heading = `## ${dayHeading(day)}`
  const logged = totalsByTask(sessions).filter((t) => t.ms >= MIN_LOGGED_MS)
  const breakMs = breaks.reduce((n, b) => n + b.durationMs, 0)
  const block = logged.length ? renderBlock(logged, breakMs).split('\n') : []

  const h = lines.findIndex((l) => l.trim() === heading)
  if (h === -1) {
    if (!block.length) return content
    while (lines.length && lines[lines.length - 1].trim() === '') lines.pop()
    lines.push('', heading, '', ...block, '')
    return lines.join('\n').replace(/\n/g, eol)
  }

  let end = lines.findIndex((l, i) => i > h && /^## /.test(l))
  if (end === -1) end = lines.length

  const bs = lines.findIndex((l, i) => i > h && i < end && l.trim() === BLOCK_START)
  const be = bs === -1 ? -1 : lines.findIndex((l, i) => i > bs && i < end && l.trim() === BLOCK_END)
  if (bs !== -1 && be !== -1) {
    lines.splice(bs, be - bs + 1, ...block)
  } else if (block.length) {
    let at = end
    while (at > h + 1 && lines[at - 1].trim() === '') at--
    lines.splice(at, 0, '', ...block)
  }
  return lines.join('\n').replace(/\n/g, eol)
}
