# Use the existing Python interpreter and virtual-environment packages directly.
# Some Windows application-control policies block generated .venv launchers.
# This script does not change Windows security settings.
$ErrorActionPreference = 'Stop'

if ($args.Count -eq 0 -or $args[0] -notin @('train', 'export', 'export-slides', 'compare')) {
    throw 'Usage: .\run-agent.ps1 train|export|export-slides|compare [arguments]'
}

$moduleNames = @{
    'train' = 'sac_robot.train'
    'export' = 'sac_robot.export'
    'export-slides' = 'sac_robot.export_slides'
    'compare' = 'sac_robot.compare'
}
$moduleName = $moduleNames[$args[0]]
$moduleArguments = @($args | Select-Object -Skip 1)
$configPath = Join-Path $PSScriptRoot '.venv/pyvenv.cfg'
if (-not (Test-Path -LiteralPath $configPath)) {
    throw 'Missing .venv. Run uv sync from agent-sac first.'
}
$homeLine = Get-Content -LiteralPath $configPath | Where-Object { $_ -match '^home\s*=' } | Select-Object -First 1
if (-not $homeLine) { throw 'Cannot find Python home in .venv/pyvenv.cfg.' }
$pythonHome = ($homeLine -split '=', 2)[1].Trim()
$pythonExecutable = Join-Path $pythonHome 'python.exe'
if (-not (Test-Path -LiteralPath $pythonExecutable)) {
    throw "Python interpreter not found: $pythonExecutable"
}
$sitePackages = Join-Path $PSScriptRoot '.venv/Lib/site-packages'
$sourcePath = Join-Path $PSScriptRoot 'src'
# Single quotes in the Python snippet survive native argument passing in both
# Windows PowerShell 5.1 and PowerShell 7 (double quotes do not in legacy mode).
$pythonCode = 'import sys, site, runpy; packages, source, module = sys.argv[1:4]; sys.argv = sys.argv[3:]; site.addsitedir(packages); sys.path.insert(0, source); runpy.run_module(module, run_name=''__main__'')'

Push-Location -LiteralPath $PSScriptRoot
try {
    & $pythonExecutable -X utf8 -c $pythonCode $sitePackages $sourcePath $moduleName @moduleArguments
    $agentExitCode = $LASTEXITCODE
} finally {
    Pop-Location
}
exit $agentExitCode
