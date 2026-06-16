<#
.SYNOPSIS
    OrbitAnnotate dev launcher.
    Detects the current git branch, writes the correct .env files, installs
    all required dependencies, then starts all three services.

.DESCRIPTION
    Branch behaviour:
      offline-use  ->  Backend: SQLite + local uploads
                       AI service: fully offline (TRANSFORMERS_OFFLINE=1)
      main         ->  Backend: MongoDB Atlas + Cloudinary
                       AI service: online (HF downloads allowed)

    npm install is always run for the backend and frontend so that the
    correct set of packages (e.g. mongoose on main, sql.js on offline-use)
    is present without needing any extra flags.

.PARAMETER SkipInstall
    Skip the npm / pip install step (use when you know deps are up to date).

.EXAMPLE
    .\start.ps1
    .\start.ps1 -SkipInstall
#>
param(
    [switch]$SkipInstall
)

$ErrorActionPreference = "Continue"
$ROOT = Split-Path -Parent $MyInvocation.MyCommand.Path

function Write-Step { param($msg) Write-Host "" ; Write-Host "==> $msg" -ForegroundColor Cyan }
function Write-OK   { param($msg) Write-Host "  [OK] $msg" -ForegroundColor Green }
function Write-Warn { param($msg) Write-Host "  [!!] $msg" -ForegroundColor Yellow }
function Write-Err  { param($msg) Write-Host "  [XX] $msg" -ForegroundColor Red ; exit 1 }

# ---------------------------------------------------------------------------
# 1. Ask which branch to run
# ---------------------------------------------------------------------------
$currentBranch = & git -C $ROOT rev-parse --abbrev-ref HEAD 2>&1
if ($LASTEXITCODE -ne 0) { $currentBranch = "unknown" }

Write-Host ""
Write-Host "  OrbitAnnotate - Which mode do you want to run?" -ForegroundColor Cyan
Write-Host ""
Write-Host "    [1]  main         (MongoDB Atlas + Cloudinary)  - current: $(if ($currentBranch -eq 'main') {'<-- you are here'} else {''})" -ForegroundColor White
Write-Host "    [2]  offline-use  (SQLite + local uploads)      - current: $(if ($currentBranch -eq 'offline-use') {'<-- you are here'} else {''})" -ForegroundColor White
Write-Host ""

do {
    $choice = Read-Host "  Enter 1 or 2"
} while ($choice -ne "1" -and $choice -ne "2")

$branch = if ($choice -eq "1") { "main" } else { "offline-use" }

# Switch git branch if needed
if ($branch -ne $currentBranch) {
    Write-Host ""
    Write-Host "  Switching from '$currentBranch' to '$branch'..." -ForegroundColor DarkCyan
    & git -C $ROOT checkout $branch 2>&1 | ForEach-Object { Write-Host "  $_" -ForegroundColor DarkGray }
    if ($LASTEXITCODE -ne 0) {
        Write-Err "git checkout $branch failed. Commit or stash your changes first."
    }
    Write-OK "Switched to branch '$branch'"
} else {
    Write-OK "Already on branch '$branch' - no switch needed"
}

# ---------------------------------------------------------------------------
# 2. Write environment files based on branch
# ---------------------------------------------------------------------------
Write-Step "Writing environment files for branch '$branch'..."

