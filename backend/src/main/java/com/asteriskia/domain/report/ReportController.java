package com.asteriskia.domain.report;

import com.asteriskia.domain.connectivity.ConnectivityReportRepository;
import com.asteriskia.domain.connectivity.TestResult;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * ReportController — Exportação de relatórios em CSV para AgentIA.
 *
 * <p>GET /api/v1/reports/connectivity → CSV com resultados de testes de conectividade
 * <p>GET /api/v1/reports/connectivity/summary → JSON com totais por BU e Cliente
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/reports")
@RequiredArgsConstructor
public class ReportController {

    private final ConnectivityReportRepository connectivityReportRepository;
    private static final DateTimeFormatter FILE_DT = DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss");

    // -------------------------------------------------------------------------
    // Conectividade — CSV
    // -------------------------------------------------------------------------

    @GetMapping("/connectivity")
    public ResponseEntity<byte[]> exportConnectivity(
            @RequestParam(required = false) String month,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
                    LocalDateTime dateFrom,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
                    LocalDateTime dateTo,
            @RequestParam(required = false) Long businessUnitId,
            @RequestParam(required = false) Long clientId,
            @RequestParam(required = false) Long operationId,
            @RequestParam(required = false) Long segmentId,
            @RequestParam(required = false) String status) {

        if (dateFrom == null && dateTo == null && month != null) {
            YearMonth ym = YearMonth.parse(month);
            dateFrom = ym.atDay(1).atStartOfDay();
            dateTo = ym.atEndOfMonth().atTime(23, 59, 59);
        }

        log.info(
                "Exportando conectividade: from={}, to={}, bu={}, client={}, op={}, seg={}, status={}",
                dateFrom,
                dateTo,
                businessUnitId,
                clientId,
                operationId,
                segmentId,
                status);

        List<TestResult> results =
                connectivityReportRepository.findForExport(
                        status, dateFrom, dateTo, businessUnitId, clientId, operationId, segmentId);

        String csv = ReportCsvBuilder.buildConnectivityCsv(results);
        String filename = "conectividade_" + LocalDateTime.now().format(FILE_DT) + ".csv";

        return ReportCsvBuilder.csvResponse(csv, filename);
    }

    // -------------------------------------------------------------------------
    // Conectividade — Sumário JSON (por BU e Cliente)
    // -------------------------------------------------------------------------

    @GetMapping("/connectivity/summary")
    public ResponseEntity<List<ConnectivitySummaryDTO>> connectivitySummary(
            @RequestParam(defaultValue = "") String month) {

        LocalDateTime from, to;
        if (month.isEmpty()) {
            from = LocalDateTime.now().withDayOfMonth(1).toLocalDate().atStartOfDay();
            to = LocalDateTime.now();
        } else {
            YearMonth ym = YearMonth.parse(month);
            from = ym.atDay(1).atStartOfDay();
            to = ym.atEndOfMonth().atTime(23, 59, 59);
        }

        List<TestResult> results =
                connectivityReportRepository.findForExport(null, from, to, null, null, null, null);

        Map<String, ConnectivitySummaryDTO> grouped = new LinkedHashMap<>();
        for (TestResult r : results) {
            if (r.getNumberTest() == null) continue;
            String buName =
                    r.getNumberTest().getBusinessUnit() != null
                            ? r.getNumberTest().getBusinessUnit().getName()
                            : "—";
            String cliName =
                    r.getNumberTest().getClient() != null
                            ? r.getNumberTest().getClient().getName()
                            : "—";
            String key = buName + "|" + cliName;
            ConnectivitySummaryDTO dto =
                    grouped.computeIfAbsent(
                            key, k -> new ConnectivitySummaryDTO(buName, cliName, 0, 0, 0));
            dto.total++;
            if ("SUCESSO".equals(r.getStatus())) dto.sucesso++;
            else dto.falha++;
        }

        List<ConnectivitySummaryDTO> summary = new ArrayList<>(grouped.values());
        summary.forEach(
                s -> s.taxaSucesso = s.total > 0 ? Math.round(s.sucesso * 100.0 / s.total) : 0);

        return ResponseEntity.ok(summary);
    }
}
