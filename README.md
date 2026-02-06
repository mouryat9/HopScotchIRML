# Hopscotch 4 All

An interactive web application for scaffolding educational research design through a guided 9-step process, powered by a local LLM (Ollama) and RAG (Retrieval-Augmented Generation).

## The 9 Steps

1. **Who am I as a researcher?** — Identify your worldview/paradigm
2. **What am I wondering about?** — Define your research topic and goals
3. **What do I already know?** — Literature review and theoretical frameworks
4. **How will I study it?** — Choose a research design/methodology
5. **What is my research question?** — Formulate your research question
6. **What data will I collect?** — Select data collection methods
7. **How will I analyze the data?** — Choose analysis techniques
8. **How will I ensure trustworthiness?** — Address validity/reliability
9. **How will I be ethical?** — Plan for IRB, informed consent, ethics

## Architecture

```
hopscotch/
├── app_chat.py              # FastAPI backend (sessions, chat, RAG, step config)
├── create_index.py          # Script to build FAISS index from PDFs
├── requirements.txt         # Python dependencies
├── run_hopscotch_tmux.sh    # Launch script (Ollama, backend, frontend, tunnels)
├── server/
│   ├── config/
│   │   ├── paths/           # Research path configs (quantitative, qualitative, mixed)
│   │   └── surveys/         # Worldview survey questions
│   ├── index/               # FAISS vector index + chunks (generated)
│   └── resources/           # PDF research papers for RAG
├── metadata/                # Supplementary data files
└── hopscotch-ui/            # React + Vite frontend
    ├── src/
    │   ├── App.jsx           # Main layout, step progress bar, step diagram
    │   ├── App.css           # All application styles (CSS variables, components)
    │   ├── ChatBox.jsx       # Streaming chat component with markdown rendering
    │   ├── StepDetails.jsx   # Step-specific forms (Steps 1-3 hardcoded, 4-9 dynamic)
    │   └── api.js            # API client (session, chat, step data, worldview)
    └── public/
        ├── hopscotch-logo.png
        └── hopscotch-steps.png
```

### Backend

- **Framework**: FastAPI with Uvicorn
- **LLM**: Ollama (default model: `qwen2.5:14b`) — runs locally on GPU
- **RAG**: FAISS vector search over research PDFs using sentence-transformers embeddings
- **Sessions**: In-memory session store (no database required)
- **Worldview mapping**: Positivist/Post-positivist → Quantitative, Constructivist/Transformative → Qualitative, Pragmatist → Mixed methods

### Frontend

- **Framework**: React 19 + Vite 7
- **Styling**: Custom CSS with CSS variables (navy/green brand palette)
- **Chat**: Streaming responses via ReadableStream, markdown rendering with react-markdown
- **Step config**: Steps 1-3 are hardcoded, Steps 4-9 are dynamically loaded from `/step/config` based on the student's resolved research path

## Prerequisites

- **Python 3.10+**
- **Node.js 18+** and npm
- **Ollama** ([install guide](https://ollama.com/download))
- **GPU recommended** (NVIDIA with CUDA for fast LLM inference)

## Setup

### 1. Clone and install backend dependencies

```bash
git clone <repo-url> hopscotch
cd hopscotch

python3 -m venv hopscotchenv
source hopscotchenv/bin/activate
pip install -r requirements.txt
```

### 2. Install frontend dependencies

```bash
cd hopscotch-ui
npm install
cd ..
```

### 3. Pull the Ollama model

```bash
ollama pull qwen2.5:14b
```

### 4. Build the FAISS index (first time only)

Place your research PDFs in `server/resources/`, then run:

```bash
source hopscotchenv/bin/activate
python create_index.py
```

This creates `server/index/faiss.index` and `server/index/chunks.json`.

### 5. Configure the API URL

Edit `hopscotch-ui/src/api.js` and set `API_BASE` to your backend URL:

```js
// For local development:
const API_BASE = "http://127.0.0.1:8000";

// For Cloudflare tunnel (production):
// const API_BASE = "https://your-tunnel-url.trycloudflare.com";
```

## Running the Application

### Option A: Using the tmux launch script

```bash
chmod +x run_hopscotch_tmux.sh
./run_hopscotch_tmux.sh
```

This starts 4 tmux panes:
1. Ollama server
2. Backend (FastAPI on port 8000)
3. Frontend (Vite dev server on port 5173)
4. Cloudflare tunnels (optional, for remote access)

### Option B: Manual startup

**Terminal 1 — Ollama:**
```bash
ollama serve
```

**Terminal 2 — Backend:**
```bash
source hopscotchenv/bin/activate
uvicorn app_chat:app --host 0.0.0.0 --port 8000
```

**Terminal 3 — Frontend:**
```bash
cd hopscotch-ui
npm run dev
```

Then open **http://localhost:5173** in your browser.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/session` | Create a new session |
| GET | `/chat/history` | Get chat history for a session |
| POST | `/chat/send` | Send a message (non-streaming) |
| POST | `/chat/send_stream` | Send a message (streaming) |
| POST | `/worldview/set` | Set worldview and resolve research path |
| GET | `/step/config` | Get path-resolved step configuration |
| POST | `/step/save` | Save step-specific data |
| GET | `/step/get` | Load step-specific data |
| POST | `/step/set_methodology` | Set methodology for mixed-methods path |

## Key Features

- **Path-aware step chaining**: Worldview selection automatically determines the research methodology path (quantitative, qualitative, or mixed methods)
- **Streaming LLM responses**: Chat responses stream token-by-token for a responsive feel
- **RAG-powered guidance**: LLM responses are grounded in research methodology PDFs
- **Step context accumulation**: The LLM sees all previous step inputs when responding, providing personalised guidance
- **Interactive step diagram**: Clickable hopscotch diagram for visual navigation
- **Auto-save**: Form inputs are saved to the backend on every change
- **"Get AI Guidance" buttons**: One-click to get LLM feedback on your step inputs
