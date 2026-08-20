-- =============================================================
-- V98 — Índices compostos para os filtros combinados mais comuns do
-- domínio Call Center (M11/M13 da auditoria de 2026-08-20).
--
-- Nota de contexto: a auditoria de 19/08 (G1/G2) registrou dúvida sobre se
-- o domínio "Call Center" (tabelas cc_*) tem código Java vivo nesta stack —
-- confirmado nesta sessão que as tabelas cc_interactions/cc_chat_sessions
-- EXISTEM de fato no schema (migrations V50/V56), mesmo sem nenhuma classe
-- Java sob com.asteriskia.domain.callcenter neste checkout. Os índices
-- abaixo são seguros de qualquer forma — melhoram qualquer consulta futura
-- (Java, relatório ad-hoc, ou reativação do domínio) filtrando por BU e
-- ordenando/filtrando por data, sem alterar nenhum comportamento de escrita.
--
-- Nomes de coluna confirmados lendo as migrations de criação das tabelas:
-- cc_interactions.queued_at (V50), cc_chat_sessions.started_at (V56) — a
-- tarefa original citava "created_at" para cc_chat_sessions, mas essa
-- coluna não existe nessa tabela; o equivalente real é started_at.
-- =============================================================

CREATE INDEX IF NOT EXISTS idx_cc_interactions_bu_queued_at
    ON cc_interactions(business_unit_id, queued_at);

CREATE INDEX IF NOT EXISTS idx_cc_chat_sessions_bu_started_at
    ON cc_chat_sessions(business_unit_id, started_at);
