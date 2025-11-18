# PowerShell startup script for HopScotchIRML (Windows)
# Launches FastAPI backend and React/Vite frontend
# Also builds FAISS index if not found

# === Paths ===
$RootPath = "D:\KSU\HOPSCOTCH\HopScotchIRML"
$IndexPath = "$RootPath\server\index\faiss.index"
$MetaPath = "$RootPath\server\index\chunks.json"


# === Step 2: Build FAISS index if missing ===
if (-not (Test-Path $IndexPath) -or -not (Test-Path $MetaPath)) {
    Write-Host "Building FAISS vector index..." -ForegroundColor Yellow
    cd $RootPath
    python .\create_index.py --rebuild
} else {
    Write-Host "✅ FAISS index already exists. (Use 'python create_index.py --rebuild' to refresh)" -ForegroundColor Green
}


# === Ollama: ensure model is present (no-op if already pulled) ===
# This pulls once; you can comment it out after the first run.
Start-Process powershell -ArgumentList "ollama pull llama3.1:8b" -NoNewWindow

# === (Optional) warm the model for 60 minutes (keeps it in VRAM/RAM) ===
Start-Process powershell -ArgumentList "ollama run llama3.1:8b 'ready' --keepalive 60m" -NoNewWindow

# === Step 3: Start backend (FastAPI) ===
Write-Host "🚀 Starting backend (Uvicorn)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd $RootPath; uvicorn app:app --reload --host 0.0.0.0 --port 8000"

# === Step 4: Start frontend (Vite React app) ===
Write-Host "🌐 Starting frontend (Vite React app)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd $RootPath\hopscotch-ui; npm run dev -- --host"

Write-Host "✅ HopScotchIRML launched successfully."
Write-Host "Backend: http://localhost:8000"
Write-Host "Frontend: http://localhost:5173"
