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

if (!(Test-Path -LiteralPath $startMenuShortcut)) {
  Write-Host 'Squirrel installer diagnostics:'
  foreach ($log in @(
    (Join-Path $env:LOCALAPPDATA 'SquirrelTemp\SquirrelSetup.log'),
    (Join-Path $appRoot 'SquirrelSetup.log')
  )) {
    if (Test-Path -LiteralPath $log) {
      Write-Host "--- $log"
      Get-Content -LiteralPath $log -Tail 160
    }
  }
  $versionedExe = Get-ChildItem -Path $appRoot -Recurse -Filter 'set-conjurer.exe' -File |
    Where-Object { $_.Directory.Name -like 'app-*' } |
    Select-Object -First 1
  if ($versionedExe) {
    $diagnosticProcess = Start-Process -FilePath $versionedExe.FullName -ArgumentList '--squirrel-install','diagnostic' -PassThru -WindowStyle Hidden
    if (!$diagnosticProcess.WaitForExit(5000)) { $diagnosticProcess.Kill() }
    Write-Host "Manual lifecycle shortcut result: start-menu=$(Test-Path -LiteralPath $startMenuShortcut), desktop=$(Test-Path -LiteralPath $desktopShortcut)"
  }
}

foreach ($required in @($updateExe, $stableExe, $startMenuShortcut, $desktopShortcut)) {
  if (!(Test-Path -LiteralPath $required)) { throw "Windows installation integration is missing: $required" }
}

$windowsShell = New-Object -ComObject WScript.Shell
foreach ($shortcut in @($startMenuShortcut, $desktopShortcut)) {
  $target = $windowsShell.CreateShortcut($shortcut).TargetPath
  if ((Resolve-Path -LiteralPath $target).Path -ne (Resolve-Path -LiteralPath $stableExe).Path) {
    throw "Windows shortcut does not target the stable launcher: $shortcut -> $target"
  }
}

$uninstall = Get-ChildItem 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall' |
  ForEach-Object { Get-ItemProperty $_.PSPath } |
  Where-Object { $_.DisplayName -eq 'Set Conjurer' } |
  Select-Object -First 1
if (!$uninstall) { throw 'Set Conjurer is missing from Windows Installed Apps.' }

Get-Process 'set-conjurer' -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Process -FilePath $updateExe -ArgumentList '--uninstall','-s' -Wait -WindowStyle Hidden
Write-Host 'Windows Setup, stable-launcher shortcuts, stable stub, and Installed Apps registration passed.'
