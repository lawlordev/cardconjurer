$projectPython = Get-Command python -ErrorAction SilentlyContinue
$projectPythonPath = if ($projectPython) {
	$projectPython.Source
} else {
	Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
}

if (-not (Test-Path -LiteralPath $projectPythonPath)) {
	throw 'Python was not found. Run dev_server.py with any Python 3 installation.'
}

& $projectPythonPath (Join-Path $PSScriptRoot 'dev_server.py') --host 127.0.0.1 --port 8081