if ($branch -eq "offline-use") {

    # Backend: SQLite + local uploads
    $backendEnv = @"
PORT=5000
NODE_ENV=development

# Local server URL (used to build image URLs returned to clients)
SERVER_URL=http://localhost:5000

# SQLite database file (created automatically on first run)
SQLITE_PATH=./data/database.db

# JWT
JWT_SECRET=orbit_annotate_secret_jwt_key_change_in_production
JWT_EXPIRES_IN=7d

FRONTEND_URL=http://localhost:3000
"@
    [System.IO.File]::WriteAllText("$ROOT\backend\.env", $backendEnv, [System.Text.Encoding]::UTF8)
    Write-OK "backend/.env -> SQLite + local-upload mode"

    # AI service: fully offline
    $aiEnv = @"
YOLO_CONF_THRESHOLD=0.10
PORT=8000
FRONTEND_ORIGIN=http://localhost:3000

# Block all Hugging Face network calls - models must exist locally
TRANSFORMERS_OFFLINE=1
HF_DATASETS_OFFLINE=1
"@
    [System.IO.File]::WriteAllText("$ROOT\ai-service\.env", $aiEnv, [System.Text.Encoding]::UTF8)
    Write-OK "ai-service/.env -> offline mode (HF network blocked)"

} elseif ($branch -eq "main") {

    $secretsFile = "$ROOT\.env.main.secrets"

    # First-time setup: prompt for credentials and save them
    if (-not (Test-Path $secretsFile)) {
        Write-Warn ".env.main.secrets not found - first-time setup for main branch."
        Write-Host ""
        Write-Host "  Enter your cloud credentials (saved to .env.main.secrets, gitignored)." -ForegroundColor Yellow
        Write-Host ""

        $mongoUri    = Read-Host "  MongoDB URI         (MONGODB_URI)"
        $cloudUrl    = Read-Host "  Cloudinary URL      (CLOUDINARY_URL)"
        $cloudName   = Read-Host "  Cloudinary name     (CLOUDINARY_CLOUD_NAME)"
        $cloudKey    = Read-Host "  Cloudinary API key  (CLOUDINARY_API_KEY)"
        $cloudSecret = Read-Host "  Cloudinary secret   (CLOUDINARY_API_SECRET)"
        $jwtInput    = Read-Host "  JWT secret          (leave blank for default)"
        if ([string]::IsNullOrWhiteSpace($jwtInput)) {
            $jwtInput = "orbit_annotate_secret_jwt_key_change_in_production"
        }

        $secretsContent = "MONGODB_URI=$mongoUri`r`nCLOUDINARY_URL=$cloudUrl`r`nCLOUDINARY_CLOUD_NAME=$cloudName`r`nCLOUDINARY_API_KEY=$cloudKey`r`nCLOUDINARY_API_SECRET=$cloudSecret`r`nJWT_SECRET=$jwtInput`r`n"
        [System.IO.File]::WriteAllText($secretsFile, $secretsContent, [System.Text.Encoding]::UTF8)
        Write-OK "Credentials saved to .env.main.secrets"
    }

    # Load secrets into hashtable, self-healing doubled KEY=KEY=value entries
    $secrets = @{}
    Get-Content $secretsFile | ForEach-Object {
        if ($_ -match "^([^#=][^=]*)=(.*)$") {
            $k = $Matches[1].Trim()
            $v = $Matches[2].Trim()
            # Fix: if the user accidentally typed "KEY=value" as the answer to
            # Read-Host, the stored line becomes KEY=KEY=value. Strip the prefix.
            if ($v -match "^$k=(.+)$") { $v = $Matches[1] }
            $secrets[$k] = $v
        }
    }

    # Re-save the secrets file with any corrections applied
    $fixed = $secrets.GetEnumerator() | Sort-Object Name |
        ForEach-Object { "$($_.Name)=$($_.Value)" }
    [System.IO.File]::WriteAllText($secretsFile, ($fixed -join "`r`n") + "`r`n", [System.Text.Encoding]::UTF8)

    # Validate required keys
    $required = @("MONGODB_URI","CLOUDINARY_URL","CLOUDINARY_CLOUD_NAME","CLOUDINARY_API_KEY","CLOUDINARY_API_SECRET")
    foreach ($key in $required) {
        if (-not $secrets.ContainsKey($key) -or [string]::IsNullOrWhiteSpace($secrets[$key])) {
            Write-Err "Missing '$key' in .env.main.secrets. Delete the file and re-run to re-enter credentials."
        }
    }
    $jwtVal = if ($secrets.ContainsKey("JWT_SECRET") -and -not [string]::IsNullOrWhiteSpace($secrets["JWT_SECRET"])) {
        $secrets["JWT_SECRET"]
    } else {
        "orbit_annotate_secret_jwt_key_change_in_production"
    }

    # Backend: MongoDB + Cloudinary
    $backendEnv = "PORT=5000`r`nNODE_ENV=development`r`n`r`n# MongoDB Atlas`r`nMONGODB_URI=$($secrets['MONGODB_URI'])`r`n`r`n# JWT`r`nJWT_SECRET=$jwtVal`r`nJWT_EXPIRES_IN=7d`r`n`r`nFRONTEND_URL=http://localhost:3000`r`n`r`n# Cloudinary - image hosting`r`nCLOUDINARY_URL=$($secrets['CLOUDINARY_URL'])`r`nCLOUDINARY_CLOUD_NAME=$($secrets['CLOUDINARY_CLOUD_NAME'])`r`nCLOUDINARY_API_KEY=$($secrets['CLOUDINARY_API_KEY'])`r`nCLOUDINARY_API_SECRET=$($secrets['CLOUDINARY_API_SECRET'])`r`n"
    [System.IO.File]::WriteAllText("$ROOT\backend\.env", $backendEnv, [System.Text.Encoding]::UTF8)
    Write-OK "backend/.env -> MongoDB + Cloudinary mode"

    # AI service: online mode
    $aiEnv = "YOLO_CONF_THRESHOLD=0.10`r`nPORT=8000`r`nFRONTEND_ORIGIN=http://localhost:3000`r`n`r`n# Allow Hugging Face network calls (SegFormer auto-downloads if not cached)`r`nTRANSFORMERS_OFFLINE=0`r`nHF_DATASETS_OFFLINE=0`r`n"
    [System.IO.File]::WriteAllText("$ROOT\ai-service\.env", $aiEnv, [System.Text.Encoding]::UTF8)
    Write-OK "ai-service/.env -> online mode (HF downloads allowed)"

} else {
    Write-Warn "Branch '$branch' is not 'main' or 'offline-use' - skipping env setup."
    Write-Warn "Ensure backend/.env and ai-service/.env are configured manually."
}

