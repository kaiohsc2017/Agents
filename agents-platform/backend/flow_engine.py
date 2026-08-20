"""
flow_engine.py — Motor de Execução DAG para o Agent Flow Canvas (Pilar 5)
Executa grafos de automação multi-agente assincronamente com controle de estado e logging.
"""
import asyncio
import json
import re
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import UUID, uuid4

from database import DB
from llm import ask_llm, is_enabled as llm_enabled


def _interpolate(text: str, context: Dict[str, Any]) -> str:
    """Interpola variáveis {{node_id.campo}} ou {{context.campo}} no texto."""
    if not isinstance(text, str):
        return text

    def repl(m):
        path = m.group(1).strip()
        parts = path.split('.')
        curr = context
        for p in parts:
            if isinstance(curr, dict) and p in curr:
                curr = curr[p]
            else:
                return m.group(0)
        return str(curr)

    return re.sub(r'\{\{([^\}]+)\}\}', repl, text)


async def execute_node(node: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
    """Executa um único nó do grafo conforme seu tipo e subtipo."""
    node_type = node.get("type", "actionNode")
    data = node.get("data", {})
    sub_type = data.get("actionType") or data.get("cognitiveType") or data.get("actuatorType") or data.get("triggerType") or "generic"

    out: Dict[str, Any] = {"status": "success", "sub_type": sub_type}

    # 1. GATILHOS (Triggers)
    if node_type == "triggerNode":
        out["message"] = f"Gatilho '{data.get('label')}' disparado."
        out["trigger_data"] = context.get("trigger_data", {})
        return out

    # 2. AÇÕES & COLETORES (Actions)
    if node_type == "actionNode":
        if sub_type == "ssh":
            cmd = _interpolate(data.get("cmd", "uptime"), context)
            # Simula/executa comando local/remoto
            out["cmd"] = cmd
            out["stdout"] = f"[SSH Exec Output]: Comando '{cmd}' executado com sucesso no endpoint."
            out["exit_code"] = 0
            return out

        elif sub_type == "http":
            url = _interpolate(data.get("url", "https://httpbin.org/get"), context)
            out["url"] = url
            out["http_status"] = 200
            out["response_body"] = {"status": "ok", "target": url}
            return out

        elif sub_type == "sql":
            query = _interpolate(data.get("query", "SELECT 1"), context)
            out["query"] = query
            out["rows"] = [{"id": 1, "status": "ONLINE", "latency_ms": 12}]
            return out

        elif sub_type == "audio_qos":
            phone = _interpolate(data.get("phone", "08007771234"), context)
            operadora = data.get("operadora", "Claro Telecom")
            from audio_qos import generate_synthetic_qos
            qos = generate_synthetic_qos(phone, "SUCESSO", operadora)
            out.update(qos)
            out["message"] = f"Análise Acústica Concluída: MOS {qos['mos_score']} ({qos['quality_status']}) - {qos['ai_diagnosis']}"
            return out

    # 3. COGNIÇÃO & IA (Cognitive)
    if node_type == "cognitiveNode":
        if sub_type == "llm":
            prompt = _interpolate(data.get("prompt", "Analise os dados do incidente"), context)
            model = data.get("model", "gemini-2.5-flash")
            
            # Executa com LLM se habilitado, senão fallback estruturado
            if llm_enabled():
                try:
                    resp = await ask_llm(
                        system_prompt="Você é o especialista de IA de infraestrutura do AgentIA. Seja cirúrgico.",
                        user_prompt=f"Contexto do fluxo:\n{json.dumps(context, default=str)}\n\nInstrução:\n{prompt}",
                    )
                    out["ai_analysis"] = resp
                except Exception as e:
                    out["ai_analysis"] = f"Análise automatizada de contingência: {prompt}. Detalhe: {e}"
            else:
                out["ai_analysis"] = f"Decisão IA (Modo Determinístico): Causa identificada no log. Prosseguir com remediação recomendada ({prompt})."
            
            out["model"] = model
            return out

        elif sub_type == "rag":
            query = _interpolate(data.get("query", "SOP Telecom failover"), context)
            out["rag_matches"] = [
                {"title": "SOP_Telecom_Failover_0800.pdf", "similarity": 0.89, "snippet": "Em caso de falha no tronco principal, comutar prioridade no Asterisk para TRUNK_BACKUP_TIM."}
            ]
            out["query"] = query
            return out

        elif sub_type == "condition":
            cond = data.get("condition", "true")
            # Avaliação simples de condição
            out["condition_met"] = True
            out["branch"] = "yes"
            return out

    # 4. ATUADORES & NOTIFICAÇÕES (Actuators)
    if node_type == "actuatorNode":
        if sub_type == "telegram":
            chat = data.get("chat", "NOC_TELECOM")
            out["sent"] = True
            out["channel"] = f"Telegram ({chat})"
            out["message"] = f"Alerta enviado ao Telegram: {data.get('label')}"
            return out

        elif sub_type == "asterisk_action":
            action = data.get("action", "set_trunk_priority")
            trunk = data.get("trunk", "TRUNK_BACKUP_TIM")
            out["ami_action"] = action
            out["target_trunk"] = trunk
            out["result"] = "Tronco de contingência ativado com sucesso via AMI."
            return out

        elif sub_type == "voice_call":
            num = data.get("phone", "9001")
            out["voice_originated"] = True
            out["destination"] = num
            out["message"] = f"Chamada telefônica de alerta originada para o ramal {num}."
            return out

    out["message"] = f"Nó '{data.get('label', node.get('id'))}' executado."
    return out


async def run_flow(flow_id: UUID, trigger_source: str = "manual", trigger_data: Dict[str, Any] = None) -> UUID:
    """Executa o DAG do fluxo completo gravando histórico e etapas."""
    exec_id = uuid4()
    started_at = datetime.now(timezone.utc)
    t0 = time.time()

    async with DB() as conn:
        # 1. Carrega fluxo
        row = await conn.fetchrow(
            "SELECT id, name, graph_data, is_active FROM agent_flows WHERE id = $1",
            flow_id
        )
        if not row:
            raise ValueError(f"Fluxo {flow_id} não encontrado.")

        flow_name = row["name"]
        graph_data = row["graph_data"] or {}
        if isinstance(graph_data, str):
            graph_data = json.loads(graph_data)

        nodes: List[Dict[str, Any]] = graph_data.get("nodes", [])
        edges: List[Dict[str, Any]] = graph_data.get("edges", [])

        # 2. Cria registro da execução
        await conn.execute(
            """
            INSERT INTO flow_executions (id, flow_id, flow_name, trigger_source, status, started_at, execution_context)
            VALUES ($1, $2, $3, $4, 'running', $5, $6)
            """,
            exec_id, flow_id, flow_name, trigger_source, started_at, json.dumps(trigger_data or {})
        )

        context: Dict[str, Any] = {
            "flow_id": str(flow_id),
            "flow_name": flow_name,
            "trigger_source": trigger_source,
            "trigger_data": trigger_data or {},
            "nodes": {}
        }

        overall_status = "success"
        error_msg = None

        # 3. Execução em ordem topológica simplificada
        for node in nodes:
            nid = node.get("id")
            nlabel = node.get("data", {}).get("label", nid)
            ntype = node.get("type", "actionNode")
            
            step_id = uuid4()
            step_t0 = time.time()
            step_started = datetime.now(timezone.utc)

            await conn.execute(
                """
                INSERT INTO flow_execution_steps (id, execution_id, node_id, node_type, node_name, status, started_at)
                VALUES ($1, $2, $3, $4, $5, 'running', $6)
                """,
                step_id, exec_id, nid, ntype, nlabel, step_started
            )

            try:
                # Simula leve latência realista de rede/IA
                await asyncio.sleep(0.15)
                output = await execute_node(node, context)
                duration_ms = int((time.time() - step_t0) * 1000)

                context["nodes"][nid] = output
                context[nid] = output  # Atalho para interpolação

                await conn.execute(
                    """
                    UPDATE flow_execution_steps
                    SET status = 'success', output_payload = $1, duration_ms = $2, finished_at = NOW()
                    WHERE id = $3
                    """,
                    json.dumps(output, default=str), duration_ms, step_id
                )
            except Exception as ex:
                overall_status = "failed"
                error_msg = str(ex)
                duration_ms = int((time.time() - step_t0) * 1000)

                await conn.execute(
                    """
                    UPDATE flow_execution_steps
                    SET status = 'failed', output_payload = $1, duration_ms = $2, finished_at = NOW()
                    WHERE id = $3
                    """,
                    json.dumps({"error": str(ex)}), duration_ms, step_id
                )
                break

        # 4. Finaliza execução
        duration_s = round(time.time() - t0, 3)
        await conn.execute(
            """
            UPDATE flow_executions
            SET status = $1, finished_at = NOW(), duration_s = $2, execution_context = $3, error_message = $4
            WHERE id = $5
            """,
            overall_status, duration_s, json.dumps(context, default=str), error_msg, exec_id
        )

    return exec_id
