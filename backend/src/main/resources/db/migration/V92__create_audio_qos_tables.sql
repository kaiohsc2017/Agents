-- =============================================================================
-- V92__create_audio_qos_tables.sql — Audio QoS & MOS Preditivo (IA Acústica)
-- Tabela para persistência de métricas ITU-T P.800/G.107, jitter, ruído, waveform e laudo de IA
-- =============================================================================

CREATE TABLE IF NOT EXISTS audio_qos_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_result_id BIGINT REFERENCES test_results(id) ON DELETE CASCADE,
    phone_number VARCHAR(30) NOT NULL,
    operadora_name VARCHAR(100) DEFAULT 'Padrão',
    recording_path VARCHAR(255),
    mos_score NUMERIC(3,2) NOT NULL DEFAULT 4.20,
    jitter_ms NUMERIC(5,2) NOT NULL DEFAULT 1.80,
    packet_loss_pct NUMERIC(4,2) NOT NULL DEFAULT 0.00,
    noise_db NUMERIC(5,2) NOT NULL DEFAULT -62.50,
    clipping_pct NUMERIC(4,2) NOT NULL DEFAULT 0.00,
    silence_pct NUMERIC(4,2) NOT NULL DEFAULT 5.00,
    quality_status VARCHAR(30) NOT NULL DEFAULT 'EXCELLENT',
    ai_diagnosis TEXT,
    waveform_data JSONB DEFAULT '[20, 35, 60, 85, 95, 75, 50, 65, 80, 90, 85, 70, 45, 30, 55, 70, 85, 60, 40, 25, 50, 75, 90, 80, 60, 40, 30, 20]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audio_qos_test_id ON audio_qos_metrics(test_result_id);
CREATE INDEX IF NOT EXISTS idx_audio_qos_phone ON audio_qos_metrics(phone_number);
CREATE INDEX IF NOT EXISTS idx_audio_qos_status ON audio_qos_metrics(quality_status);
CREATE INDEX IF NOT EXISTS idx_audio_qos_created ON audio_qos_metrics(created_at DESC);

-- Permissão para visualizar métricas de QoS
INSERT INTO access_group_permissions (group_id, resource_key, can_read, can_write)
SELECT id, 'telecom.qos', true, true FROM access_groups WHERE id IN (1, 2)
ON CONFLICT DO NOTHING;

-- Seed inicial de métricas de QoS vinculadas aos últimos resultados de testes existentes
INSERT INTO audio_qos_metrics (test_result_id, phone_number, operadora_name, mos_score, jitter_ms, packet_loss_pct, noise_db, quality_status, ai_diagnosis, created_at)
SELECT 
    tr.id,
    COALESCE(nt.phone_number, '08007771234'),
    CASE (tr.id % 3)
        WHEN 0 THEN 'Claro Telecom'
        WHEN 1 THEN 'Vivo / Telefônica'
        ELSE 'TIM Brasil'
    END,
    CASE 
        WHEN tr.status = 'SUCESSO' THEN ROUND((4.10 + (random() * 0.35))::numeric, 2)
        WHEN tr.status = 'OCUPADO' THEN ROUND((3.20 + (random() * 0.40))::numeric, 2)
        ELSE ROUND((1.80 + (random() * 0.80))::numeric, 2)
    END,
    ROUND((1.20 + (random() * 3.5))::numeric, 2),
    CASE WHEN tr.status = 'SUCESSO' THEN 0.00 ELSE ROUND((random() * 4.5)::numeric, 2) END,
    ROUND((-68.0 + (random() * 15.0))::numeric, 2),
    CASE 
        WHEN tr.status = 'SUCESSO' THEN 'EXCELLENT'
        WHEN tr.status = 'OCUPADO' THEN 'FAIR'
        ELSE 'DEGRADED'
    END,
    CASE 
        WHEN tr.status = 'SUCESSO' THEN 'Voz nítida com excelente inteligibilidade e baixo nível de ruído de fundo. Canais de áudio em conformidade com ITU-T P.800.'
        WHEN tr.status = 'OCUPADO' THEN 'Tom de ocupado detectado com sinalização acústica clara sem distorções de rede.'
        ELSE 'Degradação acústica detectada: ruído de canal elevado e perda de integridade espectral.'
    END,
    COALESCE(tr.executed_at, NOW())
FROM test_results tr
LEFT JOIN number_tests nt ON tr.number_test_id = nt.id
WHERE NOT EXISTS (SELECT 1 FROM audio_qos_metrics aq WHERE aq.test_result_id = tr.id)
LIMIT 100;
