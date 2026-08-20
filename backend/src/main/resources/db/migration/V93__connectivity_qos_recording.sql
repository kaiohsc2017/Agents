-- =============================================================
-- V93 — Caminho da gravação real do teste de conectividade (Módulo 2)
--
-- Até a V92 as métricas de Audio QoS eram sempre sintéticas
-- (generate_synthetic_qos): o contexto 'asteriskia-test' do dialplan não
-- atendia nem gravava a chamada, então nunca existiu um WAV para analisar.
--
-- A partir daqui o dialplan grava uma amostra do áudio recebido e registra o
-- caminho via POST /api/v1/internal/connectivity/qos-recording; o motor
-- acústico (analyze_wav_file) passa a medir esse arquivo de verdade.
-- =============================================================

-- Caminho do WAV gravado pelo MixMonitor durante o teste de conectividade.
-- NULL = teste sem gravação (execução anterior a esta migration, chamada não
-- atendida, ou gravação desabilitada) — nesse caso a análise cai no sintético.
ALTER TABLE test_results
    ADD COLUMN IF NOT EXISTS recording_path VARCHAR(500);

COMMENT ON COLUMN test_results.recording_path IS
    'Caminho absoluto do WAV gravado pelo MixMonitor no volume agentia_asterisk_recordings. NULL quando não houve gravação.';

-- Origem da métrica: medição acústica de um WAV real ou estimativa sintética.
-- Todas as linhas existentes são sintéticas (o caminho real não existia ainda).
ALTER TABLE audio_qos_metrics
    ADD COLUMN IF NOT EXISTS data_source VARCHAR(12) NOT NULL DEFAULT 'synthetic';

ALTER TABLE audio_qos_metrics
    DROP CONSTRAINT IF EXISTS audio_qos_metrics_data_source_check;

ALTER TABLE audio_qos_metrics
    ADD CONSTRAINT audio_qos_metrics_data_source_check
    CHECK (data_source IN ('real', 'synthetic'));

COMMENT ON COLUMN audio_qos_metrics.data_source IS
    'real = MOS/jitter/ruído medidos de um WAV gravado; synthetic = estimativa determinística para histórico/benchmark.';

CREATE INDEX IF NOT EXISTS idx_audio_qos_data_source ON audio_qos_metrics (data_source);
