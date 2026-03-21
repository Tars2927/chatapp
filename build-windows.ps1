$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir = Join-Path $root "backend"
$venvPython = Join-Path $backendDir "venv\Scripts\python.exe"
$frontendDist = Join-Path $root "frontend\dist"
$outputDir = Join-Path $root "release"

if (-not (Test-Path $venvPython)) {
  throw "Expected Python at $venvPython. Create the backend virtual environment first."
}

if (-not (Test-Path $frontendDist)) {
  throw "Frontend build not found at $frontendDist. Run 'cd frontend; npm run build' first."
}

& $venvPython -m pip install -r (Join-Path $backendDir "requirements-desktop.txt")

$pyinstallerArgs = @(
  "--noconfirm"
  "--clean"
  "--onefile"
  "--name", "Baithak"
  "--distpath", $outputDir
  "--add-data", "$frontendDist;frontend/dist"
  "--collect-all", "passlib"
  "--hidden-import", "uvicorn.logging"
  "--hidden-import", "uvicorn.loops.auto"
  "--hidden-import", "uvicorn.protocols.http.auto"
  "--hidden-import", "uvicorn.protocols.websockets.auto"
  "--hidden-import", "uvicorn.lifespan.on"
  "desktop_launcher.py"
)

Push-Location $backendDir
try {
  & $venvPython -m PyInstaller @pyinstallerArgs
} finally {
  Pop-Location
}

Write-Host ""
Write-Host "Windows build created:"
Write-Host "  $outputDir\Baithak.exe"
