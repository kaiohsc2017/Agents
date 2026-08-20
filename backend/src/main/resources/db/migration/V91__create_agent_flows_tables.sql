-- =============================================================================
-- V91 — Agent Flow Canvas (Orquestrador Visual Multi-Agente & DAG Engine)
-- =============================================================================

CREATE TABLE IF NOT EXISTS agent_flows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    trigger_type VARCHAR(50) NOT NULL DEFAULT 'manual', -- 'manual', 'cron', 'telecom_alert', 'zabbix', 'webhook'
    trigger_config JSONB NOT NULL DEFAULT '{}',
    graph_data JSONB NOT NULL DEFAULT '{"nodes": [], "edges": []}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_by VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS flow_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flow_id UUID NOT NULL REFERENCES agent_flows(id) ON DELETE CASCADE,
    flow_name VARCHAR(150) NOT NULL,
    trigger_source VARCHAR(100) NOT NULL DEFAULT 'manual',
    status VARCHAR(30) NOT NULL DEFAULT 'running', -- 'running', 'success', 'failed', 'partial'
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMP WITH TIME ZONE,
    duration_s NUMERIC(10,3),
    execution_context JSONB DEFAULT '{}',
    error_message TEXT
);

CREATE TABLE IF NOT EXISTS flow_execution_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    execution_id UUID NOT NULL REFERENCES flow_executions(id) ON DELETE CASCADE,
    node_id VARCHAR(100) NOT NULL,
    node_type VARCHAR(50) NOT NULL,
    node_name VARCHAR(150),
    status VARCHAR(30) NOT NULL DEFAULT 'pending', -- 'pending', 'running', 'success', 'failed', 'skipped'
    input_payload JSONB,
    output_payload JSONB,
    duration_ms INTEGER,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_flow_executions_flow_id ON flow_executions(flow_id);
CREATE INDEX IF NOT EXISTS idx_flow_executions_started ON flow_executions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_flow_exec_steps_exec_id ON flow_execution_steps(execution_id);

-- Seed de Fluxo Modelo Pré-Configurado: Auto-Remediação de Telecom com IA & RAG
INSERT INTO agent_flows (id, name, description, is_active, trigger_type, trigger_config, graph_data, created_by)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'Auto-Remediação de Tronco SIP & 0800',
    'Fluxo autônomo que monitora falhas de rotas SIP, consulta SOPs via RAG, comuta tronco de contingência e notifica equipe no Telegram.',
    true,
    'telecom_alert',
    '{"severity": "CRITICAL", "consecutive_failures": 2}',
    '{
      "nodes": [
        {
          "id": "node_trigger",
          "type": "triggerNode",
          "position": { "x": 100, "y": 200 },
          "data": { "label": "Falha em Teste 0800", "triggerType": "telecom_alert", "subtext": "Módulo 2 (Status != SUCESSO)" }
        },
        {
          "id": "node_ssh",
          "type": "actionNode",
          "position": { "x": 400, "y": 100 },
          "data": { "label": "Diagnóstico PJSIP Asterisk", "actionType": "ssh", "cmd": "asterisk -rx \"pjsip show endpoints\" | grep -E \"(claro|vivo|tim)\"", "subtext": "Verifica canais SIP ativos" }
        },
        {
          "id": "node_rag",
          "type": "cognitiveNode",
          "position": { "x": 400, "y": 300 },
          "data": { "label": "Consulta SOP Telecom (RAG)", "cognitiveType": "rag", "query": "procedimento failover operadora claro tronco sip", "subtext": "pgvector embeddings" }
        },
        {
          "id": "node_ai",
          "type": "cognitiveNode",
          "position": { "x": 750, "y": 200 },
          "data": { "label": "Raciocínio IA (Gemini 2.5)", "cognitiveType": "llm", "model": "gemini-2.5-flash", "prompt": "Avalie o output do Asterisk e o SOP para decidir se comuta a rota.", "subtext": "Decisão Autônoma" }
        },
        {
          "id": "node_telegram",
          "type": "actuatorNode",
          "position": { "x": 1100, "y": 100 },
          "data": { "label": "Alerta Telegram Plantão", "actuatorType": "telegram", "chat": "NOC_TELECOM", "subtext": "Notifica com log do incidente" }
        },
        {
          "id": "node_remediation",
          "type": "actuatorNode",
          "position": { "x": 1100, "y": 300 },
          "data": { "label": "Comutar Rota no Asterisk", "actuatorType": "asterisk_action", "action": "set_trunk_priority", "trunk": "TRUNK_BACKUP_TIM", "subtext": "Self-Healing via AMI" }
        }
      ],
      "edges": [
        { "id": "e_trig_ssh", "source": "node_trigger", "target": "node_ssh", "animated": true },
        { "id": "e_trig_rag", "source": "node_trigger", "target": "node_rag", "animated": true },
        { "id": "e_ssh_ai", "source": "node_ssh", "target": "node_ai" },
        { "id": "e_rag_ai", "source": "node_rag", "target": "node_ai" },
        { "id": "e_ai_tel", "source": "node_ai", "target": "node_telegram" },
        { "id": "e_ai_rem", "source": "node_ai", "target": "node_remediation" }
      ]
    }',
    'admin'
) ON CONFLICT (id) DO NOTHING;

-- Garante permissão agents.flows em todos os grupos de acesso
INSERT INTO access_group_permissions (group_id, resource_key, can_read, can_write)
SELECT id, 'agents.flows', true, true FROM access_groups
ON CONFLICT (group_id, resource_key) DO UPDATE SET can_read = true, can_write = true;
