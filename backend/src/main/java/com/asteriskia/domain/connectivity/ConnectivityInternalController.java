package com.asteriskia.domain.connectivity;

import java.nio.file.Path;
import java.nio.file.Paths;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * ConnectivityInternalController — Endpoint chamado pelo próprio dialplan do Asterisk
 * (função CURL do contexto {@code asteriskia-test}) para registrar o caminho da gravação
 * feita durante um teste de conectividade do Módulo 2.
 *
 * <p>Protegido por {@code ROLE_INTERNAL} (matcher {@code /api/v1/internal/**} em
 * SecurityConfig, concedido pelo InternalKeyFilter via header {@code X-Internal-Key}) —
 * nenhum JWT de usuário chega aqui.
 *
 * <p>Nunca aceita um caminho arbitrário: o valor precisa estar dentro do diretório de
 * gravações do Asterisk e terminar em {@code .wav}. Sem essa checagem, um caminho vindo
 * do dialplan (ou de qualquer chamador que possua a chave interna) acabaria sendo lido
 * mais tarde pelo motor acústico do agents-api, que abre o arquivo diretamente.
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/internal/connectivity")
@RequiredArgsConstructor
public class ConnectivityInternalController {

    /** Mesmo diretório montado por asterisk e agents-backend (volume agentia_asterisk_recordings). */
    private static final Path RECORDINGS_BASE = Paths.get("/var/spool/asterisk/monitor").normalize();

    private final TestResultRepository testResultRepo;

    /**
     * Registra o WAV gravado durante o teste. Chamado pelo dialplan com
     * {@code CURL(url,testResultId=..&filePath=..)} — a função CURL do Asterisk envia POST
     * form-urlencoded quando recebe um segundo argumento.
     *
     * <p>Responde sempre 200 com um corpo curto: o dialplan não trata erro de CURL, então
     * falhar aqui com 4xx/5xx só produziria uma variável vazia e nenhum diagnóstico.
     */
    @PostMapping("/qos-recording")
    public ResponseEntity<String> registerRecording(
            @RequestParam("testResultId") Long testResultId,
            @RequestParam("filePath") String filePath) {

        if (!isInsideRecordingsDir(filePath)) {
            log.warn("QoS: caminho de gravação rejeitado para testResultId={}", testResultId);
            return ResponseEntity.ok("rejected");
        }

        return testResultRepo
                .findById(testResultId)
                .map(
                        result -> {
                            result.setRecordingPath(filePath);
                            testResultRepo.save(result);
                            log.info("QoS: gravação registrada para testResultId={}", testResultId);
                            return ResponseEntity.ok("ok");
                        })
                .orElseGet(
                        () -> {
                            log.warn("QoS: testResultId={} inexistente ao registrar gravação", testResultId);
                            return ResponseEntity.ok("not-found");
                        });
    }

    /**
     * Só aceita arquivos {@code .wav} contidos no diretório de gravações — barra
     * travessia de diretório ({@code ../}) e qualquer caminho fora do volume.
     */
    private boolean isInsideRecordingsDir(String filePath) {
        if (filePath == null || filePath.isBlank() || !filePath.endsWith(".wav")) {
            return false;
        }
        Path candidate = Paths.get(filePath).normalize();
        return candidate.isAbsolute() && candidate.startsWith(RECORDINGS_BASE);
    }
}
