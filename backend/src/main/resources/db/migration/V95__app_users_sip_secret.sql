-- =============================================================
-- V95 — Secret SIP aleatório por usuário (correção de achado de segurança H1)
--
-- GET /api/v1/users/{id}/extension-password calculava a "senha" do ramal por
-- fórmula previsível: "webrtc" + extensão + "pass". Qualquer pessoa que soubesse
-- o número do ramal deduzia a credencial sem precisar de acesso nenhum ao
-- sistema. Esta coluna guarda um secret aleatório forte, gerado sob demanda
-- (primeira consulta) e persistido — nullable para não quebrar usuários já
-- existentes até serem consultados pela primeira vez.
-- =============================================================

ALTER TABLE app_users ADD COLUMN sip_secret VARCHAR(64);
