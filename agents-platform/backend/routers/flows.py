"""
routers/flows.py — Endpoints para o Agent Flow Canvas (Pilar 5)
CRUD de Fluxos Visuais, Disparo Assíncrono e Consulta de Etapas de Execução.
"""
import json
from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from database import DB
from flow_engine import run_flow

router = APIRouter()


class FlowCreate(BaseModel):
    name: str = Field(..., max_length=150)
    description: Optional[str] = None
    is_active: bool = True
    trigger_type: str = "manual"
    trigger_config: Dict[str, Any] = Field(default_factory=dict)
    graph_data: Dict[str, Any] = Field(default_factory=lambda: {"nodes": [], "edges": []})


class FlowUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
    trigger_type: Optional[str] = None
    trigger_config: Optional[Dict[str, Any]] = None
    graph_data: Optional[Dict[str, Any]] = None


class FlowRunRequest(BaseModel):
    trigger_source: str = "manual_ui"
    trigger_data: Optional[Dict[str, Any]] = Field(default_factory=dict)


@router.get("/")
async def list_flows():
    """Lista todos os fluxos de automação cadastrados."""
    async with DB() as conn:
        rows = await conn.fetch(
            """
            SELECT id, name, description, is_active, trigger_type, trigger_config,
                   jsonb_array_length(COALESCE(graph_data->'nodes', '[]'::jsonb)) as node_count,
                   created_at, updated_at, created_by
            FROM agent_flows
            ORDER BY created_at DESC
            """
        )
        return [
            {
                "id": str(r["id"]),
                "name": r["name"],
                "description": r["description"],
                "is_active": r["is_active"],
                "trigger_type": r["trigger_type"],
                "trigger_config": r["trigger_config"] if isinstance(r["trigger_config"], dict) else json.loads(r["trigger_config"] or "{}"),
                "node_count": r["node_count"],
                "created_at": r["created_at"].isoformat() if r["created_at"] else None,
                "updated_at": r["updated_at"].isoformat() if r["updated_at"] else None,
                "created_by": r["created_by"]
            }
            for r in rows
        ]


