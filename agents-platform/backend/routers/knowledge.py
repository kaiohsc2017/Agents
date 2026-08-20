"""routers/knowledge.py — base de conhecimento (PDFs)"""
import asyncio
import io
import logging
import uuid

from fastapi import APIRouter, UploadFile, File, HTTPException, Query, Depends
from database import DB
from auth import require_permission

logger = logging.getLogger("asteriskia.knowledge")

router = APIRouter()

# Achado de segurança: upload/delete não tinham nenhuma checagem de autorização
# — qualquer usuário autenticado podia apagar a base do RAG ou injetar um PDF
# malicioso no contexto enviado ao LLM de todos os agentes.
_WRITE = [Depends(require_permission("agents.knowledge", "write"))]

# Limite de tamanho do PDF — evita consumo excessivo de memória/CPU na extração
_MAX_UPLOAD_BYTES = 20 * 1024 * 1024  # 20 MB


def _extract_pdf_text(data: bytes) -> str:
    """Extração de texto do PDF — roda em thread pois é CPU-bound e bloqueia o event loop."""
    # Achado M7 da auditoria: validar só a extensão ".pdf" do nome do arquivo
    # não garante que o conteúdo seja um PDF de verdade — um arquivo qualquer
    # renomeado caía no fallback abaixo e era decodificado/persistido como
    # texto puro na base de conhecimento (vetor de prompt injection indireto
    # via RAG). Valida magic bytes ANTES de tentar o parsing.
    if data[:5] != b"%PDF-":
        raise HTTPException(400, "Arquivo não é um PDF válido")
    try:
        import pypdf
        reader = pypdf.PdfReader(io.BytesIO(data))
        return "\n".join(p.extract_text() or "" for p in reader.pages)
    except HTTPException:
        raise
    except Exception as e:
        # Achado B3 da auditoria: com a validação de magic bytes acima, este
        # fallback só deveria ser alcançado por PDF corrompido (mas com header
        # válido) — não mais por arquivo disfarçado. Loga a falha real.
        logger.warning("Falha ao extrair texto de PDF corrompido: %s", e)
        return data.decode("utf-8", errors="ignore")

@router.get("/")
async def list_docs(limit: int = Query(default=100, le=500), offset: int = 0):
    async with DB() as db:
        rows  = await db.fetch(
            "SELECT id,filename,title,tags,created_at FROM knowledge_docs ORDER BY created_at DESC LIMIT $1 OFFSET $2",
            limit, offset)
        total = await db.fetchval("SELECT COUNT(*) FROM knowledge_docs")
        return {"items": [dict(r) for r in rows], "total": total, "limit": limit, "offset": offset}

@router.post("/upload", dependencies=_WRITE)
async def upload_doc(file: UploadFile = File(...), tags: str = ""):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(400, "Apenas PDFs aceitos")
    data = await file.read()
    if len(data) > _MAX_UPLOAD_BYTES:
        raise HTTPException(413, f"Arquivo excede o limite de {_MAX_UPLOAD_BYTES // (1024*1024)} MB")
    text = await asyncio.to_thread(_extract_pdf_text, data)
    tag_list = [t.strip() for t in tags.split(",") if t.strip()]
    async with DB() as db:
        row = await db.fetchrow("""
            INSERT INTO knowledge_docs (filename, title, content, tags)
            VALUES ($1,$2,$3,$4) RETURNING id, filename, title, tags, created_at
        """, file.filename, file.filename.replace(".pdf",""), text, tag_list)
        return dict(row)

@router.delete("/{doc_id}", dependencies=_WRITE)
async def delete_doc(doc_id: uuid.UUID):
    async with DB() as db:
        await db.execute("DELETE FROM knowledge_docs WHERE id=$1", doc_id)
        return {"ok": True}

@router.get("/search")
async def search_knowledge(q: str, limit: int = Query(default=5, le=50)):
    async with DB() as db:
        rows = await db.fetch("""
            SELECT id, filename, title, tags,
                   LEFT(content, 500) as excerpt,
                   similarity(content, $1) as score
            FROM knowledge_docs WHERE content % $1
            ORDER BY score DESC LIMIT $2
        """, q, limit)
        return [dict(r) for r in rows]
