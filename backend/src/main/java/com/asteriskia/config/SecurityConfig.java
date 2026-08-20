package com.asteriskia.config;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfigurationSource;

/**
 * SecurityConfig — Segurança JWT + InternalKey da API REST, com RBAC (ADMIN/USER).
 *
 * Endpoints públicos (sem autenticação):
 *   - POST /api/v1/auth/login        → obter token JWT (frontend)
 *   - GET  /api/health               → health check externo (Caddy, monitoração)
 *   - /actuator/health               → health check via Actuator
 *   - /ws/**                         → WebSocket STOMP/SockJS (handshake inicial sem token)
 *
 * Nota sobre /ws: o SockJS faz um GET em /ws/info antes do upgrade WebSocket.
 * Sem liberar /ws/**, o Spring Security retorna 401 nessa requisição e
 * a conexão do Dashboard em tempo real falha. A autenticação de mensagens
 * STOMP (JWT no frame CONNECT) é feita em WebSocketConfig.
 *
 * RBAC: JwtAuthFilter concede ROLE_ADMIN/ROLE_USER (claim "role", legado) e
 * PERM_READ_&lt;resource&gt;/PERM_WRITE_&lt;resource&gt; (claim "perm", grupos de
 * acesso granulares — V22). InternalKeyFilter concede ROLE_INTERNAL para
 * serviços internos (AI Agent).
 *
 * Cada bloco abaixo aceita ROLE_ADMIN OU a permissão granular equivalente —
 * SecurityConfig — Configuração de autenticação e RBAC granular para AgentIA.
 */
