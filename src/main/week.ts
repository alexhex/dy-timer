const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const pad = (n: number) => String(n).padStart(2, '0')

/** ISO week key such as "2026-W42" (matches dataview `kkkk-WW`). */
export function isoWeekKey(d: Date): string {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dow = t.getUTCDay() || 7
  t.setUTCDate(t.getUTCDate() + 4 - dow)
  const yearStart = Date.UTC(t.getUTCFullYear(), 0, 1)
  const week = Math.ceil(((t.getTime() - yearStart) / 86400000 + 1) / 7)
  return `${t.getUTCFullYear()}-W${pad(week)}`
}

/** "12-Oct-2026", the per-day heading used in the weekly logs. */
export function dayHeading(d: Date): string {
  return `${pad(d.getDate())}-${MONTHS[d.getMonth()]}-${d.getFullYear()}`
}

export function isoWeekKeyOfDateString(s: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  if (!m) return null
  return isoWeekKey(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
}

export function hhmm(ts: number): string {
  const d = new Date(ts)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function fmtMinutes(ms: number): string {
  const min = Math.max(1, Math.round(ms / 60000))
  const h = Math.floor(min / 60)
  const m = min % 60
  return h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`
}
