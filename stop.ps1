<#
.SYNOPSIS
    Stops all OrbitAnnotate dev services (Frontend :3000, Backend :5000, AI :8000).
#>

$ErrorActionPreference = "SilentlyContinue"

function Write-Step { param($msg) Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Write-OK   { param($msg) Write-Host "  [OK] $msg" -ForegroundColor Green }
function Write-Warn { param($msg) Write-Host "  [--] $msg" -ForegroundColor Yellow }

Write-Step "Stopping OrbitAnnotate services..."

$ports   = @(3000, 5000, 8000)
$killed  = @()
$missing = @()

foreach ($port in $ports) {
    $lines = netstat -ano | Select-String ":$port\s.*LISTENING"
    if (-not $lines) {
        $missing += $port
        continue
    }
    foreach ($line in $lines) {
        if ($line -match "\s+(\d+)\s*$") {
            $procId = [int]$Matches[1]
            try {
                Stop-Process -Id $procId -Force
                $killed += "PID $procId (port $port)"
            } catch {
                Write-Warn "Could not kill PID $procId on port $port : $_"
            }
        }
    }
}

foreach ($k in $killed)  { Write-OK  "Killed $k" }
foreach ($p in $missing) { Write-Warn "Nothing was listening on port $p" }

Write-Host ""
Write-Host "  Done. All OrbitAnnotate services stopped." -ForegroundColor Cyan
Write-Host ""
