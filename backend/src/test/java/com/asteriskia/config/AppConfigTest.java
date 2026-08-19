package com.asteriskia.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import jakarta.servlet.http.HttpServletRequest;
import java.lang.reflect.Field;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * Cobre a configuração de CORS do AgentIA.
 */
class AppConfigTest {

    private AppConfig configWith(String allowedOrigins) throws Exception {
        var config = new AppConfig();
        setField(config, "allowedOrigins", allowedOrigins);
        return config;
    }

    private void setField(AppConfig config, String name, String value) throws Exception {
        Field field = AppConfig.class.getDeclaredField(name);
        field.setAccessible(true);
        field.set(config, value);
    }

    private HttpServletRequest requestFor(String uri) {
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRequestURI()).thenReturn(uri);
        return request;
    }

    @Test
    @DisplayName("CORS configura allowedOriginPatterns e credenciais corretamente")
    void corsConfig_setsOriginPatternsAndCredentials() throws Exception {
        var source = configWith("https://app.voiphash.com.br,http://localhost:3000").corsConfigurationSource();
        var cors = source.getCorsConfiguration(requestFor("/api/v1/users"));

        assertThat(cors).isNotNull();
        assertThat(cors.getAllowedOriginPatterns())
                .containsExactly("https://app.voiphash.com.br", "http://localhost:3000");
        assertThat(cors.getAllowCredentials()).isTrue();
        assertThat(cors.getAllowedMethods())
                .contains("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS");
    }

    @Test
    @DisplayName("CORS permite headers e métodos padrão")
    void corsConfig_allowsStandardHeaders() throws Exception {
        var source = configWith("http://localhost:3000").corsConfigurationSource();
        var cors = source.getCorsConfiguration(requestFor("/api/v1/settings"));

        assertThat(cors).isNotNull();
        assertThat(cors.getAllowedHeaders()).contains("*");
        assertThat(cors.getMaxAge()).isEqualTo(3600L);
    }
}

