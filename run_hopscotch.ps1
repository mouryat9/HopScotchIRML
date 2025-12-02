# PowerShell startup script for HopScotchIRML (Windows)
# - Builds FAISS index if missing
# - Ensures Ollama is serving
# - Pulls & warms llama3.1:8b
# - Starts FastAPI backend (app_chat:app) and Vite frontend

# === Paths ===
$RootPath  = "D:\KSU\HOPSCOTCH\HopScotchIRML"
$IndexPath = "$RootPath\server\index\faiss.index"
$MetaPath  = "$RootPath\server\index\chunks.json"

Write-Host "Checking Ollama server (127.0.0.1:11434)..." -ForegroundColor Yellow

# === Step 0: Ensure Ollama server is running on 11434 ===
$ollamaListening = $false
try {
    $conn = Get-NetTCPConnection -State Listen -LocalPort 11434 -ErrorAction Stop
    if ($conn) { $ollamaListening = $true }
} catch {
    $ollamaListening = $false
}

if (-not $ollamaListening) {
    Write-Host "Starting 'ollama serve'..." -ForegroundColor Yellow
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "ollama serve"
    Start-Sleep -Seconds 3
} else {
    Write-Host "Ollama is already serving." -ForegroundColor Green
}

# === Step 1: Build FAISS index if missing ===
if (-not (Test-Path $IndexPath) -or -not (Test-Path $MetaPath)) {
    Write-Host "Building FAISS vector index..." -ForegroundColor Yellow
    Set-Location $RootPath
    python ".\create_index.py" --rebuild
} else {
    Write-Host "FAISS index already exists. (Use 'python create_index.py --rebuild' to refresh)" -ForegroundColor Green
}

# === Step 2: Ensure model is present & warm it ===
Write-Host "Ensuring llama3.1:8b is pulled..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "ollama pull llama3.1:8b"

Write-Host "Warming model for 60 minutes (keepalive)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "ollama run llama3.1:8b 'ready' --keepalive 60m"

# === Step 3: Start backend (FastAPI, chat-first: app_chat:app) ===
Write-Host "Starting backend (Uvicorn -> app_chat:app)..." -ForegroundColor Cyan

# NOTE: venv is in the parent folder as ..\.venv, same as your old script
$backendCmd = "cd `"$RootPath`"; ..\.venv\Scripts\activate; uvicorn app_chat:app --reload --host 0.0.0.0 --port 8000"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendCmd

# === Step 4: Start frontend (Vite React app) ===
Write-Host "Starting frontend (Vite React app)..." -ForegroundColor Cyan
$frontendCmd = "cd `"$RootPath\hopscotch-ui`"; npm run dev -- --host"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $frontendCmd

Write-Host "HopScotchIRML launched."
Write-Host "Backend:  http://localhost:8000"
Write-Host "Frontend: http://localhost:5173"
