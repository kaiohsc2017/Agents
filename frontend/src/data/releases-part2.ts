// Changelog estático do sistema — parte 2 (v1.45 em diante), extraída de
// releases.ts para respeitar o limite de 800 linhas por arquivo. Ver
// releases.ts (agregador) e Release.tsx (consumidor).

import type { ReleaseEntry } from './releases';

export const RELEASES_PART2: ReleaseEntry[] = [
  {
    version: 'v1.45',
    date: '2026-07-26',
    changes: [
      'Uniformização de layout: as telas do Telecom e da Plataforma de Agentes passam a aproveitar a largura total de monitores maiores (mesmo ajuste já aplicado ao Insights na v1.44), sem faixa em branco nas laterais.',
    ],
  },
  {
    version: 'v1.46',
    date: '2026-08-01',
    changes: [
      'Menus "Insights" e "Agentes" passam a exibir submenu indentado na Sidebar do Telecom, no mesmo padrão do menu Financeiro — cada aba das duas plataformas vira um item próprio, sem precisar entrar antes na tela cheia do módulo.',
      'A troca de aba nesses dois submenus não recarrega a tela — Insights e Agentes continuam abertos em segundo plano e só trocam de conteúdo.',
      'Login feito direto pelas URLs /insights ou /agents continua mostrando a navegação lateral própria de cada plataforma, sem nenhuma mudança.',
    ],
  },
  {
    version: 'v1.47',
    date: '2026-08-06',
    changes: [
      'Novo módulo "Call Center" no menu lateral do Telecom — primeira entrega do módulo de call center omnicanal, com submenu Agentes, Filas e Skills.',
      'Call Center → Agentes: cadastro de agente com ramal SIP próprio (faixa 4000-4999) — criar, editar ou remover pela tela já registra/desregistra o ramal no Asterisk na hora, sem precisar de reload nem restart. Senha do ramal só é revelada sob demanda, por permissão própria, para configurar o softphone do agente.',
      'Call Center → Filas: cadastro de filas de atendimento (faixa 5000-5999) com estratégia e timeout configuráveis, e gestão dos agentes de cada fila — incluir ou remover um agente também reflete no Asterisk imediatamente.',
      'Call Center → Skills: catálogo de habilidades dos agentes, base para o roteamento por skill de uma entrega futura.',
      'Grupos de Acesso: novo grupo de recursos "Call Center" (Agentes, Senha do ramal, Filas, Skills) — cada tela e a senha do ramal têm permissão própria.',
    ],
  },
  {
    version: 'v1.48',
    date: '2026-08-07',
    changes: [
      'Call Center: toda chamada de fila passa a ser gravada automaticamente em /opt/telecom/gravacao, com aviso de gravação (consentimento) configurável por fila — quando ativado, o áudio de aviso é tocado antes de a chamada entrar na fila.',
      'Call Center → nova aba "Gravações": lista as chamadas gravadas por fila e período, com player de áudio autenticado direto na tela.',
      'Call Center → Gravações → Configurações: prazo de retenção das gravações (padrão 60 meses) com expurgo automático diário e opção de disparo manual, e alerta de disco (limite de uso do volume configurável) enviado por Telegram.',
      'Toda reprodução de uma gravação do Call Center é registrada na Auditoria (quem ouviu, quando, qual chamada).',
      'Grupos de Acesso: novo recurso "Gravações" no grupo "Call Center".',
    ],
  },
  {
    version: 'v1.49',
    date: '2026-08-07',
    changes: [
      'Call Center → Gravações → Configurações: corrigida mensagem de erro genérica ao salvar prazo de retenção ou limite de alerta de disco com valor inválido — agora mostra a causa real (ex: "Prazo de retenção deve ser maior ou igual a 1 dia"), em português.',
      'Adicionados limites min/max nos campos de retenção (1-36500 dias) e alerta de disco (1-100%) na própria tela, como guarda de UX.',
    ],
  },
  {
    version: 'v1.50',
    date: '2026-08-07',
    changes: [
      'Call Center → nova aba "Desktop do Agente": o agente controla o próprio estado (Disponível, Pausa com motivo, Offline) — Em Atendimento e Pós-Atendimento (ACW) passam a ser automáticos, disparados pelos eventos reais de fila/chamada do Asterisk.',
      'Toda chamada de fila agora gera uma interação rastreável (fila, ANI, horário de entrada/atendimento/encerramento) — base da futura timeline de omnicanalidade.',
      'Ao encerrar uma chamada, o agente tabula o atendimento (ex: Resolvido, Transferido, Abandono) antes de voltar a ficar Disponível.',
      'Grupos de Acesso: novo recurso "Desktop do Agente" no grupo "Call Center".',
      'Painel de dados do Active Directory na tela do agente ainda não disponível — depende da conclusão da integração com o Domain Controller (Fase 1, pendente de dados reais de conexão).',
    ],
  },
  {
    version: 'v1.51',
    date: '2026-08-07',
    changes: [
      'Call Center → nova aba "Supervisão": painel com todas as filas (chamadas em espera, maior espera, atendidas/abandonadas do dia, nível de serviço) e todos os agentes (estado atual, tempo no estado, chamadas atendidas hoje), atualizado a cada poucos segundos.',
      'Supervisão → ações sobre o agente em atendimento: escutar, sussurrar (só o agente ouve) e interceptar a chamada (o supervisor entra na conversa).',
      'Supervisão → forçar pausa ou despausa de um agente, e alerta de SLA por fila (espera máxima e/ou nível de serviço mínimo) configurável, enviado por Telegram.',
      'Modo TV: a tela de Supervisão pode ser aberta em tela cheia, sem menus, para exibição num monitor da operação.',
      'Grupos de Acesso: novo recurso "Supervisão" no grupo "Call Center".',
    ],
  },
  {
    version: 'v1.52',
    date: '2026-08-07',
    changes: [
      'Call Center → nova aba "Fluxos": editor visual de URA (arrastar e soltar caixinhas) usando React Flow, com rascunho, publicação (cria versão imutável) e rollback para versão anterior.',
      'Fluxos → catálogo com 14 tipos de nó (início, tocar áudio, menu, coletar entrada, condição, variável, API externa, fila, transferência, horário, agente de IA, gravação, pesquisa de satisfação, encerrar) — nesta entrega nenhum nó ainda é executável (o motor de chamada real chega na próxima entrega), publicar um fluxo que use algum deles é bloqueado.',
      'Fluxos → paleta de nós também acessível por clique/teclado, não só por arrastar-e-soltar.',
      'Submenu Call Center do Telecom: adicionadas as abas "Desktop do Agente" e "Supervisão", que existiam na tela própria do módulo mas nunca haviam sido incluídas aqui.',
      'Grupos de Acesso: novo recurso "Fluxos" no grupo "Call Center".',
    ],
  },
  {
    version: 'v1.53',
    date: '2026-08-07',
    changes: [
      'Fluxos → primeiros 7 tipos de nó passam a ser executáveis de verdade em uma ligação real: início, tocar áudio, menu de opções, condição, definir variável, enviar para fila e encerrar — usando um novo ramal reservado (6000-6999) que dispara o motor de execução do fluxo publicado.',
      'Fluxos → traço de execução por chamada (qual nó foi visitado, em que ordem, e onde a chamada terminou) fica registrado para consulta.',
      'Os outros 7 tipos de nó (coletar entrada, API externa, transferência, horário, agente de IA, pausar gravação, pesquisa de satisfação) continuam bloqueados para publicação — chegam em entregas futuras.',
    ],
  },
  {
    version: 'v1.54',
    date: '2026-08-07',
    changes: [
      'Call Center: toda gravação de fila passa a alimentar automaticamente o mesmo pipeline de IA (transcrição, diarização, análise de sentimento/criticidade, achados) já usado pelo Insights Verint, com 5 telas próprias no menu do Call Center — Chamadas, Dashboard de Tendências, Processamento, Fichas de Qualidade e Relatórios de performance por atendente.',
      'Relatórios de performance por atendente agora distinguem a origem da chamada (Verint ou Call Center) — um atendente com o mesmo nome nos dois sistemas nunca tem os dados agregados no mesmo relatório.',
      'Transcrição de qualquer chamada (Insights, Análise Sob Demanda ou Call Center) passa a mascarar CPF, número de cartão e telefone antes de persistir ou de qualquer análise por IA — nunca chega ao modelo de linguagem em texto puro.',
      'Financeiro: nova frente de custo "Call Center" com alerta de gasto próprio (mesmo padrão de URA/Insights/Análise Sob Demanda).',
      'Grupos de Acesso: novo recurso "Call Center" no grupo Financeiro, e 5 novos recursos em Call Center (Insights — Chamadas/Dashboard/Processamento/Fichas de Qualidade/Relatórios).',
    ],
  },
  {
    version: 'v1.55',
    date: '2026-08-07',
    changes: [
      'Call Center ganha uma primeira aba de Chat: o agente vê as conversas aguardando na fila e as suas em andamento, pode assumir uma conversa, responder usando respostas rápidas, e encerrar com tabulação — reaproveitando as mesmas filas e tabulações já usadas em voz.',
      'Ainda não é o canal de chat público (widget do site, WhatsApp, Telegram) — essa parte chega em uma entrega futura, com um esquema de autenticação próprio para o cliente final. Por enquanto, administradores têm um simulador de conversa para validar o fluxo.',
      'Grupos de Acesso: novo recurso "Chat" no grupo Call Center.',
    ],
  },
  {
    version: 'v1.56',
    date: '2026-08-08',
    changes: [
      'Chat do Call Center ganha o widget público que pode ser embutido no site: o visitante conversa sem precisar de login, com um token de sessão próprio, isolado e de curta duração — nunca com acesso às telas internas.',
      'Ainda depende de uma fila real ser configurada para o chat público entrar em operação, e continua sem WhatsApp/Telegram (fica para uma entrega futura).',
    ],
  },
  {
    version: 'v1.57',
    date: '2026-08-08',
    changes: [
      'Call Center ganha a primeira aba de Relatórios: volume recebido/atendido/abandonado, tempo médio de espera e de atendimento, e nível de serviço por fila — com visão diária, semanal, mensal e anual, e comparação entre dois períodos.',
      'Por enquanto só cobre o canal de voz — relatórios de agente, de fluxo e de chat, além de um relatório único cruzando voz e chat da mesma pessoa, chegam em entregas futuras.',
    ],
  },
  {
    version: 'v1.58',
    date: '2026-08-08',
    changes: [
      'Relatórios do Call Center ganham a visão por atendente: quantas chamadas atendeu, tempo médio de atendimento e percentual do tempo logado gasto atendendo (ocupação) — com a mesma visão diária/semanal/mensal/anual e comparação entre períodos da visão por fila.',
      'Correção de texto: a aba Fluxos não diz mais "sem execução real ainda" — a execução real já existe desde a entrega anterior.',
    ],
  },
  {
    version: 'v1.59',
    date: '2026-08-13',
    changes: [
      'Call Center ganha a aba "Configurações → Ranges de ramal e pesquisa de satisfação": as faixas de numeração de agente, fila e fluxo deixam de ser fixas no código e passam a ser configuráveis pela tela, com aviso de quantos ramais ficam fora da faixa nova (nada é realocado automaticamente).',
      'Novo interruptor global de pesquisa de satisfação (NPS) — desligado aqui, nenhuma fila pesquisa; será usado pela pesquisa de satisfação por chamada, em entrega futura.',
      'Correção interna: telas de agente/fila/fluxo do Call Center agora respondem "não encontrado" corretamente para um id inexistente, em vez de um erro genérico de servidor.',
    ],
  },
  {
    version: 'v1.60',
    date: '2026-08-13',
    changes: [
      'Padronização interna: gravações do Call Center, transcript de chat e uploads de análise sob demanda passam a ficar organizados sob um único diretório de mídia do sistema — sem mudança visível para o usuário.',
    ],
  },
  {
    version: 'v1.61',
    date: '2026-08-13',
    changes: [
      'Softphone do agente do Call Center: cada atendente passa a registrar com a credencial do próprio ramal (em vez de uma senha única compartilhada), e ganha um painel de chamada fixo no Desktop do Agente — atender, encerrar, mudo, teclado e discagem manual — dentro da mesma tela onde já acompanha estado e tabulação.',
      'Correção interna: a credencial SIP do agente é limitada em frequência de leitura e nunca fica exposta a outro agente.',
    ],
  },
  {
    version: 'v1.62',
    date: '2026-08-13',
    changes: [
      'Chamadas de saída do Call Center: quando o agente disca um número externo pelo próprio softphone, a ligação passa a aparecer no histórico e nos relatórios de agente junto com o receptivo, já separada por sentido (entrada/saída).',
      'Correção interna: reforça a proteção dos endpoints internos usados pela própria central telefônica e corrige o estado do agente após uma chamada de saída não atendida.',
    ],
  },
  {
    version: 'v1.63',
    date: '2026-08-13',
    changes: [
      'Nova aba "Pesquisas (NPS)" no Call Center: crie pesquisas de satisfação pós-atendimento com 4 formatos — nota por dígito (uma ou várias perguntas), resposta falada, ou nota mais comentário gravado opcional — e associe cada fila à pesquisa que ela deve usar, com alerta no Telegram quando a nota vier baixa.',
      'A nota da pesquisa passa a aparecer no histórico da chamada e nos relatórios de fila e de agente.',
      'Correção interna: a chave de acesso à IA usada na transcrição de respostas faladas nunca mais aparece em nenhum log de erro, e a gravação da resposta passa a ficar organizada junto com as demais gravações do sistema.',
    ],
  },
  {
    version: 'v1.64',
    date: '2026-08-13',
    changes: [
      'Editor de fluxos do Call Center: o nó de menu com opções (1-9) ganha um editor visual de dígito + rótulo, com uma saída própria para cada opção, para "sem resposta" e para "opção inválida" — sem mais precisar digitar o identificador interno da seta à mão.',
      'Nova biblioteca de áudios: envie um arquivo de áudio direto pelo editor de fluxo e ele já fica disponível para os nós de menu e de reprodução de áudio — o arquivo é sempre convertido para o formato correto do sistema de telefonia, e o original enviado não é mantido.',
      'O nó "Pausar gravação" do editor de fluxos passa a funcionar de verdade — permite interromper e retomar a gravação da chamada durante a coleta de um dado sensível.',
      'Correção interna: número de dígito repetido no menu não é mais aceito silenciosamente, e trocar de nó no editor sem salvar não confunde mais os campos exibidos.',
    ],
  },
  {
    version: 'v1.65',
    date: '2026-08-13',
    changes: [
      'Supervisão do Call Center: a tela de filas agora mostra, em tempo real, cada cliente esperando na fila com sua posição e tempo de espera.',
      'Novas ações do supervisor sobre uma chamada específica em espera: mover para outra fila ou direcionar direto para um agente — liberadas só para o perfil com a permissão dedicada.',
      'Os botões de escuta do supervisor ganham rótulos mais claros sobre o que cada um faz: falar com o agente sem o cliente ouvir, ouvir a chamada sem ninguém perceber, ou entrar na conversa com os dois participantes.',
      'Correção interna: quando o próprio supervisor também é agente do Call Center, a função de falar com o agente passa a usar o ramal correto em vez de falhar silenciosamente.',
    ],
  },
  {
    version: 'v1.66',
    date: '2026-08-13',
    changes: [
      'Desktop do Agente do Call Center ganha um painel pessoal: resumo do dia (chamadas atendidas, tempo médio de atendimento, tempo logado e tempo em pausa), histórico de chamadas do dia com a nota de satisfação e a transcrição (quando já processada) e o detalhamento das pausas do dia por motivo.',
      'Cada agente só enxerga o próprio histórico e métricas — nunca dados de outro colega.',
    ],
  },
  {
    version: 'v1.67',
    date: '2026-08-13',
    changes: [
      'Chat do Call Center ganha uma tela de canais: cada canal agora define sua própria fila padrão e, opcionalmente, um fluxo de atendimento automático (bot) do editor de fluxos — antes a fila do widget de chat vinha de uma configuração fixa única.',
      'Editor de fluxos ganha um novo nó exclusivo do canal de chat: "Coletar texto", para registrar uma resposta livre digitada pelo cliente numa variável do fluxo.',
      'Correção interna: uma conversa atendida por um fluxo automático não ficava mais travada para sempre quando o fluxo terminava sem transferir para uma fila humana.',
    ],
  },
  {
    version: 'v1.68',
    date: '2026-08-14',
    changes: [
      'Novo módulo "Base de Conhecimento" no Call Center: cadastre artigos próprios ou fontes externas por link, e o chatbot do editor de fluxos passa a poder consultar esse conteúdo para responder o cliente sozinho — só com base no que está cadastrado, nunca inventando resposta; sem trecho relevante encontrado, a conversa segue para atendimento humano.',
      'Custo de IA da base de conhecimento aparece na aba própria do Financeiro, com alerta de gasto mensal configurável desde o primeiro dia.',
    ],
  },
  {
    version: 'v1.69',
    date: '2026-08-14',
    changes: [
      'Aba "Relatórios" do Call Center ganha um relatório de chamada e de chat, linha a linha: fila, agente, tempo de espera, nota de satisfação, fluxo/opção escolhida na URA e categoria/sentimento da transcrição — com filtro por período, fila, agente, nota, tempo de espera, opção escolhida e trecho da transcrição.',
    ],
  },
  {
    version: 'v1.70',
    date: '2026-08-14',
    changes: [
      'Novo relatório de qualidade no Call Center: gere uma execução para um agente, uma fila ou toda a operação, com a nota média e a nota por pergunta da ficha de avaliação, comparando automaticamente com a execução anterior do mesmo recorte.',
      'Calendário de feriados configurável, usado no intervalo mínimo de 5 dias úteis entre duas execuções do mesmo recorte.',
    ],
  },
  {
    version: 'v1.71',
    date: '2026-08-14',
    changes: [
      'Aba "Relatórios" do Call Center ganha 3 novos relatórios: "Gamificação" (ranking de agentes por nota média de satisfação, com volume mínimo de chamadas para entrar no ranking), "Perfil do cliente" (histórico de contatos, top assuntos e nota média de quem mais liga/conversa) e "Produtividade" (login/pausas/logout do agente, volume, e pontos fortes/de melhoria já calculados pela análise de qualidade existente).',
    ],
  },
  {
    version: 'v1.72',
    date: '2026-08-14',
    changes: [
      'Endurecimento de segurança do Call Center: corrigido um risco de escrita arbitrária no servidor de telefonia via variável de fluxo, limitado o número de chamadas simultâneas processadas ao mesmo tempo e adicionados limites de tamanho/frequência nas mensagens do chat público e no envio de áudios da biblioteca de fluxos.',
      'Removida do repositório uma senha padrão fraca do softphone que só valia se o ambiente não tivesse a senha real configurada (produção já estava protegida).',
      'Monitoramento de saúde adicionado aos containers de frontend, proxy HTTPS e retransmissor de chamadas de vídeo/voz (antes só avisavam problema depois de já estarem fora do ar).',
      'Nova seção "Call Center" na página de Documentação, cobrindo operação, fluxos, relatórios e o resumo desta revisão de segurança.',
    ],
  },
  {
    version: 'v1.73',
    date: '2026-08-14',
    changes: [
      'Novo recurso de co-browsing no chat do Call Center: com consentimento explícito e revogável do colaborador, a navegação de tela durante o atendimento pode ser gravada (ativado por agente, na configuração dele) e reproduzida depois na aba "Gravações", com retenção de 60 meses — campos sensíveis (senha, e-mail, telefone, número) nunca são capturados.',
    ],
  },
  {
    version: 'v1.74',
    date: '2026-08-14',
    changes: [
      'Editor de Fluxo do Call Center ganha um simulador: teste o roteiro de um fluxo passo a passo (respostas simuladas por você) sem realizar nenhuma chamada real e sem custo de IA — os nós que consultam a base de conhecimento ou a pesquisa de satisfação respondem em modo simulado, nunca chamando o provedor de IA de verdade.',
    ],
  },
  {
    version: 'v1.75',
    date: '2026-08-14',
    changes: [
      'Novo nó "Horário de funcionamento" no Editor de Fluxo do Call Center: define calendários de atendimento (com turno partido, ex. manhã e tarde) e roteia a chamada para aberto, fechado ou feriado. Feriado pode ser global (fecha todos os calendários) ou específico de um calendário.',
    ],
  },
  {
    version: 'v1.76',
    date: '2026-08-14',
    changes: [
      'Fila do Call Center pode ser configurada para transbordar automaticamente para outra fila quando o tempo de espera ou o tamanho da fila excede um limiar — configuração que forma um ciclo (ex. fila A transborda para B e B transborda de volta para A) é bloqueada na hora de salvar.',
      'Novo nó "Transferir para ramal" no Editor de Fluxo, com validação estrita do número informado antes de qualquer transferência.',
    ],
  },
  {
    version: 'v1.77',
    date: '2026-08-14',
    changes: [
      'Roteamento por skill no Call Center: cada agente pode ter um nível (1 a 5) numa habilidade, e cada fila pode exigir um nível mínimo dessa habilidade para aceitar o agente. A prioridade manual do supervisor continua sendo a única responsável por quem é chamado primeiro — skill só decide quem pode participar da fila, e o recálculo de participação só acontece quando o supervisor pedir explicitamente.',
    ],
  },
  {
    version: 'v1.78',
    date: '2026-08-14',
    changes: [
      'Nova aba "Traço" no Editor de Fluxo do Call Center: busque execuções reais de um fluxo por período e veja o grafo da versão usada naquela chamada com os nós visitados e o caminho seguido destacados. Passo marcado como sensível nunca mostra o valor capturado.',
    ],
  },
  {
    version: 'v1.79',
    date: '2026-08-14',
    changes: [
      'Chat do Call Center ganha limite de chats simultâneos por agente: configurável na fila (vale para quem não tem valor próprio) e no cadastro do agente (sempre prevalece quando definido). Um agente em ligação de voz continua nunca recebendo um chat novo.',
    ],
  },
  {
    version: 'v1.80',
    date: '2026-08-14',
    changes: [
      'Chat do Call Center passa a aceitar anexos, nos dois sentidos (agente e cliente): extensões permitidas são cadastradas uma a uma pelo administrador, cada canal define uma cota de armazenamento por pessoa e por quantos dias o arquivo fica guardado.',
    ],
  },
  {
    version: 'v1.81',
    date: '2026-08-14',
    changes: [
      'Chat do Call Center ganha um canal Telegram: cadastre um canal do tipo Telegram apontando para o token do bot (guardado como referência em Configuração, nunca em texto puro) e o mesmo motor de fluxo/atendimento do webchat passa a valer também para conversas via Telegram, sem rota nova exposta à internet.',
    ],
  },
  {
    version: 'v1.82',
    date: '2026-08-14',
    changes: [
      'Relatórios do Call Center ganham a aba "Fluxo/URA": volume de execuções por desfecho (concluída, transferida para fila/ramal, abandonada, erro), duração média das chamadas e um painel de abandono por nó — mostra exatamente em qual pergunta/menu do fluxo as ligações mais estão morrendo.',
    ],
  },
  {
    version: 'v1.83',
    date: '2026-08-14',
    changes: [
      'Relatórios do Call Center ganham a aba "Chat (agregado)": tempo de primeira resposta (FRT), tempo médio de resposta (ART), concorrência média de chats simultâneos e taxa de contenção do bot (quantas conversas o assistente resolveu sozinho, sem precisar de um agente humano).',
    ],
  },
  {
    version: 'v1.84',
    date: '2026-08-14',
    changes: [
      'Relatórios do Call Center ganham a aba "Timeline do contato": busque um telefone e veja, numa única lista paginada e ordenada por data, todas as chamadas e conversas de chat desse cliente — mesmo vindo de canais diferentes.',
    ],
  },
  {
    version: 'v1.85',
    date: '2026-08-14',
    changes: [
      'O relatório de fila de voz ganha um painel de rechamada e tabulações: quantos clientes ligaram de novo em 24h/7d (mesmo que tenham caído em outra fila) e quais foram as tabulações mais usadas no período.',
    ],
  },
  {
    version: 'v1.86',
    date: '2026-08-14',
    changes: [
      'Os relatórios analíticos de chamada e chat do Call Center ganham exportação em Excel e PDF, respeitando os mesmos filtros já aplicados na busca.',
    ],
  },
  {
    version: 'v1.87',
    date: '2026-08-14',
    changes: [
      'Nova aba "E-mail (SMTP)" em Sistema → Configuração, com botão de teste de conexão — prepara a infraestrutura para o agendamento de relatórios por e-mail do Call Center. Nenhum fluxo do sistema envia e-mail de verdade ainda enquanto o envio não for habilitado.',
    ],
  },
  {
    version: 'v1.88',
    date: '2026-08-14',
    changes: [
      'Relatórios do Call Center ganham agendamento: crie um envio periódico (diário/semanal/mensal) do relatório de chamada ou chat por Telegram ou e-mail — nova aba "Agendamentos".',
    ],
  },
  {
    version: 'v1.89',
    date: '2026-08-14',
    changes: [
      'O relatório de agente de voz ganha escala e aderência: cadastre o turno esperado de cada agente por dia da semana e acompanhe, dia a dia, quanto tempo o agente realmente ficou logado dentro do turno.',
    ],
  },
  {
    version: 'v1.90',
    date: '2026-08-15',
    changes: [
      'Active Directory: a matrícula (employeeID) do usuário passa a ser sincronizada para o espelho local, e a sincronização completa não trunca mais em ADs com mais de 1000 usuários (paginação real).',
      'Nova tela em Configurações → Active Directory: status da última sincronização, botão "Sincronizar agora", consulta de usuário no espelho local e CRUD de mapeamento de grupo AD → grupo de acesso.',
    ],
  },
  {
    version: 'v1.91',
    date: '2026-08-15',
    changes: [
      'Call Center: identificação automática do contato (login de rede, entrada falada confirmada por IA ou número de quem liga) contra o Active Directory, com histórico de atendimentos anteriores do mesmo contato exibido no painel do agente.',
      'Fluxo de voz do Call Center: novo nó "Coletar entrada (voz)" com opção de identificar o contato durante a coleta.',
    ],
  },
  {
    version: 'v1.92',
    date: '2026-08-15',
    changes: [
      'Call Center — Desktop do Agente: painel de "Copiloto de IA" com histórico unificado de atendimentos (voz e chat) e um perfil do contato gerado por IA, com resumo, temas recorrentes, risco de escalonamento e ações sugeridas — cada ação com botão de feedback (útil/não útil).',
      'O perfil de IA é gerado em segundo plano (nunca trava o atendimento) e reaproveitado por 24h antes de ser regerado.',
    ],
  },
  {
    version: 'v1.93',
    date: '2026-08-15',
    changes: [
      'Cadastro de Usuários: agora é possível atribuir um grupo de acesso customizado (RBAC granular) a um usuário, além do Perfil binário Admin/Usuário — só administradores podem fazer essa atribuição.',
    ],
  },
  {
    version: 'v1.94',
    date: '2026-08-15',
    changes: [
      'Call Center — Relatórios: agendamento de relatório por Telegram/e-mail (Fase 9c.6) agora respeita a Unidade de Negócio de quem criou o agendamento, fechando o último gap de BU do relatório 9c — antes, um usuário restrito a uma única BU podia criar um agendamento recorrente que vazava dados de todas as BUs.',
      'Segurança: criar/ativar/desativar/excluir um agendamento de relatório do Call Center agora exige a permissão de escrita da aba (antes, qualquer usuário autenticado conseguia, sem checagem de permissão).',
    ],
  },
];
