package com.asteriskia.domain.connectivity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

/**
 * Testes do endpoint interno que registra a gravação do teste de conectividade (Audio QoS,
 * V93). O foco é o guard de caminho: o valor gravado aqui é aberto mais tarde pelo motor
 * acústico do agents-api, então um caminho fora do diretório de gravações não pode ser
 * persistido.
 */
class ConnectivityInternalControllerTest {

    private TestResultRepository repo;
    private ConnectivityInternalController controller;

    private static final String VALID_PATH = "/var/spool/asterisk/monitor/qos-test-42.wav";

    @BeforeEach
    void setUp() {
        repo = Mockito.mock(TestResultRepository.class);
        controller = new ConnectivityInternalController(repo);
    }

    @Test
    @DisplayName("persiste o caminho quando o WAV está dentro do diretório de gravações")
    void persisteCaminhoValido() {
        // Arrange
        TestResult result = TestResult.builder().id(42L).status("DISCANDO").build();
        when(repo.findById(42L)).thenReturn(Optional.of(result));

        // Act
        var response = controller.registerRecording(42L, VALID_PATH);

        // Assert
        assertThat(response.getBody()).isEqualTo("ok");
        assertThat(result.getRecordingPath()).isEqualTo(VALID_PATH);
        verify(repo).save(result);
    }

    @Test
    @DisplayName("rejeita travessia de diretório sem tocar no banco")
    void rejeitaTravessiaDeDiretorio() {
        // Act
        var response =
                controller.registerRecording(
                        42L, "/var/spool/asterisk/monitor/../../../etc/passwd.wav");

        // Assert
        assertThat(response.getBody()).isEqualTo("rejected");
        verify(repo, never()).findById(any());
        verify(repo, never()).save(any());
    }

    @Test
    @DisplayName("rejeita caminho absoluto fora do diretório de gravações")
    void rejeitaCaminhoForaDoDiretorio() {
        var response = controller.registerRecording(42L, "/opt/AgentIA/env/.env.wav");

        assertThat(response.getBody()).isEqualTo("rejected");
        verify(repo, never()).save(any());
    }

    @Test
    @DisplayName("rejeita arquivo que não é .wav")
    void rejeitaExtensaoInvalida() {
        var response =
                controller.registerRecording(42L, "/var/spool/asterisk/monitor/qos-test-42.txt");

        assertThat(response.getBody()).isEqualTo("rejected");
        verify(repo, never()).save(any());
    }

    @Test
    @DisplayName("rejeita caminho vazio — variável não resolvida no dialplan")
    void rejeitaCaminhoVazio() {
        var response = controller.registerRecording(42L, "");

        assertThat(response.getBody()).isEqualTo("rejected");
        verify(repo, never()).save(any());
    }

    @Test
    @DisplayName("responde 200 'not-found' quando o teste não existe, sem lançar erro no dialplan")
    void testeInexistenteNaoQuebraODialplan() {
        when(repo.findById(999L)).thenReturn(Optional.empty());

        var response = controller.registerRecording(999L, VALID_PATH);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).isEqualTo("not-found");
        verify(repo, never()).save(any());
    }
}
