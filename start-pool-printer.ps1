param(
  [string]$ProjectRoot = $PSScriptRoot,
  [switch]$InstallAutostart
)

$ErrorActionPreference = "Stop"

function Start-PoolProcess {
  param(
    [string]$WorkingDirectory,
    [string]$Command
  )

  $powerShellExe = (Get-Command powershell.exe).Source

  Start-Process -FilePath $powerShellExe -WindowStyle Minimized -ArgumentList @(
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
    "Set-Location -LiteralPath '$WorkingDirectory'; $Command"
  )
}

if ($InstallAutostart) {
  $projectPath = (Resolve-Path $ProjectRoot).Path
  $scriptPath = Join-Path $projectPath "start-pool-printer.ps1"
  $powerShellExe = (Get-Command powershell.exe).Source

  $action = New-ScheduledTaskAction -Execute $powerShellExe -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`" -ProjectRoot `"$projectPath`""
  $trigger = New-ScheduledTaskTrigger -AtLogOn
  $principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Highest
  $settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries

  Register-ScheduledTask -TaskName "Pool Printer Autostart" -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force
  exit 0
}

$projectPath = (Resolve-Path $ProjectRoot).Path

Start-PoolProcess -WorkingDirectory $projectPath -Command "npm run start"
Start-PoolProcess -WorkingDirectory $projectPath -Command "npx tsx print-middleware/index.ts"

