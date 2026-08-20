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
            # Auditoria 2026-08-19 (achado A1): este nó fabricava um "sucesso" fictício
            # sem executar nenhum comando SSH real. Não há executor SSH implementado
            # nesta instalação — falha explicitamente em vez de mentir no histórico.
            raise NotImplementedError(
                f"Nó do tipo 'ssh' ainda não está implementado nesta instalação — "
                f"nenhum comando foi executado (comando solicitado: '{cmd}')."
            )

        elif sub_type == "http":
            url = _interpolate(data.get("url", "https://httpbin.org/get"), context)
            # Auditoria 2026-08-19 (achado A1): este nó fabricava HTTP 200 fictício
            # sem fazer nenhuma requisição real. Falha explicitamente.
            raise NotImplementedError(
                f"Nó do tipo 'http' ainda não está implementado nesta instalação — "
                f"nenhuma requisição foi feita (URL solicitada: '{url}')."
            )

        elif sub_type == "sql":
            query = _interpolate(data.get("query", "SELECT 1"), context)
            # Auditoria 2026-08-19 (achado A1): este nó fabricava linhas fictícias
            # sem executar nenhuma consulta real. Falha explicitamente.
            raise NotImplementedError(
                f"Nó do tipo 'sql' ainda não está implementado nesta instalação — "
                f"nenhuma consulta foi executada (query solicitada: '{query}')."
            )

        elif sub_type == "audio_qos":
            phone = _interpolate(data.get("phone", "08007771234"), context)
            operadora = data.get("operadora", "Claro Telecom")
            # Mede a gravação real do teste de conectividade mais recente do número
            # (V93); sem gravação disponível, cai na estimativa sintética — o nó sempre
            # informa qual dos dois foi usado em data_source.
            from routers.audio_qos import _latest_recording_for_phone, _measure

            async with DB() as conn:
                recording = await _latest_recording_for_phone(conn, phone)
            qos, source = _measure(recording, phone, "SUCESSO", operadora)
            out.update(qos)
            out["data_source"] = source
            out["recording_path"] = recording
            origem = "medição real" if source == "real" else "estimativa (sem gravação)"
            out["message"] = f"Análise Acústica Concluída [{origem}]: MOS {qos['mos_score']} ({qos['quality_status']}) - {qos['ai_diagnosis']}"
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
            # Auditoria 2026-08-19 (achado M5, mesma classe do achado A1): este nó
            # fabricava sempre o mesmo trecho fixo de "SOP_Telecom_Failover_0800.pdf"
            # como se fosse uma busca vetorial real na base de conhecimento — não há
            # busca RAG real implementada nesta instalação. Falha explicitamente.
            raise NotImplementedError(
                f"Nó do tipo 'rag' ainda não está implementado nesta instalação — "
                f"nenhuma decisão real foi tomada (consulta solicitada: '{query}')."
            )

        elif sub_type == "condition":
            cond = data.get("condition", "true")
            # Auditoria 2026-08-19 (achado M5, mesma classe do achado A1): este nó
            # fabricava sempre condition_met=True/branch='yes', sem avaliar a
            # condição de verdade. Falha explicitamente em vez de mentir no
            # histórico e derrubar um branch de fluxo indevidamente.
            raise NotImplementedError(
                f"Nó do tipo 'condition' ainda não está implementado nesta "
                f"instalação — nenhuma decisão real foi tomada (condição "
                f"solicitada: '{cond}')."
            )

    # 4. ATUADORES & NOTIFICAÇÕES (Actuators)
    if node_type == "actuatorNode":
        if sub_type == "telegram":
            chat = data.get("chat", "NOC_TELECOM")
            # Auditoria 2026-08-19 (achado A1): este nó fabricava "enviado com sucesso"
            # sem chamar a API do Telegram de verdade. Falha explicitamente.
            raise NotImplementedError(
                f"Nó do tipo 'telegram' ainda não está implementado nesta instalação — "
                f"nenhuma mensagem foi enviada (chat de destino solicitado: '{chat}')."
            )

        elif sub_type == "asterisk_action":
            action = data.get("action", "set_trunk_priority")
            trunk = data.get("trunk", "TRUNK_BACKUP_TIM")
            # Auditoria 2026-08-19 (achado A1): este nó fabricava "tronco de contingência
            # ativado via AMI" sem emitir nenhuma ação AMI real no Asterisk — o chamado
            # "Auto-Cura" do Flow Canvas nunca comutou tronco algum de verdade nesta
            # instalação. Falha explicitamente.
            raise NotImplementedError(
                f"Nó do tipo 'asterisk_action' ainda não está implementado nesta "
                f"instalação — nenhuma ação AMI foi executada (ação '{action}', "
                f"tronco '{trunk}')."
            )

        elif sub_type == "voice_call":
            num = data.get("phone", "9001")
            # Auditoria 2026-08-19 (achado A1): este nó fabricava "chamada originada"
            # sem originar nenhuma ligação real via AMI/Asterisk. Falha explicitamente.
            raise NotImplementedError(
                f"Nó do tipo 'voice_call' ainda não está implementado nesta instalação "
                f"— nenhuma chamada foi originada (destino solicitado: '{num}')."
            )

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
