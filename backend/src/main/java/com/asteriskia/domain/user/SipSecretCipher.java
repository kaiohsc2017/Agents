package com.asteriskia.domain.user;

import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.Base64;
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * SipSecretCipher — cifragem simétrica em repouso do campo {@code app_users.sip_secret}
 * (achado A9 da auditoria de 2026-08-20).
 *
 * <p><b>Algoritmo</b>: AES-256-GCM via {@code javax.crypto} (padrão da JDK, sem dependência
 * nova). Formato persistido, sempre em Base64: {@code IV(12 bytes) + ciphertext + tag(16 bytes)}
 * concatenados e então codificados — {@link #encrypt} devolve exatamente essa string,
 * {@link #decrypt} espera recebê-la de volta.
 *
 * <p><b>Chave</b>: variável de ambiente {@code SIP_SECRET_ENCRYPTION_KEY} — deve ser uma string
 * Base64 padrão (não URL-safe) que decodifica para exatamente 32 bytes (AES-256). Lida via
 * {@code @Value("${SIP_SECRET_ENCRYPTION_KEY:}")}, mesmo estilo de leitura de configuração já
 * usado por {@link com.asteriskia.config.JwtService} para {@code BACKEND_JWT_SECRET}
 * (propriedade Spring com fallback, não {@code System.getenv} direto).
 *
 * <p><b>Modo fail-open, documentado e intencional</b>: se a variável não estiver configurada
 * (ausente/vazia) ou tiver um formato inválido (base64 malformado ou tamanho diferente de 32
 * bytes), esta classe NUNCA lança exceção de inicialização nem quebra o boot da aplicação —
 * loga um {@code WARN} bem visível uma única vez e opera em modo passthrough: {@link #encrypt}
 * devolve o texto plano sem alteração, {@link #decrypt} devolve o valor recebido sem alteração.
 * Mesmo padrão de fail-open já documentado para {@code AGENT_SECRETS_ENCRYPTION_KEY} no lado
 * Python desta mesma auditoria — mantém consistência de comportamento entre as duas camadas do
 * sistema quando a chave de cifragem ainda não foi provisionada num ambiente.
 *
 * <p><b>Compatibilidade retroativa</b>: {@link #decrypt} nunca assume que o valor recebido está
 * de fato cifrado — um valor gravado antes desta mudança (ou gravado em modo passthrough) é
 * texto plano puro. Se a decodificação Base64 falhar, ou o array decodificado for menor que
 * {@code IV(12) + tag(16)} bytes, ou a decifragem GCM falhar (tag de autenticação não bate —
 * sintoma inequívoco de que os bytes não são um ciphertext GCM válido para esta chave), o valor
 * original é devolvido tal como veio, tratado como texto plano legado. Isso permite migrar a
 * chave de "não configurada" para "configurada" sem quebrar a leitura de secrets já persistidos
 * em texto plano, sem exigir nenhum script de migração de dados.
 */
@Slf4j
@Component
public class SipSecretCipher {

    private static final String TRANSFORMATION = "AES/GCM/NoPadding";
    private static final String KEY_ALGORITHM = "AES";
    private static final int GCM_IV_LENGTH_BYTES = 12;
    private static final int GCM_TAG_LENGTH_BITS = 128;
    private static final int EXPECTED_KEY_LENGTH_BYTES = 32;

    private final SecureRandom secureRandom = new SecureRandom();
    private final byte[] keyBytes;

    public SipSecretCipher(@Value("${SIP_SECRET_ENCRYPTION_KEY:}") String encodedKey) {
        this.keyBytes = resolveKey(encodedKey);
    }

    private byte[] resolveKey(String encodedKey) {
        if (encodedKey == null || encodedKey.isBlank()) {
            log.warn(
                    "SIP_SECRET_ENCRYPTION_KEY não configurada — sip_secret será armazenado em"
                            + " texto plano (modo passthrough, sem cifragem em repouso)");
            return null;
        }
        try {
            byte[] decoded = Base64.getDecoder().decode(encodedKey.trim());
            if (decoded.length != EXPECTED_KEY_LENGTH_BYTES) {
                log.warn(
                        "SIP_SECRET_ENCRYPTION_KEY tem {} bytes após decodificar Base64 (esperado"
                                + " {} bytes para AES-256) — sip_secret será armazenado em texto"
                                + " plano (modo passthrough, sem cifragem em repouso)",
                        decoded.length,
                        EXPECTED_KEY_LENGTH_BYTES);
                return null;
            }
            return decoded;
        } catch (IllegalArgumentException e) {
            log.warn(
                    "SIP_SECRET_ENCRYPTION_KEY não é um Base64 válido — sip_secret será"
                            + " armazenado em texto plano (modo passthrough, sem cifragem em"
                            + " repouso)");
            return null;
        }
    }

    /** true se a chave está configurada e válida — a cifragem real está ativa. */
    public boolean isEncryptionEnabled() {
        return keyBytes != null;
    }

    /**
     * Cifra o texto plano informado. Em modo passthrough (chave ausente/inválida), devolve o
     * próprio texto plano sem alteração.
     */
    public String encrypt(String plaintext) {
        if (plaintext == null) {
            return null;
        }
        if (!isEncryptionEnabled()) {
            return plaintext;
        }
        try {
            byte[] iv = new byte[GCM_IV_LENGTH_BYTES];
            secureRandom.nextBytes(iv);

            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            SecretKeySpec keySpec = new SecretKeySpec(keyBytes, KEY_ALGORITHM);
            cipher.init(Cipher.ENCRYPT_MODE, keySpec, new GCMParameterSpec(GCM_TAG_LENGTH_BITS, iv));

            byte[] ciphertext = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));

            ByteBuffer buffer = ByteBuffer.allocate(iv.length + ciphertext.length);
            buffer.put(iv);
            buffer.put(ciphertext);
            return Base64.getEncoder().encodeToString(buffer.array());
        } catch (GeneralSecurityException e) {
            // Nunca expõe detalhe de erro criptográfico em log (mesma disciplina já usada no
            // projeto para chaves de API externas) — falha de cifragem aqui é bug de
            // configuração/JDK, não dado sensível a redigir, mas o padrão do projeto é logar só
            // a classe da exceção.
            log.error(
                    "Falha ao cifrar sip_secret ({}) — persistindo em texto plano como"
                            + " fallback seguro",
                    e.getClass().getSimpleName());
            return plaintext;
        }
    }

    /**
     * Decifra o valor persistido informado. Se a chave não estiver configurada, ou se o valor
     * não estiver no formato cifrado esperado (compatibilidade retroativa com dado gravado em
     * texto plano), devolve o próprio valor recebido sem alteração.
     */
    public String decrypt(String stored) {
        if (stored == null) {
            return null;
        }
        if (!isEncryptionEnabled()) {
            return stored;
        }
        try {
            byte[] raw = Base64.getDecoder().decode(stored);
            int minLength = GCM_IV_LENGTH_BYTES + (GCM_TAG_LENGTH_BITS / 8);
            if (raw.length < minLength) {
                // Base64 válido mas curto demais para conter IV+tag — não é um ciphertext
                // nosso; trata como texto plano legado.
                return stored;
            }

            byte[] iv = new byte[GCM_IV_LENGTH_BYTES];
            byte[] ciphertext = new byte[raw.length - GCM_IV_LENGTH_BYTES];
            System.arraycopy(raw, 0, iv, 0, GCM_IV_LENGTH_BYTES);
            System.arraycopy(raw, GCM_IV_LENGTH_BYTES, ciphertext, 0, ciphertext.length);

            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            SecretKeySpec keySpec = new SecretKeySpec(keyBytes, KEY_ALGORITHM);
            cipher.init(Cipher.DECRYPT_MODE, keySpec, new GCMParameterSpec(GCM_TAG_LENGTH_BITS, iv));

            byte[] plaintext = cipher.doFinal(ciphertext);
            return new String(plaintext, StandardCharsets.UTF_8);
        } catch (IllegalArgumentException | GeneralSecurityException e) {
            // Base64 inválido ou falha de autenticação GCM (tag não bate) — sintoma esperado de
            // um valor legado em texto plano, não um erro a propagar. Devolve como veio.
            return stored;
        }
    }
}
