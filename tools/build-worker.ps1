# Builds worker/index.js from worker/worker.src.js + js/ai-tasks.js (single-file worker for the Cloudflare dashboard).
# ASCII only in this file (PowerShell 5.1 without BOM).
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$utf8 = New-Object System.Text.UTF8Encoding($false)

$tasks = [System.IO.File]::ReadAllText((Join-Path $root 'js\ai-tasks.js'), $utf8)
# Strip the ES-module export; the worker uses TASKS/validateSchema as module-level constants.
$tasks = $tasks -replace '(?m)^export \{ TASKS, validateSchema \};\s*$', ''
$src = [System.IO.File]::ReadAllText((Join-Path $root 'worker\worker.src.js'), $utf8)
if ($src -notmatch '/\*__TASKS__\*/') { throw 'Placeholder /*__TASKS__*/ not found in worker.src.js' }
$out = $src.Replace('/*__TASKS__*/', "// ===== js/ai-tasks.js (eingebettet, nicht hier bearbeiten) =====`n" + $tasks + "`n// ===== Ende ai-tasks.js =====")
[System.IO.File]::WriteAllText((Join-Path $root 'worker\index.js'), $out, $utf8)
Write-Host ("worker/index.js written: {0} bytes" -f $out.Length)
