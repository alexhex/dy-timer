# Dynamic Timer

Focus timer wired to an Obsidian vault.

- Pick a task from the **in-progress tasks**: notes in `40_Tasks/` whose `status` frontmatter includes `1 - Doing`.
- Focus counts **up**; stopping starts a **count-down break of focus time × a ratio** (设置 → 「休息时长 = 专注时长 × 系数」, default 0.25, i.e. 40 min focus → 10 min break), when it reaches zero a chime plays and the break **keeps counting up** (still accumulating rest time) until you press **开始专注**. The next focus never starts on its own; task and deliverable can be changed throughout the break. During the count-down the main button reads **结束休息 · 开始专注** and ends the break early.
- On every stop, the per-task total time for the day is written to `70_Logs/<YYYY-Www>.md` under that day's `## dd-Mmm-yyyy` heading, inside a managed `<!-- dy-timer:start/end -->` block (text outside it is never touched). Tasks with under 1 minute total that day are not logged. Under each task, the day's **deliverables** are listed as indented bullets (✅ finished / ⏳ not yet, with time spent), in the order worked on; the same deliverable text across several sessions is merged. The block also carries the day's total break time (`**休息合计**`), counting only time actually spent resting — paused time is excluded, overtime after the count-down is included, and a break ended early counts only up to that point.
- **Sleep, screen lock and closing the app never count as focus or rest.** When the computer goes to sleep or the screen locks, a running timer is paused at that moment; if sleep is missed (a gap of over a minute between clock ticks) it is paused at the last tick. If the app was closed while the timer was running, on the next start it is paused at the last moment it was seen running (saved every 15 s). Press **继续** to carry on, or **结束专注** to log what was counted.
- **📌 迷你置顶** (title bar) shrinks the window to a small card showing only the clock and the current task, floating above all other windows (on macOS also over full-screen apps). Drag it anywhere; press **⤢** to restore the full window at its previous size and position. The mini card reopens where you last left it.

Stack: Electron + electron-vite + React + TypeScript.

```bash
npm install
npm run dev        # development
npm test           # log/week parsing tests
npm run dist:mac   # build dmg
npm run dist:win   # build Windows installer (run on Windows)
```

See [INSTALL.md](INSTALL.md) for step-by-step setup on macOS and Windows 11.

Vault paths default to `/Users/neil/own_kits/mac-notes-obsidian` and can be changed under 设置. The previous Notion-based version is in `_legacy/`.
