# ==============================================================================
# Code Sentinel - Automated Setup Script (PowerShell / Windows)
# ==============================================================================

Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host "CODE SENTINEL - WINDOWS AUTOMATED SETUP" -ForegroundColor Cyan
Write-Host "=======================================================" -ForegroundColor Cyan

# 1. Check Prerequisites
Write-Host "`n[STEP 1] Checking Prerequisites..." -ForegroundColor Yellow
$missing = @()

if (-not (Get-Command node -ErrorAction SilentlyContinue)) { $missing += "Node.js (>=20.12)" }
if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) { $missing += "pnpm" }
if (-not (Get-Command python -ErrorAction SilentlyContinue)) { $missing += "Python 3" }

if ($missing.Count -gt 0) {
    Write-Host "Missing required tools: $($missing -join ', ')" -ForegroundColor Red
    Exit 1
}

# 2. Run Python Setup
Write-Host "`n[STEP 2] Running Setup Engine..." -ForegroundColor Yellow
python scripts\setup.py

Write-Host "`nSetup process completed." -ForegroundColor Green
