param(
  [Parameter(Mandatory = $true)]
  [string]$Installer
)

$ErrorActionPreference = 'Stop'
$resolvedInstaller = (Resolve-Path -LiteralPath $Installer).Path
$appRoot = Join-Path $env:LOCALAPPDATA 'set_conjurer'
$updateExe = Join-Path $appRoot 'Update.exe'
$stableExe = Join-Path $appRoot 'set-conjurer.exe'
$startMenuRoot = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'
$desktopShortcut = Join-Path ([Environment]::GetFolderPath('Desktop')) 'Set Conjurer.lnk'
$windowsShell = New-Object -ComObject WScript.Shell

function Test-SetConjurerShortcut([string]$Shortcut) {
  try {
    $link = $windowsShell.CreateShortcut($Shortcut)
    $target = [IO.Path]::GetFullPath($link.TargetPath)
    if ($target -eq [IO.Path]::GetFullPath($stableExe)) { return $true }
    return $target -eq [IO.Path]::GetFullPath($updateExe) -and
      $link.Arguments -match '--processStart(?:=|\s+)"?set-conjurer\.exe'
  } catch {
    return $false
  }
}

function Find-SetConjurerStartMenuShortcut {
  Get-ChildItem -LiteralPath $startMenuRoot -Recurse -Filter '*.lnk' -File -ErrorAction SilentlyContinue |
    Where-Object { Test-SetConjurerShortcut $_.FullName } |
    Select-Object -First 1
}

Start-Process -FilePath $resolvedInstaller -ArgumentList '--silent' -Wait -WindowStyle Hidden

$deadline = (Get-Date).AddSeconds(30)
$startMenuShortcut = Find-SetConjurerStartMenuShortcut
while ((Get-Date) -lt $deadline -and !$startMenuShortcut) {
  Start-Sleep -Milliseconds 250
  $startMenuShortcut = Find-SetConjurerStartMenuShortcut
}

foreach ($required in @($updateExe, $stableExe, $desktopShortcut)) {
  if (!(Test-Path -LiteralPath $required)) { throw "Windows installation integration is missing: $required" }
}
if (!$startMenuShortcut) { throw "Set Conjurer is missing from the Start Menu below: $startMenuRoot" }

foreach ($shortcut in @($startMenuShortcut.FullName, $desktopShortcut)) {
  if (!(Test-SetConjurerShortcut $shortcut)) { throw "Windows shortcut does not launch Set Conjurer through Squirrel: $shortcut" }
}

$uninstall = Get-ChildItem 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall' |
  ForEach-Object { Get-ItemProperty $_.PSPath } |
  Where-Object { $_.DisplayName -eq 'Set Conjurer' } |
  Select-Object -First 1
if (!$uninstall) { throw 'Set Conjurer is missing from Windows Installed Apps.' }

Get-Process 'set-conjurer' -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Process -FilePath $updateExe -ArgumentList '--uninstall','-s' -Wait -WindowStyle Hidden
Write-Host 'Windows Setup, Squirrel launch shortcuts, stable stub, and Installed Apps registration passed.'
