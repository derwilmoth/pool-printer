param(
  [string]$InputScript = ".\launch-pool-printer.ps1",
  [string]$OutputExe = ".\launch-pool-printer.exe"
)

$ErrorActionPreference = "Stop"

$ScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

$IconPath = Join-Path $ScriptRoot "public\icon.ico"

if (-not (Test-Path $InputScript)) {
  throw "Input script not found: $InputScript"
}

if (-not (Test-Path $IconPath)) {
  throw "Icon not found: $IconPath"
}

if (-not (Get-Module -ListAvailable -Name ps2exe)) {
  Write-Host "Installing ps2exe module for current user..."
  Install-Module -Name ps2exe -Scope CurrentUser -Force
}

Import-Module ps2exe -ErrorAction Stop

Invoke-ps2exe `
  -InputFile $InputScript `
  -OutputFile $OutputExe `
  -NoConsole `
  -Title "Pool Printer Launcher" `
  -Product "Pool Printer" `
  -IconFile $IconPath

Write-Host "Launcher EXE created: $OutputExe"