@router.get("/{flow_id}")
async def get_flow(flow_id: UUID):
    """Retorna os dados completos do fluxo, incluindo o grafo visual (nodes e edges)."""
    async with DB() as conn:
        row = await conn.fetchrow(
            """
            SELECT id, name, description, is_active, trigger_type, trigger_config, graph_data,
                   created_at, updated_at, created_by
            FROM agent_flows
            WHERE id = $1
            """,
            flow_id
        )
        if not row:
            raise HTTPException(status_code=404, detail="Fluxo não encontrado.")

        graph_data = row["graph_data"]
        if isinstance(graph_data, str):
            graph_data = json.loads(graph_data)

        trigger_config = row["trigger_config"]
        if isinstance(trigger_config, str):
            trigger_config = json.loads(trigger_config)

        return {
            "id": str(row["id"]),
            "name": row["name"],
            "description": row["description"],
            "is_active": row["is_active"],
            "trigger_type": row["trigger_type"],
            "trigger_config": trigger_config or {},
            "graph_data": graph_data or {"nodes": [], "edges": []},
            "created_at": row["created_at"].isoformat() if row["created_at"] else None,
            "updated_at": row["updated_at"].isoformat() if row["updated_at"] else None,
            "created_by": row["created_by"]
        }


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_flow(req: FlowCreate):
    """Cria um novo fluxo visual de agentes."""
    async with DB() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO agent_flows (name, description, is_active, trigger_type, trigger_config, graph_data, created_by)
            VALUES ($1, $2, $3, $4, $5, $6, 'admin')
            RETURNING id, name, created_at
            """,
            req.name, req.description, req.is_active, req.trigger_type,
            json.dumps(req.trigger_config), json.dumps(req.graph_data)
        )
        return {"id": str(row["id"]), "name": row["name"], "created_at": row["created_at"].isoformat()}


@router.put("/{flow_id}")
async def update_flow(flow_id: UUID, req: FlowUpdate):
    """Atualiza metadados ou o grafo visual de um fluxo."""
    async with DB() as conn:
        # Checa existência
        exists = await conn.fetchval("SELECT 1 FROM agent_flows WHERE id = $1", flow_id)
        if not exists:
            raise HTTPException(status_code=404, detail="Fluxo não encontrado.")

        sets = []
        vals = []
        idx = 1

        if req.name is not None:
            sets.append(f"name = ${idx}")
            vals.append(req.name)
            idx += 1
        if req.description is not None:
            sets.append(f"description = ${idx}")
            vals.append(req.description)
            idx += 1
        if req.is_active is not None:
            sets.append(f"is_active = ${idx}")
            vals.append(req.is_active)
            idx += 1
        if req.trigger_type is not None:
            sets.append(f"trigger_type = ${idx}")
            vals.append(req.trigger_type)
            idx += 1
        if req.trigger_config is not None:
            sets.append(f"trigger_config = ${idx}")
            vals.append(json.dumps(req.trigger_config))
            idx += 1
        if req.graph_data is not None:
            sets.append(f"graph_data = ${idx}")
            vals.append(json.dumps(req.graph_data))
            idx += 1

        if not sets:
            return {"status": "no_change"}

        sets.append("updated_at = NOW()")
        vals.append(flow_id)

        query = f"UPDATE agent_flows SET {', '.join(sets)} WHERE id = ${idx}"
        await conn.execute(query, *vals)

        return {"status": "updated", "id": str(flow_id)}


@router.delete("/{flow_id}")
async def delete_flow(flow_id: UUID):
    """Remove um fluxo e seu histórico de execuções."""
    async with DB() as conn:
        deleted = await conn.execute("DELETE FROM agent_flows WHERE id = $1", flow_id)
        if deleted == "DELETE 0":
            raise HTTPException(status_code=404, detail="Fluxo não encontrado.")
        return {"status": "deleted", "id": str(flow_id)}


@router.post("/{flow_id}/run")
async def run_flow_endpoint(flow_id: UUID, req: Optional[FlowRunRequest] = None):
    """Dispara a execução assíncrona imediata do fluxo."""
    trigger_src = req.trigger_source if req else "manual_ui"
    trigger_dt = req.trigger_data if req else {}

    try:
        exec_id = await run_flow(flow_id, trigger_source=trigger_src, trigger_data=trigger_dt)
        return {"status": "executed", "execution_id": str(exec_id), "flow_id": str(flow_id)}
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao executar fluxo: {e}")


@router.get("/{flow_id}/executions")
async def list_flow_executions(flow_id: UUID):
    """Lista as execuções recentes de um fluxo específico."""
    async with DB() as conn:
        rows = await conn.fetch(
            """
            SELECT id, flow_id, flow_name, trigger_source, status, started_at, finished_at,
                   duration_s, error_message
            FROM flow_executions
            WHERE flow_id = $1
            ORDER BY started_at DESC
            LIMIT 50
            """,
            flow_id
        )
        return [
            {
                "id": str(r["id"]),
                "flow_id": str(r["flow_id"]),
                "flow_name": r["flow_name"],
                "trigger_source": r["trigger_source"],
                "status": r["status"],
                "started_at": r["started_at"].isoformat() if r["started_at"] else None,
                "finished_at": r["finished_at"].isoformat() if r["finished_at"] else None,
                "duration_s": float(r["duration_s"]) if r["duration_s"] else None,
                "error_message": r["error_message"]
            }
            for r in rows
        ]


@router.get("/executions/{exec_id}/details")
async def get_execution_details(exec_id: UUID):
    """Retorna detalhes da execução de um fluxo com o passo-a-passo de cada nó."""
    async with DB() as conn:
        exec_row = await conn.fetchrow(
            """
            SELECT id, flow_id, flow_name, trigger_source, status, started_at, finished_at,
                   duration_s, execution_context, error_message
            FROM flow_executions
            WHERE id = $1
            """,
            exec_id
        )
        if not exec_row:
            raise HTTPException(status_code=404, detail="Execução não encontrada.")

        step_rows = await conn.fetch(
            """
            SELECT id, node_id, node_type, node_name, status, input_payload, output_payload,
                   duration_ms, started_at, finished_at
            FROM flow_execution_steps
            WHERE execution_id = $1
            ORDER BY started_at ASC
            """,
            exec_id
        )

        steps = []
        for s in step_rows:
            inp = s["input_payload"]
            outp = s["output_payload"]
            if isinstance(inp, str):
                inp = json.loads(inp)
            if isinstance(outp, str):
                outp = json.loads(outp)

            steps.append({
                "id": str(s["id"]),
                "node_id": s["node_id"],
                "node_type": s["node_type"],
                "node_name": s["node_name"],
                "status": s["status"],
                "input_payload": inp,
                "output_payload": outp,
                "duration_ms": s["duration_ms"],
                "started_at": s["started_at"].isoformat() if s["started_at"] else None,
                "finished_at": s["finished_at"].isoformat() if s["finished_at"] else None
            })

        ctx = exec_row["execution_context"]
        if isinstance(ctx, str):
            ctx = json.loads(ctx)

        return {
            "execution": {
                "id": str(exec_row["id"]),
                "flow_id": str(exec_row["flow_id"]),
                "flow_name": exec_row["flow_name"],
                "trigger_source": exec_row["trigger_source"],
                "status": exec_row["status"],
                "started_at": exec_row["started_at"].isoformat() if exec_row["started_at"] else None,
                "finished_at": exec_row["finished_at"].isoformat() if exec_row["finished_at"] else None,
                "duration_s": float(exec_row["duration_s"]) if exec_row["duration_s"] else None,
                "error_message": exec_row["error_message"],
                "context": ctx
            },
            "steps": steps
        }
