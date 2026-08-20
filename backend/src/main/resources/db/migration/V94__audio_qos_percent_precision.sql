-- =============================================================
-- V94 — Precisão das colunas percentuais de Audio QoS
--
-- Bug encontrado ao medir uma gravação real de "linha muda" (chamada atendida
-- sem transporte de mídia RTP — justamente o caso de uso que o motor acústico
-- existe para detectar): silence_pct = 100.00 não cabe em numeric(4,2), cujo
-- máximo é 99.99, e o INSERT falhava com "numeric field overflow" (HTTP 500).
-- clipping_pct e packet_loss_pct têm o mesmo teto e o mesmo domínio [0,100].
--
-- O motor também passou a clampar os valores antes de persistir (defesa nos
-- dois lados, mesmo padrão adotado no overflow de call_insights.aderencia_script).
-- =============================================================

ALTER TABLE audio_qos_metrics
    ALTER COLUMN silence_pct     TYPE NUMERIC(5,2),
    ALTER COLUMN clipping_pct    TYPE NUMERIC(5,2),
    ALTER COLUMN packet_loss_pct TYPE NUMERIC(5,2);

-- Um caminho de gravação mais longo que 255 caracteres estourava o INSERT;
-- test_results.recording_path (V93) já usa 500.
ALTER TABLE audio_qos_metrics
    ALTER COLUMN recording_path TYPE VARCHAR(500);
