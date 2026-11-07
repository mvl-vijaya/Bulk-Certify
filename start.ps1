# Bulk Certify - PowerShell Launcher
$ErrorActionPreference = "Stop"

# Ensure local Node.js path is in current session
$nodePath = "$env:LOCALAPPDATA\Programs\nodejs"
if (Test-Path "$nodePath\node.exe") {
    $env:Path = "$nodePath;$env:Path"
}

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "   Starting Bulk Certify Application..." -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Cyan

# Test node existence
try {
    $nodeVer = & node -v
    Write-Host "Node.js Version: $nodeVer" -ForegroundColor Gray
} catch {
    Write-Host "[ERROR] Node.js is not recognized. Please reopen your PowerShell terminal." -ForegroundColor Red
    exit 1
}

# Run npm start or npm run dev
if ($args[0] -eq "dev") {
    & npm run dev
} else {
    & npm start
}

