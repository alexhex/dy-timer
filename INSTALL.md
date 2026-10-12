# 安装指南

本应用从 Obsidian vault 里读取「本周任务」，并把每天每个任务的累计专注时间写回周日志。
可以直接运行源码（推荐，所有平台一致），也可以自己打包成安装包。

## 前置条件（两个平台通用）

| 项目 | 要求 |
| --- | --- |
| Node.js | 20.19 或更新（推荐 22 LTS） |
| Git | 任意较新版本 |
| Obsidian vault | 需要有任务目录和日志目录，见下方「vault 结构」 |

### vault 结构

- **任务目录**（默认 `40_Tasks`）：每个任务一个 `.md`，frontmatter 里要有 `alert_date`（如 `2026-10-13`）和 `status`。
  本周任务 = `alert_date` 落在当前 ISO 周，且 `status` 不含 `6 - Done`。
- **日志目录**（默认 `70_Logs`）：周日志文件名为 `2026-W42.md` 这种 ISO 周格式，文件不存在时会自动创建。
- 写入位置：日志里对应日期的 `## 12-Oct-2026` 小节末尾，位于 `<!-- dy-timer:start -->` 和 `<!-- dy-timer:end -->` 之间；这两行之外的内容不会被改动。

---

## macOS

### 1. 安装 Node.js 和 Git

用 Homebrew（没有的话先到 https://brew.sh 安装）：

```bash
brew install node git
node -v   # 应 >= 20.19
```

或者到 https://nodejs.org 下载 macOS 安装包。首次使用 git 时系统可能提示安装 Xcode 命令行工具，按提示安装即可。

### 2. 获取代码并安装依赖

```bash
git clone https://github.com/alexhex/dy-timer.git
cd dy-timer
npm install
```

### 3. 运行

```bash
npm run dev
```

第一次启动会弹出应用窗口。关掉窗口即退出。

### 4.（可选）打包成 .dmg

```bash
npm run dist:mac
```

产物在 `dist/` 目录。应用没有签名，首次打开请在 Finder 里**右键 → 打开**，或到「系统设置 → 隐私与安全性」点「仍要打开」。

### 5. 设置 vault 路径

默认路径是作者本机的 `/Users/neil/own_kits/mac-notes-obsidian`。
点击窗口右上角「设置」，把「Vault 路径」改成你自己的，例如 `/Users/你的用户名/Documents/MyVault`，再点「保存并刷新」。

> 提示：macOS 可能会在应用首次读写 `Documents`、`Desktop`、iCloud 等目录时弹出访问授权，请选择「允许」。

---

## Windows 11

以下命令都在 **PowerShell** 里执行（开始菜单搜索 PowerShell）。

### 1. 安装 Node.js 和 Git

用 winget（Windows 11 自带）：

```powershell
winget install OpenJS.NodeJS.LTS
winget install Git.Git
```

装完后**关闭并重新打开 PowerShell**，让环境变量生效，然后检查：

```powershell
node -v   # 应 >= 20.19
git --version
```

也可以手动到 https://nodejs.org 和 https://git-scm.com 下载安装包。

### 2. 获取代码并安装依赖

```powershell
git clone https://github.com/alexhex/dy-timer.git
cd dy-timer
npm install
```

### 3. 运行

```powershell
npm run dev
```

如果 PowerShell 提示 `npm.ps1 cannot be loaded because running scripts is disabled`，执行一次下面的命令后重试：

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

### 4.（可选）打包成安装程序

需要在 Windows 上执行：

```powershell
npm run dist:win
```

产物是 `dist\` 下的 `.exe` 安装程序（NSIS）。应用没有代码签名，SmartScreen 可能提示「Windows 已保护你的电脑」，点「更多信息 → 仍要运行」。

### 5. 设置 vault 路径

默认路径是 macOS 路径，在 Windows 上**必须修改**。
点击窗口右上角「设置」，填入你的 vault 路径，例如：

```
C:\Users\你的用户名\Documents\MyVault
```

任务目录、日志目录保持相对 vault 的名字即可（默认 `40_Tasks`、`70_Logs`），再点「保存并刷新」。
路径里的反斜杠不需要转义。

> 如果 vault 放在 OneDrive 里，请确保文件处于「始终保留在此设备上」状态，否则读写可能延迟。

---

## 常见问题

**启动时报 `Electron uninstall` / 找不到 Electron**
安装时 Electron 二进制没有下载成功（常见于网络问题或 npm 跳过了 postinstall）。在项目目录执行：

```bash
node node_modules/electron/install.js
```

如果下载很慢或失败，可以设置镜像后重试：

```bash
# macOS
ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ node node_modules/electron/install.js
```

```powershell
# Windows PowerShell
$env:ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"; node node_modules/electron/install.js
```

**`npm install` 报 peer dependency 冲突**
请使用仓库自带的 `package-lock.json`，不要手动升级 vite；`electron-vite` 目前要求 vite ≤ 7。

**本周任务列表是空的**
- 检查「设置」里的 vault 路径和任务目录是否正确；界面上若显示「无法读取任务」，后面会带具体错误。
- 确认任务笔记的 frontmatter 有 `alert_date: YYYY-MM-DD`，并且在本周内、状态不是 `6 - Done`。

**日志没有写入**
结束一轮专注时才会写入，且当天某个任务累计不足 1 分钟不会写入。窗口下方会显示写入的文件路径或错误信息；也可以点「今日」面板里的「重新写入今日日志」。

**应用数据位置**
计时状态和设置保存在系统的应用数据目录（macOS：`~/Library/Application Support/dy-timer`；Windows：`%APPDATA%\dy-timer`）。删除这个目录即可重置。
