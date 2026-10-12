import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { parse } from 'yaml'
import type { Config, Session, WeekTask } from '../shared/types'
import { newLogFile, upsertDayBlock } from './log'
import { isoWeekKey } from './week'

export function parseFrontmatter(src: string): Record<string, unknown> {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(src)
  if (!m) return {}
  try {
    const v = parse(m[1], { schema: 'core' })
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

const asText = (v: unknown): string =>
  Array.isArray(v) ? v.filter(Boolean).join(', ') : v == null ? '' : String(v)

/**
 * Tasks whose status is "1 - Doing". A status listing several values at once
 * is a template (e.g. Task Example.md enumerating every option), not a real task.
 */
export function isDoing(fm: Record<string, unknown>): boolean {
  const st = Array.isArray(fm.status) ? fm.status : [fm.status]
  return st.length === 1 && String(st[0] ?? '').includes('1 - Doing')
}

export async function listDoingTasks(cfg: Config, now = new Date()) {
  const weekKey = isoWeekKey(now)
  const dir = join(cfg.vaultPath, cfg.tasksDir)
  const files = (await readdir(dir)).filter((f) => f.endsWith('.md'))
  const tasks: WeekTask[] = []
  await Promise.all(
    files.map(async (f) => {
      const fm = parseFrontmatter(await readFile(join(dir, f), 'utf8'))
      if (!isDoing(fm)) return
      tasks.push({
        name: f.slice(0, -3),
        path: join(dir, f),
        status: asText(fm.status),
        priority: asText(fm.priority),
        alertDate: asText(fm.alert_date).slice(0, 10),
        dueDate: asText(fm.due_date).slice(0, 10)
      })
    })
  )
  tasks.sort((a, b) => a.priority.localeCompare(b.priority) || a.name.localeCompare(b.name))
  return { weekKey, tasks }
}

export async function syncDay(cfg: Config, all: Session[], ts: number): Promise<string> {
  const day = new Date(ts)
  const key = (t: number) => new Date(t).toDateString()
  const sessions = all.filter((s) => key(s.startedAt) === key(ts))
  const dir = join(cfg.vaultPath, cfg.logsDir)
  const file = join(dir, `${isoWeekKey(day)}.md`)
  let content: string
  try {
    content = await readFile(file, 'utf8')
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e
    await mkdir(dir, { recursive: true })
    content = newLogFile(isoWeekKey(day), day)
  }
  const next = upsertDayBlock(content, day, sessions)
  if (next !== content) await writeFile(file, next, 'utf8')
  return file
}