@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;
    private final InternalKeyFilter internalKeyFilter;
    private final StreamingTokenFilter streamingTokenFilter;
    private final CorsConfigurationSource corsConfigurationSource;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .cors(cors -> cors.configurationSource(corsConfigurationSource))
                .csrf(AbstractHttpConfigurer::disable)
                .sessionManagement(session ->
                        session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        // Públicos — sem token
                        .requestMatchers(
                                "/api/v1/auth/login",
                                "/api/v1/auth/refresh",
                                "/api/v1/auth/logout",
                                "/api/v1/auth/totp/verify",
                                "/api/health",
                                "/actuator/health",
                                "/ws/**"
                        ).permitAll()

                        // CR1 (auditoria 2026-08-20): estas duas rotas devolvem a API key real
                        // (sem mascaramento) e a chain ativa de modelo — chamadas só pelo ai-agent
                        // Python via X-Internal-Key (InternalKeyFilter). Antes estavam em
                        // permitAll(), vazando a chave de qualquer provedor de IA cadastrado para
                        // qualquer pessoa na internet, sem autenticação. ATENÇÃO: ao fazer deploy
                        // desta correção, rotacione a chave de API de TODOS os provedores de IA
                        // já cadastrados (Gemini/etc.) — elas devem ser consideradas comprometidas.
                        .requestMatchers(
                                "/api/v1/ai/chain/active",
                                "/api/v1/ai/providers/*/key-internal"
                        ).hasAuthority("ROLE_INTERNAL")

                        // Gestão de grupos de acesso — ADMIN puro
                        .requestMatchers("/api/v1/access-groups/**").hasRole("ADMIN")

                        // Leitura de recursos administrativos — ADMIN ou PERM_READ granular.
                        .requestMatchers(HttpMethod.GET, "/api/v1/security/**")
                                .hasAnyAuthority("ROLE_ADMIN", "PERM_READ_telecom.security")
                        .requestMatchers(HttpMethod.GET, "/api/v1/settings/**")
                                .hasAnyAuthority("ROLE_ADMIN", "PERM_READ_telecom.settings")
                        .requestMatchers(HttpMethod.GET, "/api/v1/logs/**")
                                .hasAnyAuthority("ROLE_ADMIN", "PERM_READ_telecom.logs")
                        .requestMatchers(HttpMethod.GET, "/api/v1/users/**")
                                .hasAnyAuthority("ROLE_ADMIN", "PERM_READ_telecom.users")
                        .requestMatchers(HttpMethod.GET, "/api/v1/asterisk-config/**")
                                .hasAnyAuthority("ROLE_ADMIN", "PERM_READ_telecom.settings")
                        .requestMatchers(HttpMethod.GET, "/api/v1/ai/**")
                                .hasAnyAuthority("ROLE_ADMIN", "PERM_READ_telecom.settings")
                        .requestMatchers(HttpMethod.GET, "/api/v1/audit/**")
                                .hasAnyAuthority("ROLE_ADMIN", "PERM_READ_telecom.audit")
                        .requestMatchers(HttpMethod.GET, "/api/v1/numeros-0800/**")
                                .hasAnyAuthority("ROLE_ADMIN", "PERM_READ_telecom.0800")
                        .requestMatchers(HttpMethod.GET, "/api/v1/linhas/**")
                                .hasAnyAuthority("ROLE_ADMIN", "PERM_READ_telecom.linhas")
                        .requestMatchers(HttpMethod.GET, "/api/v1/operadoras/**")
                                .hasAnyAuthority("ROLE_ADMIN", "PERM_READ_telecom.operadoras")
                        .requestMatchers(HttpMethod.GET, "/api/v1/number-tests/**")
                                .hasAnyAuthority("ROLE_ADMIN", "PERM_READ_telecom.modulo2")
                        .requestMatchers(HttpMethod.GET, "/api/v1/test-results/**")
                                .hasAnyAuthority("ROLE_ADMIN", "PERM_READ_telecom.modulo2")
                        .requestMatchers(HttpMethod.GET, "/api/v1/ad/**")
                                .hasAnyAuthority("ROLE_ADMIN", "PERM_READ_telecom.users")
                        .requestMatchers(HttpMethod.GET, "/api/v1/clients/**")
                                .hasAnyAuthority("ROLE_ADMIN", "PERM_READ_telecom.masterdata")
                        .requestMatchers(HttpMethod.GET, "/api/v1/operations/**")
                                .hasAnyAuthority("ROLE_ADMIN", "PERM_READ_telecom.masterdata")
                        .requestMatchers(HttpMethod.GET, "/api/v1/segments/**")
                                .hasAnyAuthority("ROLE_ADMIN", "PERM_READ_telecom.masterdata")
                        .requestMatchers(HttpMethod.GET, "/api/v1/business-units/**")
                                .hasAnyAuthority("ROLE_ADMIN", "PERM_READ_telecom.masterdata")
                        .requestMatchers(HttpMethod.GET, "/api/v1/config/**")
                                .hasAnyAuthority("ROLE_ADMIN", "PERM_READ_telecom.settings")
                        .requestMatchers(HttpMethod.GET, "/api/v1/stats/**")
                                .hasAnyAuthority("ROLE_ADMIN", "PERM_READ_telecom.dashboard")
                        .requestMatchers(HttpMethod.GET, "/api/v1/reports/**")
                                .hasAnyAuthority("ROLE_ADMIN", "PERM_READ_telecom.dashboard")
                        .requestMatchers(HttpMethod.GET, "/api/v1/suporte/**")
                                .hasAnyAuthority("ROLE_ADMIN", "PERM_READ_telecom.modulo1")
                        .requestMatchers(HttpMethod.GET, "/api/v1/alert-calls/**")
                                .hasAnyAuthority("ROLE_ADMIN", "PERM_READ_telecom.modulo3")
                        .requestMatchers(HttpMethod.GET, "/api/v1/alert-contacts/**")
                                .hasAnyAuthority("ROLE_ADMIN", "PERM_READ_telecom.modulo3")

                        // Escrita nos mesmos recursos — ADMIN ou PERM_WRITE granular.
                        .requestMatchers("/api/v1/security/**")
                                .hasAnyAuthority("ROLE_ADMIN", "PERM_WRITE_telecom.security")
                        .requestMatchers("/api/v1/settings/**")
                                .hasAnyAuthority("ROLE_ADMIN", "PERM_WRITE_telecom.settings")
                        .requestMatchers("/api/v1/logs/**")
                                .hasAnyAuthority("ROLE_ADMIN", "PERM_WRITE_telecom.logs")
                        .requestMatchers("/api/v1/users/**")
                                .hasAnyAuthority("ROLE_ADMIN", "PERM_WRITE_telecom.users")
                        .requestMatchers("/api/v1/asterisk-config/**")
                                .hasAnyAuthority("ROLE_ADMIN", "PERM_WRITE_telecom.settings")
                        .requestMatchers("/api/v1/ai/**")
                                .hasAnyAuthority("ROLE_ADMIN", "PERM_WRITE_telecom.settings")
                        .requestMatchers("/api/v1/numeros-0800/**")
                                .hasAnyAuthority("ROLE_ADMIN", "PERM_WRITE_telecom.0800")
                        .requestMatchers("/api/v1/linhas/**")
                                .hasAnyAuthority("ROLE_ADMIN", "PERM_WRITE_telecom.linhas")
                        .requestMatchers("/api/v1/operadoras/**")
                                .hasAnyAuthority("ROLE_ADMIN", "PERM_WRITE_telecom.operadoras")
                        .requestMatchers("/api/v1/number-tests/**")
                                .hasAnyAuthority("ROLE_ADMIN", "PERM_WRITE_telecom.modulo2")
                        .requestMatchers("/api/v1/test-results/**")
                                .hasAnyAuthority("ROLE_ADMIN", "PERM_WRITE_telecom.modulo2")
                        .requestMatchers("/api/v1/ad/**")
                                .hasAnyAuthority("ROLE_ADMIN", "PERM_WRITE_telecom.users")
                        .requestMatchers("/api/v1/clients/**")
                                .hasAnyAuthority("ROLE_ADMIN", "PERM_WRITE_telecom.masterdata")
                        .requestMatchers("/api/v1/operations/**")
                                .hasAnyAuthority("ROLE_ADMIN", "PERM_WRITE_telecom.masterdata")
                        .requestMatchers("/api/v1/segments/**")
                                .hasAnyAuthority("ROLE_ADMIN", "PERM_WRITE_telecom.masterdata")
                        .requestMatchers("/api/v1/business-units/**")
                                .hasAnyAuthority("ROLE_ADMIN", "PERM_WRITE_telecom.masterdata")
                        .requestMatchers("/api/v1/config/**")
                                .hasAnyAuthority("ROLE_ADMIN", "PERM_WRITE_telecom.settings")
                        .requestMatchers("/api/v1/stats/**")
                                .hasAnyAuthority("ROLE_ADMIN", "PERM_WRITE_telecom.dashboard")
                        .requestMatchers("/api/v1/reports/**")
                                .hasAnyAuthority("ROLE_ADMIN", "PERM_WRITE_telecom.dashboard")
                        .requestMatchers("/api/v1/suporte/**")
                                .hasAnyAuthority("ROLE_ADMIN", "PERM_WRITE_telecom.modulo1")
                        .requestMatchers("/api/v1/alert-calls/**")
                                .hasAnyAuthority("ROLE_ADMIN", "PERM_WRITE_telecom.modulo3")
                        .requestMatchers("/api/v1/alert-contacts/**")
                                .hasAnyAuthority("ROLE_ADMIN", "PERM_WRITE_telecom.modulo3")

                        // Endpoints internos
                        .requestMatchers("/api/v1/internal/**").hasAuthority("ROLE_INTERNAL")

                        // Demais endpoints autenticados
                        .anyRequest().authenticated()
                )
                .addFilterBefore(internalKeyFilter, UsernamePasswordAuthenticationFilter.class)
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)
                .addFilterBefore(streamingTokenFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
}
