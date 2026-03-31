# Kage Setup Script -- Windows
# Sets up the Kage Agent Memory system in the current repository.
# Usage (from repo root): .\setup.ps1
# Or for a different repo: .\setup.ps1 -TargetRepo "C:\path\to\your\repo"

param(
    [string]$TargetRepo = (Get-Location).Path
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host ""
Write-Host "======================================"
Write-Host "  Kage Agent Memory -- Windows Setup"
Write-Host "======================================"
Write-Host ""

# ── 1. API Key ──────────────────────────────────────────────────────────────
$ApiKey = $env:ANTHROPIC_API_KEY
if (-not $ApiKey) {
    $ApiKey = Read-Host "Enter your Anthropic API key (sk-ant-...)"
    if (-not $ApiKey) {
        Write-Error "ANTHROPIC_API_KEY is required."
        exit 1
    }
}
Write-Host "API key: set"

# ── 2. Python ────────────────────────────────────────────────────────────────
$Python = (Get-Command python -ErrorAction SilentlyContinue)?.Source `
       ?? (Get-Command python3 -ErrorAction SilentlyContinue)?.Source
if (-not $Python) {
    Write-Error "Python is required. Install from https://python.org"
    exit 1
}
Write-Host "Python: $Python"

Write-Host "Installing Python dependencies..."
& $Python -m pip install -q -r "$ScriptDir\requirements.txt"
Write-Host "Dependencies: installed"

# ── 3. Scaffold .agent_memory ────────────────────────────────────────────────
Write-Host ""
Write-Host "Target repository: $TargetRepo"
$MemDir = "$TargetRepo\.agent_memory"
New-Item -ItemType Directory -Force -Path "$MemDir\nodes"   | Out-Null
New-Item -ItemType Directory -Force -Path "$MemDir\scripts" | Out-Null

# Copy scripts
Copy-Item "$ScriptDir\.agent_memory\scripts\distiller_tool.py"  "$MemDir\scripts\" -Force
Copy-Item "$ScriptDir\.agent_memory\scripts\distiller_hook.py"  "$MemDir\scripts\" -Force
Copy-Item "$ScriptDir\.agent_memory\scripts\session_watcher.py" "$MemDir\scripts\" -Force

# Create root index if missing
$IndexPath = "$MemDir\index.md"
if (-not (Test-Path $IndexPath)) {
    @"
# Agent Memory: Root Index

Welcome to the shared team brain. This directory contains curated, Stack Overflow-style knowledge relevant to this repository.
**Agents:** Read the relevant domain indexes below before suggesting architectural changes or interacting with APIs/Frameworks.

## Domains

"@ | Set-Content $IndexPath
    Write-Host "Created: .agent_memory\index.md"
}

# ── 4. CLAUDE.md ─────────────────────────────────────────────────────────────
$ClaudeMd = "$TargetRepo\CLAUDE.md"
$KageBlock = @"

## Kage Agent Memory

Before suggesting code changes or architectural decisions, read the memory index:
- [.agent_memory/index.md](.agent_memory/index.md) -- repo-specific context and rules

To save a new learning after a session:
``````bash
python .agent_memory\scripts\distiller_tool.py ``
  --title "Short Title" ``
  --category "architecture|framework_bug|repo_context|debugging" ``
  --tags "[`"tag1`", `"tag2`"]" ``
  --content "Markdown description of problem and solution." ``
  --paths "backend,frontend/api"
``````
"@

if (-not (Test-Path $ClaudeMd)) {
    $KageBlock | Set-Content $ClaudeMd
    Write-Host "Created: CLAUDE.md"
} elseif (-not (Select-String -Path $ClaudeMd -Pattern "Kage Agent Memory" -Quiet)) {
    $KageBlock | Add-Content $ClaudeMd
    Write-Host "Updated: CLAUDE.md (Kage block appended)"
} else {
    Write-Host "Skipped: CLAUDE.md already has Kage block"
}

# ── 5. .cursorrules ──────────────────────────────────────────────────────────
$CursorRules = "$TargetRepo\.cursorrules"
if (-not (Test-Path $CursorRules)) {
    @"
# Kage Agent Memory
You MUST read `.agent_memory/index.md` before suggesting any architectural changes
or assuming framework behaviors. Follow any structural warnings found in memory nodes exactly.
"@ | Set-Content $CursorRules
    Write-Host "Created: .cursorrules"
}

# ── 6. Git post-commit hook ──────────────────────────────────────────────────
$GitDir = "$TargetRepo\.git"
if (Test-Path $GitDir) {
    $HooksDir = "$GitDir\hooks"
    New-Item -ItemType Directory -Force -Path $HooksDir | Out-Null
    $HookFile = "$HooksDir\post-commit"
    @"
#!/bin/bash
export ANTHROPIC_API_KEY="$ApiKey"
REPO_DIR=`$(git rev-parse --show-toplevel)
nohup python3 "`$REPO_DIR/.agent_memory/scripts/distiller_hook.py" \
  > "`$REPO_DIR/.agent_memory/distiller.log" 2>&1 &
"@ | Set-Content $HookFile
    Write-Host "Installed: .git\hooks\post-commit"
}

# ── 7. Windows Startup Daemon (Task Scheduler) ───────────────────────────────
$WatcherPath = "$MemDir\scripts\session_watcher.py"
$LogPath     = "$MemDir\watcher.log"
$TaskName    = "KageSessionWatcher"

# Remove old task if exists
Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue

$Action = New-ScheduledTaskAction `
    -Execute $Python `
    -Argument "-u `"$WatcherPath`"" `
    -WorkingDirectory $TargetRepo

$Trigger = New-ScheduledTaskTrigger -AtLogOn

$Settings = New-ScheduledTaskSettingsSet `
    -ExecutionTimeLimit (New-TimeSpan -Hours 0) `
    -RestartCount 5 `
    -RestartInterval (New-TimeSpan -Minutes 1)

$Env = [System.Collections.Generic.List[object]]::new()
$Env.Add((New-ScheduledTaskPrincipal -UserId $env:USERNAME -RunLevel Highest))

# Set env var via registry for the task
$TaskEnv = New-Object Microsoft.Win32.RegistryKey
Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $Action `
    -Trigger $Trigger `
    -Settings $Settings `
    -RunLevel Highest `
    -Force | Out-Null

# Inject ANTHROPIC_API_KEY into the task's environment
$TaskXml = (Export-ScheduledTask -TaskName $TaskName)
$TaskXml = $TaskXml -replace '</Actions>', "<EnvironmentVariables><Variable><Name>ANTHROPIC_API_KEY</Name><Value>$ApiKey</Value></Variable></EnvironmentVariables></Actions>"
$TaskXml | Register-ScheduledTask -TaskName $TaskName -Force | Out-Null

# Start it now
Start-ScheduledTask -TaskName $TaskName
Write-Host "Started: $TaskName (Task Scheduler)"

# ── 8. .gitignore ─────────────────────────────────────────────────────────────
$GitIgnore = "$TargetRepo\.gitignore"
if (-not (Test-Path $GitIgnore)) { "" | Set-Content $GitIgnore }
$IgnoreEntries = @(".last_distill_time", ".agent_memory/watcher.log", ".agent_memory/watcher.error.log", ".agent_memory/distiller.log")
$Existing = Get-Content $GitIgnore
foreach ($entry in $IgnoreEntries) {
    if ($Existing -notcontains $entry) {
        Add-Content $GitIgnore $entry
    }
}
Write-Host "Updated: .gitignore"

# ── Done ──────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "======================================"
Write-Host "  Kage setup complete!"
Write-Host "======================================"
Write-Host ""
Write-Host "  Memory index : $MemDir\index.md"
Write-Host "  Watcher log  : $LogPath"
Write-Host "  Post-commit  : $GitDir\hooks\post-commit"
Write-Host ""
Write-Host "  The session watcher is running as a Scheduled Task."
Write-Host "  It will auto-distill Claude Code sessions every 5 minutes."
Write-Host ""
