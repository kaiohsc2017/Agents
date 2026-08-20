package com.asteriskia.domain.user;

import com.asteriskia.domain.audit.AuditService;
import com.asteriskia.domain.masterdata.BusinessUnit;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

/**
 * UserController — CRUD de usuários do sistema AgentIA.
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
@Transactional
public class UserController {

    private final AppUserRepository userRepo;
    private final AuditService auditService;
    private final UserService userService;
    private final SipSecretCipher sipSecretCipher;
    private static final BCryptPasswordEncoder ENCODER = new BCryptPasswordEncoder(10);

    /**
     * Achado de segurança (security-reviewer): a rota é protegida também por
     * PERM_WRITE_telecom.users (não só ROLE_ADMIN) — sem esta checagem, um grupo customizado
     * com essa permissão (mas sem ser ADMIN) conseguiria se auto-promover ou promover qualquer
     * outro usuário atribuindo o grupo "Administradores" (id=1) via accessGroupId, ou role="ADMIN"
     * — escalada de privilégio vertical. Atribuir grupo de acesso/papel ADMIN é operação de gestão
     * de RBAC, tratada como ROLE_ADMIN puro em todo o resto do sistema (ex: /access-groups/**).
     */
    private boolean isAdminCaller() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null
                && auth.getAuthorities().stream()
                        .anyMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()));
    }

    // Ramal inicial — o primeiro usuário recebe 9001
    private static final int EXTENSION_START = 9001;

    // -----------------------------------------------------------------------
    // CRUD
    // -----------------------------------------------------------------------

    /**
     * M14 (auditoria 2026-08-20): antes usava {@code findAll()} sem paginação — cresce sem limite
     * com a base de usuários. Adicionado suporte a {@link Pageable}/{@link Page}, mesmo padrão já
     * usado em {@code ConnectivityController#listResults}, mas com compatibilidade retroativa: sem
     * parâmetros de página o {@code size} default (1000) devolve tudo numa página só, porque o
     * {@code Users.tsx} do frontend ainda não foi atualizado para consumir paginação de verdade
     * (fica para uma próxima sessão, fora do escopo desta correção).
     */
    @GetMapping
    public ResponseEntity<Page<UserResponse>> listUsers(
            @PageableDefault(size = 1000, sort = "id") Pageable pageable) {
        return ResponseEntity.ok(userRepo.findAll(pageable).map(UserResponse::from));
    }

    @GetMapping("/{id}")
    public ResponseEntity<UserResponse> getUser(@PathVariable Integer id) {
        return userRepo.findById(id)
                .map(u -> ResponseEntity.ok(UserResponse.from(u)))
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Achado de segurança: GET /users devolvia extensionPassword em claro pra todos os ramais de
     * uma vez (o botão "revelar" do frontend só escondia visualmente — o valor já estava na memória
     * do componente desde o carregamento da lista). Endpoint dedicado: só busca sob demanda, ao
     * clicar "revelar" em um usuário específico.
     */
    /**
     * Achado de segurança H1 (auditoria): antes, a "senha" do ramal era calculada por fórmula
     * previsível ("webrtc" + extensão + "pass") — qualquer pessoa que soubesse o número do
     * ramal deduzia a credencial sem nenhum acesso ao sistema. Agora devolve um secret aleatório
     * forte ({@link java.security.SecureRandom}, 24 bytes → 32 chars em Base64 URL-safe),
     * gerado na primeira consulta e persistido em {@code app_users.sip_secret} (migration V95).
     *
     * <p><b>Limitação conhecida, documentada deliberadamente</b>: este backend Java não tem
     * PJSIP realtime (ARA) configurado — diferente do projeto de referência (VoipIA), onde o
     * secret gerado seria escrito de volta no {@code pjsip.conf}/tabela ARA e o Asterisk
     * autenticaria o ramal com o valor real. Aqui, a autenticação SIP real dos ramais estáticos
     * (9001/9002/1001/1002) continua vindo das variáveis de ambiente
     * {@code RAMAL_XXXX_PASSWORD} injetadas via {@code envsubst} no boot do Asterisk — este
     * secret aleatório NÃO é sincronizado automaticamente com o {@code pjsip.conf}. O objetivo
     * desta correção é eliminar a fórmula previsível (o valor deixa de ser adivinhável), não
     * reconstruir toda a cadeia de autenticação SIP. Se este valor precisar futuramente
     * autenticar de fato um ramal real no Asterisk, a sincronização com o {@code pjsip.conf}
     * (ou uma migração para PJSIP realtime/ARA) é um passo manual/futuro ainda não implementado.
     *
     * <p><b>Achado A9 (auditoria 2026-08-20)</b>: o valor persistido em {@code sip_secret} agora
     * é cifrado em repouso (AES-256-GCM, ver {@link SipSecretCipher}) antes de salvar, e
     * decifrado aqui antes de devolver na resposta. Ver o javadoc de {@link SipSecretCipher}
     * para o comportamento de fail-open (sem {@code SIP_SECRET_ENCRYPTION_KEY} configurada) e a
     * compatibilidade retroativa com valores já gravados em texto plano.
     */
    @GetMapping("/{id}/extension-password")
    public ResponseEntity<?> getExtensionPassword(@PathVariable Integer id) {
        return userRepo.findById(id)
                .map(
                        u -> {
                            if (u.getSipSecret() == null || u.getSipSecret().isBlank()) {
                                u.setSipSecret(sipSecretCipher.encrypt(generateSipSecret()));
                                userRepo.save(u);
                            }
                            String plainSecret = sipSecretCipher.decrypt(u.getSipSecret());
                            return ResponseEntity.ok(new ExtensionPasswordResponse(plainSecret));
                        })
                .orElse(ResponseEntity.notFound().build());
    }

    private String generateSipSecret() {
        byte[] bytes = new byte[24];
        new java.security.SecureRandom().nextBytes(bytes);
        return java.util.Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    @PostMapping
    public ResponseEntity<?> createUser(
            @Valid @RequestBody CreateUserRequest req, HttpServletRequest httpRequest) {
        boolean requestedAdmin = "ADMIN".equals(req.role());
        if ((req.accessGroupId() != null || requestedAdmin) && !isAdminCaller()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(new ErrorResponse("Atribuir grupo de acesso customizado ou perfil ADMIN requer ROLE_ADMIN."));
        }
        if (userRepo.findByUsername(req.username()).isPresent()) {
            return ResponseEntity.badRequest()
                    .body(new ErrorResponse("Username já existe: " + req.username()));
        }

        boolean accessIndeterminate = Boolean.TRUE.equals(req.accessIndeterminate());
        Set<BusinessUnit> businessUnits;
        com.asteriskia.domain.accessgroup.AccessGroup accessGroup;
        int extension = userRepo.findNextExtension(EXTENSION_START);
        String role = req.role() != null ? req.role() : "USER";
        try {
            userService.validateAccessWindow(req.accessExpiresAt(), accessIndeterminate);
            businessUnits = userService.resolveBusinessUnits(req.businessUnitIds());
            accessGroup = userService.resolveAccessGroup(req.accessGroupId(), role);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(new ErrorResponse(e.getMessage()));
        }

        AppUser user =
                AppUser.builder()
                        .username(req.username())
                        .passwordHash(ENCODER.encode(req.password()))
                        .displayName(req.displayName())
                        .extension(extension)
                        .isActive(true)
                        .role(role)
                        .accessGroup(accessGroup)
                        .businessUnits(businessUnits)
                        .accessExpiresAt(accessIndeterminate ? null : req.accessExpiresAt())
                        .accessIndeterminate(accessIndeterminate)
                        .firstLoginCompleted(false)
                        .build();

        AppUser saved = userRepo.save(user);
        log.info("Usuário criado: {} → ramal {}", saved.getUsername(), saved.getExtension());

        auditService.log(
                httpRequest,
                "USER_CREATE",
                "Usuário criado: "
                        + saved.getUsername()
                        + " (ramal "
                        + saved.getExtension()
                        + ", perfil "
                        + saved.getRole()
                        + ")",
                true);

        return ResponseEntity.status(HttpStatus.CREATED).body(UserResponse.from(saved));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateUser(
            @PathVariable Integer id,
            @Valid @RequestBody UpdateUserRequest req,
            HttpServletRequest httpRequest) {
        boolean requestedAdmin = "ADMIN".equals(req.role());
        if ((req.accessGroupId() != null || requestedAdmin) && !isAdminCaller()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(new ErrorResponse("Atribuir grupo de acesso customizado ou perfil ADMIN requer ROLE_ADMIN."));
        }
        var userOpt = userRepo.findById(id);
        if (userOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        AppUser user = userOpt.get();

        try {
            if (req.businessUnitIds() != null) {
                if (req.businessUnitIds().isEmpty()) {
                    return ResponseEntity.badRequest()
                            .body(new ErrorResponse("O usuário precisa de ao menos uma BU."));
                }
                user.setBusinessUnits(userService.resolveBusinessUnits(req.businessUnitIds()));
            }
            if (req.accessIndeterminate() != null || req.accessExpiresAt() != null) {
                boolean indeterminate =
                        req.accessIndeterminate() != null
                                ? req.accessIndeterminate()
                                : Boolean.TRUE.equals(user.getAccessIndeterminate());
                LocalDate expiresAt = indeterminate ? null : req.accessExpiresAt();
                userService.validateAccessWindow(expiresAt, indeterminate);
                user.setAccessIndeterminate(indeterminate);
                user.setAccessExpiresAt(expiresAt);
            }
            if (req.accessGroupId() != null) {
                user.setAccessGroup(userService.resolveAccessGroup(req.accessGroupId(), req.role()));
            }
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(new ErrorResponse(e.getMessage()));
        }

        StringBuilder changes = new StringBuilder();
        if (req.displayName() != null) {
            changes.append("nome='").append(req.displayName()).append("' ");
            user.setDisplayName(req.displayName());
        }
        if (req.password() != null && !req.password().isBlank()) {
            changes.append("senha-alterada ");
            user.setPasswordHash(ENCODER.encode(req.password()));
        }
        if (req.isActive() != null) {
            changes.append("ativo=").append(req.isActive()).append(" ");
            user.setIsActive(req.isActive());
        }
        if (req.role() != null) {
            changes.append("role=").append(req.role()).append(" ");
            user.setRole(req.role());
            // accessGroupId explícito (tratado acima) tem precedência — só recai no fallback
            // binário pelo role legado quando nenhum grupo customizado foi selecionado.
            if (req.accessGroupId() == null) {
                user.setAccessGroup(userService.resolveGroupForRole(req.role()));
            }
        }
        if (req.accessGroupId() != null) {
            changes.append("accessGroupId=").append(req.accessGroupId()).append(" ");
        }
        if (req.businessUnitIds() != null) {
            changes.append("bus=").append(req.businessUnitIds()).append(" ");
        }
        AppUser updated = userRepo.save(user);
        auditService.log(
                httpRequest,
                "USER_UPDATE",
                "Usuário '" + user.getUsername() + "' atualizado: " + changes.toString().trim(),
                true);
        return ResponseEntity.ok(UserResponse.from(updated));
    }

    /**
     * Reset de MFA pelo administrador — usado quando o usuário perde acesso ao app TOTP ou esquece
     * a senha e não consegue completar o 2FA sozinho. Diferente de TotpController.disable
     * (self-service, exige código válido), este endpoint não exige nenhuma prova do usuário-alvo —
     * só ADMIN pode chamar (SecurityConfig restringe /users/** de escrita a ROLE_ADMIN ou
     * PERM_WRITE_telecom.users).
     */
    @PostMapping("/{id}/totp/reset")
    public ResponseEntity<?> resetTotp(@PathVariable Integer id, HttpServletRequest httpRequest) {
        return userRepo.findById(id)
                .map(
                        user -> {
                            user.setTotpSecret(null);
                            user.setTotpEnabled(false);
                            userRepo.save(user);
                            log.info(
                                    "MFA resetado pelo admin para usuário '{}'",
                                    user.getUsername());
                            auditService.log(
                                    httpRequest,
                                    "USER_TOTP_RESET",
                                    "MFA resetado pelo admin para o usuário '"
                                            + user.getUsername()
                                            + "'",
                                    true);
                            return ResponseEntity.ok(UserResponse.from(user));
                        })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deactivateUser(
            @PathVariable Integer id, HttpServletRequest httpRequest) {
        return userRepo.findById(id)
                .map(
                        user -> {
                            user.setIsActive(false);
                            userRepo.save(user);
                            log.info(
                                    "Usuário desativado: {} (ramal {})",
                                    user.getUsername(),
                                    user.getExtension());
                            auditService.log(
                                    httpRequest,
                                    "USER_DELETE",
                                    "Usuário '"
                                             + user.getUsername()
                                            + "' desativado (ramal "
                                            + user.getExtension()
                                            + ")",
                                    true);
                            return ResponseEntity.noContent().<Void>build();
                        })
                .orElse(ResponseEntity.notFound().build());
    }

}
