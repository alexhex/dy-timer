# Dynamic Timer

Focus timer wired to an Obsidian vault.

- Pick a task from the **in-progress tasks**: notes in `40_Tasks/` whose `status` frontmatter includes `1 - Doing`.
- Focus counts **up**; stopping starts a **count-down break of 1/3 the focus time**, when it reaches zero a chime plays and the break **keeps counting up** (still accumulating rest time) until you press **开始专注**. The next focus never starts on its own; task and deliverable can be changed throughout the break. During the count-down the main button reads **结束休息 · 开始专注** and ends the break early.
- On every stop, the per-task total time for the day is written to `70_Logs/<YYYY-Www>.md` under that day's `## dd-Mmm-yyyy` heading, inside a managed `<!-- dy-timer:start/end -->` block (text outside it is never touched). Tasks with under 1 minute total that day are not logged. The block also carries the day's total break time (`**休息合计**`), counting only time actually spent resting — paused time is excluded, overtime after the count-down is included, and a break ended early counts only up to that point.

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
