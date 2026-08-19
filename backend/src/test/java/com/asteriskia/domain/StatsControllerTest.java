package com.asteriskia.domain;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.asteriskia.config.JwtService;
import com.asteriskia.domain.audit.AuditService;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

/**
 * StatsControllerTest — teste para AgentIA.
 */
@WebMvcTest(StatsController.class)
@AutoConfigureMockMvc(addFilters = false)
class StatsControllerTest {

    @Autowired private MockMvc mockMvc;

    @MockBean private StatsTestResultRepository testResultRepo;

    @MockBean private StatsAlertCallRepository alertCallRepo;

    @MockBean private StatsNumberTestRepository numberTestRepo;

    @MockBean private JwtService jwtService;

    @MockBean private AuditService auditService;

    @MockBean private StatsTrunkAmiClient trunkAmiClient;

    // ── Conectividade ─────────────────────────────────────────────────────────

    @Test
    @WithMockUser(roles = "ADMIN")
    void connectivityStats_calculaTaxasApartirDosContadores() throws Exception {
        when(testResultRepo.countByPeriod(any(), any())).thenReturn(10L);
        when(testResultRepo.countByStatusAndPeriod(eq("SUCESSO"), any(), any())).thenReturn(8L);
        when(testResultRepo.countByStatusAndPeriod(eq("FALHA"), any(), any())).thenReturn(2L);
        when(numberTestRepo.countByIsActiveTrue()).thenReturn(20L);

        mockMvc.perform(get("/api/v1/stats/connectivity"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalTestsToday").value(10))
                .andExpect(jsonPath("$.successesToday").value(8))
                .andExpect(jsonPath("$.failuresToday").value(2))
                .andExpect(jsonPath("$.successRatePct").value(80.0))
                .andExpect(jsonPath("$.failRatePct").value(20.0))
                .andExpect(jsonPath("$.scheduledCount").value(20));
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void connectivityStats_semTestes_taxasZeradasSemDivisaoPorZero() throws Exception {
        when(testResultRepo.countByPeriod(any(), any())).thenReturn(0L);
        when(testResultRepo.countByStatusAndPeriod(anyString(), any(), any())).thenReturn(0L);
        when(numberTestRepo.countByIsActiveTrue()).thenReturn(0L);

        mockMvc.perform(get("/api/v1/stats/connectivity"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.successRatePct").value(0))
                .andExpect(jsonPath("$.completionRatePct").value(0));
    }

    // ── Alertas ───────────────────────────────────────────────────────────────

    @Test
    @WithMockUser(roles = "ADMIN")
    void alertStats_calculaTaxaDeAtendimentoEDeEnvioTelegram() throws Exception {
        when(alertCallRepo.countByPeriod(any(), any())).thenReturn(10L);
        when(alertCallRepo.countByStatusAndPeriod(eq("ATENDIDA"), any(), any())).thenReturn(7L);
        when(alertCallRepo.countByStatusAndPeriod(eq("NAO_ATENDIDA"), any(), any())).thenReturn(2L);
        when(alertCallRepo.countByStatusAndPeriod(eq("FALHA"), any(), any())).thenReturn(1L);
        when(alertCallRepo.countTelegramSentByPeriod(any(), any())).thenReturn(9L);

        mockMvc.perform(get("/api/v1/stats/alerts"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.answeredRatePct").value(70.0))
                .andExpect(jsonPath("$.telegramSuccessRatePct").value(90.0));
    }

    // ── Tronco SIP ────────────────────────────────────────────────────────────

    @Test
    @WithMockUser(roles = "ADMIN")
    void trunkStatus_delegaParaStatsTrunkAmiClientEDevolveOResultado() throws Exception {
        when(trunkAmiClient.queryTrunkStatus()).thenReturn(Map.of("status", "ONLINE", "rttMs", 12));

        mockMvc.perform(get("/api/v1/stats/trunk-status"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ONLINE"))
                .andExpect(jsonPath("$.rttMs").value(12));
    }
}