# Frontend .env.local (same for all branches)
$feEnv = "$ROOT\satellite-annotator\.env.local"
if (-not (Test-Path $feEnv)) {
    $feContent = "NEXT_PUBLIC_API_URL=http://localhost:5000/api`r`nNEXT_PUBLIC_AI_API_URL=http://localhost:8000`r`n"
    [System.IO.File]::WriteAllText($feEnv, $feContent, [System.Text.Encoding]::UTF8)
    Write-OK "satellite-annotator/.env.local created"
} else {
    Write-OK "satellite-annotator/.env.local already exists - not overwritten"
}

# ---------------------------------------------------------------------------
# 3. Install / sync dependencies
#    Always runs so that switching branches (e.g. main <-> offline-use) never
#    leaves stale packages (mongoose vs sql.js, cloudinary, etc.).
#    Pass -SkipInstall to bypass if you know everything is already up to date.
# ---------------------------------------------------------------------------
if (-not $SkipInstall) {
    Write-Step "Installing dependencies..."

    Write-Host "  [npm] backend  (mongoose on main / sql.js on offline-use)..." -ForegroundColor DarkCyan
    $env:npm_config_loglevel = "error"
    & npm install --prefix "$ROOT\backend" --no-fund --no-audit 2>&1 |
        Where-Object { $_ -notmatch "^npm warn" } |
        ForEach-Object { if ($_ -match "^npm error") { Write-Host "  $_" -ForegroundColor Red } }
    if ($LASTEXITCODE -eq 0) { Write-OK "backend deps ready" } else { Write-Warn "backend npm install exited with code $LASTEXITCODE" }

    Write-Host "  [npm] satellite-annotator..." -ForegroundColor DarkCyan
    & npm install --prefix "$ROOT\satellite-annotator" --no-fund --no-audit 2>&1 |
        Where-Object { $_ -notmatch "^npm warn" } |
        ForEach-Object { if ($_ -match "^npm error") { Write-Host "  $_" -ForegroundColor Red } }
    if ($LASTEXITCODE -eq 0) { Write-OK "satellite-annotator deps ready" } else { Write-Warn "satellite-annotator npm install exited with code $LASTEXITCODE" }

    Write-Host "  [pip] ai-service..." -ForegroundColor DarkCyan
    & pip install -r "$ROOT\ai-service\requirements.txt" --quiet --quiet 2>&1 |
        Where-Object { $_ -notmatch "^WARNING" } |
        ForEach-Object { if ($_ -match "ERROR") { Write-Host "  $_" -ForegroundColor Red } }
    if ($LASTEXITCODE -eq 0) { Write-OK "ai-service deps ready" } else { Write-Warn "pip install exited with code $LASTEXITCODE (ai-service)" }
} else {
    Write-Warn "Skipping dependency install (-SkipInstall flag set)"
}

# ---------------------------------------------------------------------------
# 4. Launch each service in its own PowerShell window
# ---------------------------------------------------------------------------
Write-Step "Launching services..."

function Start-ServiceWindow {
    param([string]$Title, [string]$WorkDir, [string]$Cmd)
    Start-Process powershell -ArgumentList "-NoExit", "-Command",
        "`$Host.UI.RawUI.WindowTitle = '$Title'; Set-Location '$WorkDir'; $Cmd"
}

# AI service (Python) - start first so models load before frontend hits it
Start-ServiceWindow `
    -Title "OrbitAnnotate | AI Service :8000" `
    -WorkDir "$ROOT\ai-service" `
    -Cmd "python -u main.py"
Write-OK "AI service   -> http://localhost:8000"

Start-Sleep -Milliseconds 400

# Backend (Node / Express)
Start-ServiceWindow `
    -Title "OrbitAnnotate | Backend :5000" `
    -WorkDir "$ROOT\backend" `
    -Cmd "npm run dev"
Write-OK "Backend      -> http://localhost:5000"

Start-Sleep -Milliseconds 400

# Frontend (Next.js)
Start-ServiceWindow `
    -Title "OrbitAnnotate | Frontend :3000" `
    -WorkDir "$ROOT\satellite-annotator" `
    -Cmd "npm run dev"
Write-OK "Frontend     -> http://localhost:3000"

# ---------------------------------------------------------------------------
# 5. Summary
# ---------------------------------------------------------------------------
$modeLabel = switch ($branch) {
    "offline-use" { "OFFLINE  (SQLite + local uploads)" }
    "main"        { "ONLINE   (MongoDB Atlas + Cloudinary)" }
    default       { "UNKNOWN  (manual .env required)" }
}

Write-Host ""
Write-Host "-------------------------------------------------" -ForegroundColor DarkGray
Write-Host "  OrbitAnnotate is starting up" -ForegroundColor White
Write-Host "  Branch : $branch" -ForegroundColor White
Write-Host "  Mode   : $modeLabel" -ForegroundColor White
Write-Host ""
Write-Host "  Frontend   http://localhost:3000" -ForegroundColor Green
Write-Host "  Backend    http://localhost:5000" -ForegroundColor Green
Write-Host "  AI service http://localhost:8000" -ForegroundColor Green
Write-Host ""
Write-Host "  To stop all services run:  .\stop.ps1" -ForegroundColor DarkGray
Write-Host "-------------------------------------------------" -ForegroundColor DarkGray
Write-Host ""
