package com.asteriskia.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * JwtAuthFilter — Extrai e valida o Bearer token em cada requisição.
 * Popula o SecurityContext para que o Spring Security reconheça o usuário.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtService jwtService;

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain
    ) throws ServletException, IOException {

        String authHeader = request.getHeader("Authorization");

        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }

        String token = authHeader.substring(7);

        try {
            // Achado de segurança (A2, auditoria 2026-08-20): o tempToken emitido na
            // primeira etapa do login com 2FA ativo (claim "totp_pending=true", 5 min
            // de validade, gerado por JwtService.generateTempToken) não carrega
            // "role"/"perm", mas era aceito por este filtro como um Bearer comum —
            // extractRole devolvia "USER" por ausência da claim, autenticando o
            // portador do tempToken como um usuário comum em QUALQUER rota, sem
            // nunca validar o código TOTP. Isso permitia bypass parcial do 2FA a
            // quem capturasse o tempToken. Corrigido rejeitando explicitamente
            // qualquer token com essa claim aqui — o único consumidor legítimo do
            // tempToken é POST /api/v1/auth/totp/verify (TotpController), que já lê
            // o valor do corpo da requisição, nunca do header Authorization, então
            // não depende deste filtro para funcionar.
            //
            // Achado de segurança (já existente): token de streaming (60s,
            // scope=stream — ver StreamingTokenFilter/JwtService.generateStreamingToken)
            // é pensado só pra query string de WS/SSE. Sem esta checagem, ele
            // funcionaria como Bearer normal em QUALQUER endpoint (mesmo privilégio
            // do usuário) durante sua validade — baixo risco dado o TTL curto, mas
            // contraria o design pretendido de "restrito a streaming".
            if (jwtService.isValid(token) && !jwtService.isStreamingScope(token)
                    && !jwtService.isTotpPending(token)
                    && SecurityContextHolder.getContext().getAuthentication() == null) {

                String username = jwtService.extractUsername(token);
                String role = jwtService.extractRole(token);
                Map<String, String> perms = jwtService.extractPermissions(token);

                List<SimpleGrantedAuthority> authorities = new ArrayList<>();
                authorities.add(new SimpleGrantedAuthority("ROLE_" + role));
                // Tokens antigos (sem claim "perm") só carregam ROLE_ — o cutover em
                // SecurityConfig aceita ROLE_ADMIN OU a PERM_ correspondente, então
                // sessões existentes continuam válidas até expirar/renovar (máx. 8h).
                perms.forEach((resource, flags) -> {
                    if (flags != null && flags.contains("r")) {
                        authorities.add(new SimpleGrantedAuthority("PERM_READ_" + resource));
                    }
                    if (flags != null && flags.contains("w")) {
                        authorities.add(new SimpleGrantedAuthority("PERM_WRITE_" + resource));
                    }
                });
                // Controle de acesso por BU: authorities BU_<id> lidas por
                // BusinessUnitContext para escopar queries. ADMIN não carrega
                // claim "bu" (ver JwtService/AuthController) — bypassa o filtro.
                jwtService.extractBusinessUnitIds(token)
                        .forEach(buId -> authorities.add(new SimpleGrantedAuthority("BU_" + buId)));

                UsernamePasswordAuthenticationToken authToken =
                        new UsernamePasswordAuthenticationToken(username, null, authorities);
                authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                SecurityContextHolder.getContext().setAuthentication(authToken);
            }
        } catch (Exception e) {
            log.debug("JWT inválido na requisição {}: {}", request.getRequestURI(), e.getMessage());
        }

        filterChain.doFilter(request, response);
    }
}
