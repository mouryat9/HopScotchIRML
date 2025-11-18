# create_index.py
"""
Build a FAISS index from docs in server/resources and write to server/index.
Supports .txt, .md, .pdf (pypdf with pdfminer fallback).
Embeddings: sentence-transformers/all-MiniLM-L6-v2 (dim=384), normalized + Inner Product.
"""

from __future__ import annotations
import argparse, json, re
from pathlib import Path
from typing import List, Dict, Any

# --- Paths relative to this file ---
ROOT = Path(__file__).parent.resolve()
DOCS_DIR = ROOT / "server" / "resources"
INDEX_DIR = ROOT / "server" / "index"
INDEX_DIR.mkdir(parents=True, exist_ok=True)
INDEX_PATH = INDEX_DIR / "faiss.index"
META_PATH  = INDEX_DIR / "chunks.json"

# --- Optional deps ---
try:
    import faiss  # faiss-cpu on Windows
except Exception as e:
    raise SystemExit("FAISS not installed. Run: pip install faiss-cpu") from e

try:
    from sentence_transformers import SentenceTransformer
except Exception as e:
    raise SystemExit("sentence-transformers not installed. Run: pip install sentence-transformers") from e

try:
    from pypdf import PdfReader
except Exception:
    PdfReader = None

try:
    from pdfminer.high_level import extract_text as pdfminer_extract_text
except Exception:
    pdfminer_extract_text = None

EMBED_MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"

def read_txt(p: Path) -> str:
    return p.read_text(encoding="utf-8", errors="ignore")

def read_md(p: Path) -> str:
    return p.read_text(encoding="utf-8", errors="ignore")

def read_pdf(p: Path) -> str:
    txt = ""
    if PdfReader is not None:
        try:
            reader = PdfReader(str(p))
            txt = "\n".join((page.extract_text() or "") for page in reader.pages)
        except Exception:
            txt = ""
    if (not txt or not txt.strip()) and pdfminer_extract_text is not None:
        try:
            txt = pdfminer_extract_text(str(p)) or ""
        except Exception:
            txt = ""
    return txt

def load_docs(dirpath: Path) -> List[Dict[str, str]]:
    docs: List[Dict[str, str]] = []
    if not dirpath.exists():
        return docs
    for p in sorted(dirpath.glob("**/*")):
        if not p.is_file(): 
            continue
        ext = p.suffix.lower()
        try:
            if ext == ".txt":
                docs.append({"source": p.name, "text": read_txt(p)})
            elif ext in (".md", ".markdown"):
                docs.append({"source": p.name, "text": read_md(p)})
            elif ext == ".pdf":
                docs.append({"source": p.name, "text": read_pdf(p)})
        except Exception:
            # skip unreadable files
            continue
    return docs

def chunk_text(text: str, max_chars: int = 2400, overlap: int = 400) -> List[str]:
    text = re.sub(r"\s+", " ", text or "").strip()
    if not text:
        return []
    step = max(1, max_chars - overlap)
    return [text[i:i+max_chars] for i in range(0, len(text), step)]

def main():
    ap = argparse.ArgumentParser(description="Build FAISS index for IRML resources")
    ap.add_argument("-d", "--docs", default=str(DOCS_DIR), help="Docs directory (default: server/resources)")
    ap.add_argument("-o", "--out",  default=str(INDEX_DIR), help="Index directory (default: server/index)")
    ap.add_argument("--rebuild", action="store_true", help="Force rebuild (ignore existing files)")
    args = ap.parse_args()

    docs_dir = Path(args.docs).resolve()
    out_dir  = Path(args.out).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    index_path = out_dir / "faiss.index"
    meta_path  = out_dir / "chunks.json"

    if index_path.exists() and meta_path.exists() and not args.rebuild:
        print(f"[create_index] Index already exists at {index_path}. Use --rebuild to force.")
        return

    print(f"[create_index] Loading documents from: {docs_dir}")
    docs = load_docs(docs_dir)
    print(f"[create_index] Loaded {len(docs)} documents")

    chunks: List[Dict[str, Any]] = []
    for d in docs:
        for piece in chunk_text(d["text"]):
            chunks.append({"text": piece, "source": d["source"]})

    if not chunks:
        raise SystemExit("[create_index] No text extracted from docs. Ensure server/resources has readable .pdf/.txt/.md files.")

    texts = [c["text"] for c in chunks]
    print(f"[create_index] Total chunks: {len(texts)}")

    print("[create_index] Loading embedder:", EMBED_MODEL_NAME)
    embedder = SentenceTransformer(EMBED_MODEL_NAME)
    vecs = embedder.encode(texts, convert_to_numpy=True, normalize_embeddings=True)
    dim = vecs.shape[1]
    print(f"[create_index] Embedding dim: {dim}, vectors: {vecs.shape[0]}")

    print("[create_index] Building FAISS index (Inner Product)...")
    index = faiss.IndexFlatIP(dim)
    index.add(vecs)

    print(f"[create_index] Writing index -> {index_path}")
    faiss.write_index(index, str(index_path))

    print(f"[create_index] Writing chunks metadata -> {meta_path}")
    meta = [{"id": i, "text": c["text"], "source": c["source"]} for i, c in enumerate(chunks)]
    meta_path.write_text(json.dumps(meta, ensure_ascii=False), encoding="utf-8")

    print("[create_index] DONE ✅")

if __name__ == "__main__":
    main()
