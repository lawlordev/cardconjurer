param(
  [Parameter(Mandatory = $true)]
  [string]$Installer
)

$ErrorActionPreference = 'Stop'
$resolvedInstaller = (Resolve-Path -LiteralPath $Installer).Path
$appRoot = Join-Path $env:LOCALAPPDATA 'set_conjurer'
$updateExe = Join-Path $appRoot 'Update.exe'
$stableExe = Join-Path $appRoot 'set-conjurer.exe'
$startMenuShortcut = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Set Conjurer.lnk'
$desktopShortcut = Join-Path ([Environment]::GetFolderPath('Desktop')) 'Set Conjurer.lnk'

Start-Process -FilePath $resolvedInstaller -ArgumentList '--silent' -Wait -WindowStyle Hidden

$deadline = (Get-Date).AddSeconds(30)
while ((Get-Date) -lt $deadline -and !(Test-Path -LiteralPath $startMenuShortcut)) {
  Start-Sleep -Milliseconds 250
}

foreach ($required in @($updateExe, $stableExe, $startMenuShortcut, $desktopShortcut)) {
  if (!(Test-Path -LiteralPath $required)) { throw "Windows installation integration is missing: $required" }
}

$uninstall = Get-ChildItem 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall' |
  ForEach-Object { Get-ItemProperty $_.PSPath } |
  Where-Object { $_.DisplayName -eq 'Set Conjurer' } |
  Select-Object -First 1
if (!$uninstall) { throw 'Set Conjurer is missing from Windows Installed Apps.' }

Get-Process 'set-conjurer' -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Process -FilePath $updateExe -ArgumentList '--uninstall','-s' -Wait -WindowStyle Hidden
Write-Host 'Windows Setup, shortcuts, stable stub, and Installed Apps registration passed.'
