package com.asteriskia.domain.accessgroup;

import java.util.List;

/**
 * Catálogo fixo dos recursos (menus) que podem receber permissão de
 * leitura/escrita por grupo de acesso no AgentIA.
 */
public final class ResourceCatalog {

    private ResourceCatalog() {}

    public static final List<String> TELECOM = List.of(
            "telecom.dashboard",
            "telecom.modulo2",
            "telecom.modulo3",
            "telecom.agents_link",
            "telecom.0800",
            "telecom.linhas",
            "telecom.operadoras",
            "telecom.users",
            "telecom.settings",
            "telecom.logs",
            "telecom.security",
            "telecom.audit",
            "telecom.release"
    );

    public static final List<String> AGENTS = List.of(
            "agents.dashboard",
            "agents.agents",
            "agents.servers",
            "agents.knowledge",
            "agents.logs",
            "agents.reports",
            "agents.secrets",
            "agents.llm"
    );

    public static List<String> all() {
        return java.util.stream.Stream.of(
                        TELECOM.stream(),
                        AGENTS.stream())
                .flatMap(s -> s)
                .toList();
    }
}
