package com.asteriskia.domain;

import java.time.LocalDateTime;
import java.util.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * StatsController — KPIs agregados de Conectividade, Monitoramento e Tronco SIP para AgentIA.
 *
 * <p>GET /api/v1/stats/connectivity?period=today|week|month
 * <p>GET /api/v1/stats/alerts?period=today|week|month
 * <p>GET /api/v1/stats/trunk-status → status do tronco SIP via qualify AMI
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/stats")
@RequiredArgsConstructor
public class StatsController {

    private final StatsTestResultRepository testResultRepo;
    private final StatsAlertCallRepository alertCallRepo;
    private final StatsNumberTestRepository numberTestRepo;
    private final StatsTrunkAmiClient trunkAmiClient;

    // -----------------------------------------------------------------------
    // Módulo Conectividade (KPIs)
    // -----------------------------------------------------------------------

    @GetMapping("/connectivity")
    public ResponseEntity<Map<String, Object>> connectivityStats(
            @RequestParam(defaultValue = "today") String period) {

        LocalDateTime[] range = getRange(period);
        LocalDateTime from = range[0], to = range[1];

        long totalTests = testResultRepo.countByPeriod(from, to);
        long successTests = testResultRepo.countByStatusAndPeriod("SUCESSO", from, to);
        long failedTests = testResultRepo.countByStatusAndPeriod("FALHA", from, to);
        long scheduledCount = numberTestRepo.countByIsActiveTrue();

        // Período semana também para comparação
        LocalDateTime[] weekRange = getRange("week");
        long totalWeek = testResultRepo.countByPeriod(weekRange[0], weekRange[1]);
        long successWeek =
                testResultRepo.countByStatusAndPeriod("SUCESSO", weekRange[0], weekRange[1]);
        long failedWeek =
                testResultRepo.countByStatusAndPeriod("FALHA", weekRange[0], weekRange[1]);

        double successRate =
                totalTests > 0 ? Math.round((successTests * 100.0 / totalTests) * 10.0) / 10.0 : 0;
        double failRate =
                totalTests > 0 ? Math.round((failedTests * 100.0 / totalTests) * 10.0) / 10.0 : 0;
        double completionRate =
                scheduledCount > 0
                        ? Math.round(
                                        (totalTests * 100.0 / Math.max(scheduledCount, totalTests))
                                                * 10.0)
                                / 10.0
                        : 0;

        Map<String, Object> stats = new HashMap<>();
        stats.put("period", period);
        // KPIs dia/semana
        stats.put("totalTestsToday", totalTests);
        stats.put("successesToday", successTests);
        stats.put("failuresToday", failedTests);
        stats.put("totalTestsWeek", totalWeek);
        stats.put("successesWeek", successWeek);
        stats.put("failuresWeek", failedWeek);
        // Percentuais
        stats.put("successRatePct", successRate);
        stats.put("failRatePct", failRate);
        stats.put("completionRatePct", completionRate);
        stats.put("pendingPct", Math.max(0, 100.0 - completionRate));
        // Totais
        stats.put("scheduledCount", scheduledCount);

        return ResponseEntity.ok(stats);
    }

    // -----------------------------------------------------------------------
    // Módulo Alertas Zabbix
    // -----------------------------------------------------------------------

    @GetMapping("/alerts")
    public ResponseEntity<Map<String, Object>> alertStats(
            @RequestParam(defaultValue = "today") String period) {

        LocalDateTime[] range = getRange(period);
        LocalDateTime from = range[0], to = range[1];

        long totalAlerts = alertCallRepo.countByPeriod(from, to);
        long answered = alertCallRepo.countByStatusAndPeriod("ATENDIDA", from, to);
        long notAnswered = alertCallRepo.countByStatusAndPeriod("NAO_ATENDIDA", from, to);
        long failed = alertCallRepo.countByStatusAndPeriod("FALHA", from, to);
        long telegramSent = alertCallRepo.countTelegramSentByPeriod(from, to);

        double answeredRate =
                totalAlerts > 0 ? Math.round((answered * 100.0 / totalAlerts) * 10.0) / 10.0 : 0;
        double telegramRate =
                totalAlerts > 0
                        ? Math.round((telegramSent * 100.0 / totalAlerts) * 10.0) / 10.0
                        : 0;

        Map<String, Object> stats = new HashMap<>();
        stats.put("period", period);
        stats.put("totalAlerts", totalAlerts);
        stats.put("answered", answered);
        stats.put("notAnswered", notAnswered);
        stats.put("failed", failed);
        stats.put("telegramSent", telegramSent);
        stats.put("answeredRatePct", answeredRate);
        stats.put("telegramSuccessRatePct", telegramRate);

        return ResponseEntity.ok(stats);
    }

    // -----------------------------------------------------------------------
    // Tronco SIP — status via qualify AMI
    // -----------------------------------------------------------------------

    @GetMapping("/trunk-status")
    public ResponseEntity<Map<String, Object>> trunkStatus() {
        return ResponseEntity.ok(trunkAmiClient.queryTrunkStatus());
    }

    // -----------------------------------------------------------------------
    // Helper
    // -----------------------------------------------------------------------

    private LocalDateTime[] getRange(String period) {
        return PeriodRangeResolver.resolve(period);
    }
}
