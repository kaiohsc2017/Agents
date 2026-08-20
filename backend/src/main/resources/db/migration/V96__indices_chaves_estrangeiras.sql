-- V96: índices B-tree em chaves estrangeiras hoje sem índice — toda consulta
-- e JOIN por esses campos fazia varredura sequencial (achado F1 da auditoria
-- de 2026-08-19). Apenas leitura/performance, sem alteração de dado ou
-- comportamento de aplicação.

CREATE INDEX IF NOT EXISTS idx_number_tests_business_unit_id ON number_tests(business_unit_id);
CREATE INDEX IF NOT EXISTS idx_number_tests_client_id ON number_tests(client_id);
CREATE INDEX IF NOT EXISTS idx_number_tests_operation_id ON number_tests(operation_id);
CREATE INDEX IF NOT EXISTS idx_number_tests_segment_id ON number_tests(segment_id);

CREATE INDEX IF NOT EXISTS idx_numeros_0800_client_id ON numeros_0800(client_id);
CREATE INDEX IF NOT EXISTS idx_numeros_0800_operadora_id ON numeros_0800(operadora_id);

CREATE INDEX IF NOT EXISTS idx_linhas_operation_id ON linhas(operation_id);
CREATE INDEX IF NOT EXISTS idx_linhas_operadora_id ON linhas(operadora_id);

CREATE INDEX IF NOT EXISTS idx_alert_contacts_operation_id ON alert_contacts(operation_id);

CREATE INDEX IF NOT EXISTS idx_alerts_execution_id ON alerts(execution_id);

CREATE INDEX IF NOT EXISTS idx_agents_on_failure_trigger_agent_id ON agents(on_failure_trigger_agent_id);

CREATE INDEX IF NOT EXISTS idx_numero_0800_regenerados_operadora_id ON numero_0800_regenerados(operadora_id);
