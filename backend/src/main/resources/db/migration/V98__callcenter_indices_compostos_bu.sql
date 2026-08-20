-- =============================================================
-- V98 — Índices compostos para os filtros combinados mais comuns do
-- domínio Call Center (M11/M13 da auditoria de 2026-08-20).
--
-- Correção pós-deploy (2026-08-20): a primeira versão desta migration
-- assumia que cc_interactions/cc_chat_sessions existiam fisicamente por
-- estarem registradas como "success=true" em flyway_schema_history
-- (versões V50/V56) — mas o deploy real mostrou "relation cc_interactions
-- does not exist". Este banco herdou o histórico do Flyway de um
-- ecossistema maior (ver CLAUDE.md — segmentação AgentIA/VoipIA, E2 da
-- auditoria de infra) sem as tabelas físicas do domínio Call Center terem
-- sido efetivamente criadas/mantidas nesta instância. Reescrita para ser
-- defensiva: só cria os índices se as tabelas existirem de fato, nunca
-- falha o boot por isso. Nomes de coluna (para quando/se essas tabelas
-- existirem): cc_interactions.queued_at, cc_chat_sessions.started_at.
-- =============================================================

DO $$
BEGIN
    IF to_regclass('public.cc_interactions') IS NOT NULL THEN
        CREATE INDEX IF NOT EXISTS idx_cc_interactions_bu_queued_at
            ON cc_interactions(business_unit_id, queued_at);
    END IF;

    IF to_regclass('public.cc_chat_sessions') IS NOT NULL THEN
        CREATE INDEX IF NOT EXISTS idx_cc_chat_sessions_bu_started_at
            ON cc_chat_sessions(business_unit_id, started_at);
    END IF;
END $$;
