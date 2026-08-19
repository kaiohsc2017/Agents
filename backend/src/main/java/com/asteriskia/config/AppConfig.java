package com.asteriskia.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.reactive.function.client.WebClient;

import java.io.IOException;
import java.net.HttpURLConnection;
import java.util.List;


/**
 * AppConfig — Configurações gerais da aplicação.
 *
 * Contém:
 *   - CORS: libera origens do frontend React
 *   - WebClient: cliente HTTP reativo para chamadas externas (Jira, Zabbix, Telegram)
 *   - RestTemplate: cliente HTTP síncrono (testes de conectividade)
 */
@Configuration
public class AppConfig {

    @Value("${app.cors.allowed-origins:http://localhost:3000}")
    private String allowedOrigins;

    /**
     * CORS consumido por {@code SecurityConfig} via {@code http.cors(...)}.
     */
    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOriginPatterns(List.of(allowedOrigins.split(",")));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(true);
        config.setMaxAge(3600L);

        return request -> config;
    }

    /**
     * WebClient.Builder para chamadas HTTP reativas a APIs externas.
     * Injetado pelo TelegramBotService, JiraIntegrationService e ZabbixPollingService.
     */
    @Bean
    public WebClient.Builder webClientBuilder() {
        return WebClient.builder();
    }

    /**
     * RestTemplate para chamadas HTTP síncronas (usado só pelo SettingsTestController).
     * Timeout de 8s para evitar bloqueio em testes de conectividade.
     *
     * Achado de segurança (SSRF, complementa SettingsTestController.isSafePublicUrl):
     * HttpURLConnection segue redirect 3xx por padrão — um host público controlado
     * pelo atacante respondia 302 pra um IP privado e a checagem de host seguro era
     * completamente ignorada nessa segunda conexão. Redirect desabilitado nesse
     * request factory; único consumidor deste bean é o teste de conectividade, então
     * não afeta nenhuma integração real (Jira/Zabbix/Telegram usam WebClient).
     */
    @Bean
    public RestTemplate restTemplate(RestTemplateBuilder builder) {
        var factory = new SimpleClientHttpRequestFactory() {
            @Override
            protected void prepareConnection(HttpURLConnection connection, String httpMethod) throws IOException {
                super.prepareConnection(connection, httpMethod);
                connection.setInstanceFollowRedirects(false);
            }
        };
        return builder
                .requestFactory(() -> factory)
                .setConnectTimeout(java.time.Duration.ofSeconds(8))
                .setReadTimeout(java.time.Duration.ofSeconds(8))
                .build();
    }
}
