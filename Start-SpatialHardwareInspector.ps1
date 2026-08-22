[CmdletBinding()]
param(
    [ValidateRange(1, 65535)]
    [int]$Port = 5173
)

$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot

if (-not (Get-Command node -ErrorAction SilentlyContinue) -or
    -not (Get-Command npm -ErrorAction SilentlyContinue)) {
    throw 'Node.js is required. Install Node.js 20.19+ or 22.12+ and run this launcher again.'
}

$nodeVersion = [version]((node --version).TrimStart('v'))
$supported = (($nodeVersion.Major -eq 20 -and $nodeVersion -ge [version]'20.19.0') -or
              ($nodeVersion.Major -ge 22 -and $nodeVersion -ge [version]'22.12.0'))
if (-not $supported) {
    throw "Unsupported Node.js $nodeVersion. Install Node.js 20.19+ or 22.12+."
}

if (-not (Test-Path -LiteralPath 'node_modules/.bin/vite.cmd')) {
    Write-Host 'Installing locked viewer dependencies...'
    & npm.cmd ci
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

Write-Host "Starting Spatial Hardware Inspector at http://127.0.0.1:$Port/"
Write-Host 'Keep this window open while using the viewer. Press Ctrl+C to stop it.'
& "$PSScriptRoot\node_modules\.bin\vite.cmd" --host 127.0.0.1 --open --strictPort --port $Port
exit $LASTEXITCODE
