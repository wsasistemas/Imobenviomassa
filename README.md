# Projeto Docusign

crie o projeto de acordo com o prd abaixo 

1. Visão Geral do Produto

1.1 Resumo Executivo

O Portal de Disparo em Massa via WhatsApp é uma plataforma web interna que permite ao usuário enviar documentos para assinatura a múltiplos compradores de empreendimentos imobiliários de uma só vez, pelo WhatsApp. O usuário seleciona o empreendimento, os compradores e o documento — e o sistema realiza o disparo em massa de forma automática, com acompanhamento em tempo real de cada envio.

A complexidade técnica (integração com TOTVS RM, DocuSign e WhatsApp) é totalmente abstraída. Para o usuário, a experiência é simplesmente: selecionar → conferir → configurar → disparar em massa → acompanhar.

1.2 Experiência do Usuário (Princípio Central)

O usuário nunca deve ver termos como "envelope", "API", "JWT", "polling" ou qualquer linguagem técnica. Para ele, o sistema envia documentos para assinatura via WhatsApp em massa. Ponto.

O que acontece por baixoO que o usuário vêCriação de envelope DocuSign por comprador"Documento enviado para [Nome] via WhatsApp"Loop de chamadas de API individuais"Disparo em massa em andamento — X de Y enviados"Polling de status na API DocuSign"Atualizando status dos envios automaticamente"Consulta de templates via API DocuSign"Escolha o modelo do documento" + preview visualJWT OAuth, Basic Auth, rate limitingInvisível — tratado pelo sistema

1.3 Problema a Resolver

A equipe realiza envios de documentos para assinatura de forma manual, um a um, sem rastreabilidade e com alto esforço operacional. Este portal resolve isso permitindo disparar documentos para centenas de compradores ao mesmo tempo, com histórico completo, conferência visual dos dados e do modelo antes do envio, e status atualizado automaticamente.

1.4 Público-Alvo

Usuários operacionais: Colaboradores que realizam os disparos por empreendimento

Administradores: Responsáveis pela configuração das integrações e gestão de acesso

2. Objetivos e Métricas de Sucesso

ObjetivoMétricaMetaReduzir tempo de disparoTempo médio por campanha< 5 min para 500 destinatáriosRastreabilidade total% de envios com log completo100%ConfiabilidadeTaxa de falha por erro do sistema< 1%AdoçãoUsuários ativos no primeiro mês100% da equipe operacionalPercepção visualSatisfação do usuário com a interface (NPS interno)≥ 8/10

3. Escopo

3.1 Dentro do Escopo (v1.0)

Autenticação com dois perfis: Operacional e Administrador

Interface com design moderno, baseada em um UI Kit / Design System consistente

Duas origens de dados para carregar compradores: TOTVS RM (automático) e Planilha Excel (upload manual)

Preview dos compradores logo após o carregamento, com Comprador, Unidade, Bloco, WhatsApp e E-mail

Validação automática dos dados antes do disparo (CPF/CNPJ, e-mail, WhatsApp, campos obrigatórios)

Seleção do modelo de documento via consulta à API do DocuSign, com preview do documento selecionado

Configuração de quem assina: 4 modalidades de assinatura

Tela de revisão e confirmação antes de disparar

Disparo em massa via WhatsApp com acompanhamento em tempo real

Log completo de todos os envios com status atualizado automaticamente

Histórico de campanhas e exportação de relatório em CSV

Painel administrativo para configuração das integrações (visível apenas para admins)

3.2 Fora do Escopo (v1.0)

Envio por e-mail ou SMS

Criação/edição de modelos de documento dentro do portal (apenas seleção dos já existentes no DocuSign)

Integração com outros sistemas além de TOTVS RM e DocuSign

App mobile nativo

4. Integrações (Visão Técnica — Backstage)

Esta seção é referência para a equipe de desenvolvimento. O usuário final não tem contato com nenhum destes detalhes.

4.1 Origens de Dados

OrigemComportamento para o usuárioImplementação técnicaTOTVS RMSeleciona o empreendimento e os compradores carregam automaticamente, com previewGET via API REST com Basic Auth (2 endpoints prontos)Planilha ExcelFaz upload do arquivo e os dados são importados automaticamente, com previewParse de .xlsx/.xls — colunas: empreendimento, unidade, bloco, comprador, documento, e-mail, telefone

4.2 TOTVS RM

ItemDetalheAutenticaçãoBasic Auth (usuário + senha em Base64) — configurado pelo adminEndpoint 1GET /api/empreendimentos — lista de empreendimentosEndpoint 2GET /api/empreendimentos/{id}/compradores — compradores do empreendimentoCampos retornadosEmpreendimento, Unidade, Bloco, Comprador, Documento (CPF/CNPJ), E-mail, Telefone WhatsApp

4.3 DocuSign

ItemDetalheAutenticaçãoOAuth 2.0 JWT Grant — credenciais configuradas pelo adminListagem de modelosGET /v2.1/accounts/{accountId}/templates — consultada logo após a Etapa 2, para exibição na Etapa 3Preview do modeloGET do documento/thumbnail do template (ou primeira página renderizada) — exibido ao usuário após a seleção na Etapa 3Operação de disparoPOST /v2.1/accounts/{accountId}/envelopes — 1 envelope por comprador, em loopCanal de entregadeliveryMethod: whatsApp — o comprador recebe pelo WhatsAppConsulta de statusGET /v2.1/accounts/{accountId}/envelopes/{envelopeId} — polling automático

Nota técnica: O "disparo em massa" é implementado como um loop de chamadas individuais à API DocuSign, uma por comprador, gerenciado por fila (Redis/Bull ou Celery). A consulta de templates e a geração do preview do modelo ocorrem de forma síncrona na Etapa 3, antes do disparo. O usuário vê apenas o preview do modelo e, na Etapa 7, a barra de progresso e o log de envios. Toda a orquestração é invisível.

5. Fluxo do Usuário — 7 Etapas

O disparo é guiado por um wizard de 7 etapas sequenciais, com indicador de progresso visível em todo momento. A partir da v1.3, a seleção do modelo do documento passou para a Etapa 3, logo após o carregamento dos compradores, e a verificação dos dados passou a ser a Etapa 4.

┌─────────────────────────────────────────────────────────────────────┐
│   Disparo em Massa via WhatsApp                                     │
│   ● Etapa 1  ● Etapa 2  ● Etapa 3  ● Etapa 4  ○ 5  ○ 6  ○ 7          │
└─────────────────────────────────────────────────────────────────────┘

  ETAPA 1                 ETAPA 2                        ETAPA 3
┌─────────────┐    ┌──────────────────────────┐    ┌───────────────────────┐
│  De onde    │    │  Carregar os compradores  │    │  Escolher o modelo    │
│  vêm os     │ →  │                          │ →  │  do documento         │
│  dados?     │    │ Se TOTVS RM: selecione   │    │                       │
│             │    │ o empreendimento          │    │ [Selecione um        │
│ ◉ TOTVS RM  │    │                          │    │  modelo ▼]            │
│   (automát.)│    │ Se Planilha: faça o      │    │                       │
│             │    │ upload do arquivo         │    │ ┌───────────────┐    │
│ ○ Planilha  │    │                          │    │ │  Preview do   │    │
│   Excel     │    │ Preview dos compradores:   │    │ │  documento    │    │
│   (upload)  │    │ ┌───────────────────────┐ │    │ │  selecionado  │    │
│             │    │ │Comprador│Unid.│Bloco│  │ │    │ └───────────────┘    │
│             │    │ │  ...    │ ... │ ... │  │ │    │                       │
│             │    │ │WhatsApp │E-mail       │ │    │                       │
│             │    │ └───────────────────────┘ │    │                       │
└─────────────┘    └──────────────────────────┘    └───────────────────────┘

  ETAPA 4                   ETAPA 5                  ETAPA 6
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Verificar      │    │  Quem assina?    │    │  Revisar e      │
│  os dados       │ →  │                  │ →  │  confirmar      │
│                 │    │ ◉ Só o comprador │    │                 │
│ O sistema       │    │   principal      │    │ Empreend.: ...  │
│ verifica        │    │                  │    │ Destinat.: 124  │
│ automaticam.    │    │ ○ Principal +    │    │ Modelo: ...     │
│ cada comprador: │    │   2º em cópia    │    │ Assinatura: ... │
│                 │    │                  │    │                 │
│ ✅ CPF/CNPJ     │    │ ○ Ambos assinam  │    │ [Confirmar e    │
│ ✅ WhatsApp     │    │   (simultâneo)   │    │  Disparar ▶]    │
│ ✅ E-mail       │    │                  │    │                 │
│ ✅ Nome         │    │ ○ Um após o      │    │                 │
│                 │    │   outro (ordem)  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘

  ETAPA 7
┌──────────────────────────────────────────────────────┐
│  Disparo em andamento                                 │
│                                                        │
│  ████████████████████░░░░░░░░  124 de 200 enviados    │
│                                                        │
│  ✅ João Silva — enviado via WhatsApp                 │
│  ✅ Maria Souza — enviado via WhatsApp                │
│  ✅ Carlos Pereira — enviado via WhatsApp             │
│  ⏳ Ana Lima — aguardando...                          │
│  ...                                                  │
│                                                        │
│  [⏸ Pausar]  [✕ Cancelar]                             │
└──────────────────────────────────────────────────────┘

5.1 Detalhamento das Etapas (linguagem do usuário)

Etapa 1 — De onde vêm os dados? O usuário escolhe a origem dos compradores:

TOTVS RM: o sistema busca os dados automaticamente (o usuário só seleciona o empreendimento)

Planilha Excel: o usuário faz upload de uma planilha com os dados dos compradores

Etapa 2 — Carregar os compradores

Se TOTVS RM: o usuário seleciona o empreendimento em um campo de busca e a lista de compradores carrega automaticamente.

Se Planilha Excel: o usuário faz upload do arquivo .xlsx e o sistema exibe uma pré-visualização dos dados antes de avançar.

Preview dos compradores (novo): independentemente da origem, o sistema exibe uma tabela de preview com, no mínimo, as colunas Comprador, Unidade, Bloco, WhatsApp e E-mail, permitindo ao usuário conferir visualmente os dados carregados antes de prosseguir. A tabela suporta rolagem/paginação para grandes volumes.

Etapa 3 — Escolher o modelo do documento (nova posição) Logo após carregar os compradores, o usuário seleciona qual modelo de documento será enviado. Os modelos disponíveis vêm da consulta em tempo real à API do DocuSign (lista de templates cadastrados pelo administrador). Ao selecionar um modelo, o sistema exibe um preview do documento (miniatura/primeira página) para que o usuário confirme visualmente que escolheu o modelo correto antes de avançar.

Etapa 4 — Verificar os dados (antiga Etapa 3) O sistema verifica automaticamente todos os registros e sinaliza qualquer problema. O usuário vê uma lista com indicador verde (ok) ou vermelho (problema) por comprador. É possível corrigir ou remover registros problemáticos antes de avançar. Só avança quando todos os dados estão corretos.

Etapa 5 — Quem assina? (antiga Etapa 5) O usuário define como os compradores assinarão o documento:

Opção exibida ao usuárioO que aconteceSó o comprador principalApenas o 1º comprador recebe e assinaPrincipal + 2º comprador em cópiaO 1º assina; o 2º recebe uma cópia para ciênciaAmbos assinam ao mesmo tempoOs dois recebem simultaneamente e assinamUm após o outro (em ordem)O 1º assina primeiro; só depois o 2º recebe para assinar

Etapa 6 — Revisar e confirmar (antiga Etapa 6) Tela de resumo com todos os dados da campanha: empreendimento, total de compradores, modelo escolhido (com miniatura do preview) e modalidade de assinatura. O usuário clica em "Confirmar e Disparar" para iniciar.

Etapa 7 — Disparo em andamento (antiga Etapa 7) O sistema envia os documentos para todos os compradores via WhatsApp. O usuário acompanha em tempo real:

Barra de progresso com contador (X de Y enviados)

Log ao vivo com nome de cada comprador e status do envio

Botões de pausar e cancelar disponíveis a qualquer momento

Ao finalizar, exibe o relatório completo da campanha

5.2 Após o Disparo — Acompanhamento de Status

Após o disparo, o usuário acessa a tela de acompanhamento onde vê o status de cada envio, atualizado automaticamente:

Status exibidoSignificado📤 EnviadoDocumento enviado via WhatsApp com sucesso⏳ AguardandoComprador ainda não abriu o documento👁 VisualizadoComprador abriu o documento✅ AssinadoComprador concluiu a assinatura❌ ErroFalha no envio — disponível para reenvio

6. Requisitos Funcionais

6.1 Autenticação e Controle de Acesso

IDRequisitoRF-01O sistema deve ter autenticação por e-mail e senhaRF-02Dois perfis: Administrador e OperacionalRF-03Usuários Operacionais não acessam o menu de configuraçõesRF-04Sessões expiram após inatividade configurável (padrão: 8h)RF-05Senhas armazenadas com hash bcrypt

6.2 Etapa 1 — Seleção de Origem

IDRequisitoRF-06O usuário escolhe entre TOTVS RM ou Planilha Excel como origem dos dadosRF-07A escolha determina o fluxo da Etapa 2

6.3 Etapa 2 — Carregamento dos Compradores e Preview

IDRequisitoRF-08Se TOTVS RM: exibir campo de busca de empreendimento e carregar compradores automaticamente ao selecionarRF-09Se Planilha Excel: permitir upload de .xlsx ou .xls com pré-visualização dos dados importadosRF-10A planilha deve seguir o modelo disponível para download no portal (colunas: Empreendimento, Unidade, Bloco, Comprador, Documento, E-mail, Telefone WhatsApp)RF-11Erros de conexão com o TOTVS devem exibir mensagem clara ao usuário, sem expor detalhes técnicosRF-12(Novo) Exibir tabela de preview dos compradores carregados, com no mínimo as colunas: Comprador, Unidade, Bloco, WhatsApp e E-mailRF-13(Novo) A tabela de preview deve suportar paginação ou rolagem para conjuntos com mais de 50 registrosRF-14(Novo) O usuário deve conseguir avançar para a Etapa 3 somente após confirmar a visualização do preview

6.4 Etapa 3 — Seleção do Modelo do Documento (nova etapa)

IDRequisitoRF-15(Novo) Listar os modelos de documento disponíveis via consulta em tempo real à API do DocuSign (templates cadastrados pelo admin), em formato de dropdown ou cardsRF-16(Novo) Exibir nome e descrição de cada modeloRF-17(Novo) Ao selecionar um modelo, exibir automaticamente um preview visual do documento (miniatura ou primeira página renderizada)RF-18(Novo) Caso a consulta à API do DocuSign falhe, exibir mensagem de erro simplificada, sem termos técnicos, com opção de tentar novamenteRF-19(Novo) O usuário só avança para a Etapa 4 após confirmar a seleção do modelo com o preview visível

6.5 Etapa 4 — Verificação dos Dados (antiga 6.4)

IDRequisitoRF-20O sistema valida automaticamente todos os registros ao avançar da Etapa 2RF-21Campos verificados: CPF/CNPJ (formato e dígito verificador), e-mail (formato), WhatsApp (DDD + número), nome (preenchido), documento (preenchido), empreendimento (preenchido)RF-22Registros com problemas são destacados com indicação do campo e do problema, em linguagem simples (ex: "WhatsApp inválido", "CPF inválido")RF-23O usuário pode corrigir ou remover registros com problemaRF-24O avanço para a Etapa 5 é bloqueado até que todos os registros estejam corretosRF-25Ao concluir a verificação sem problemas, exibir confirmação visual "✅ Todos os dados estão corretos"

6.6 Etapa 5 — Configuração de Assinantes (antiga 6.6)

IDRequisitoRF-26O usuário seleciona uma das 4 modalidades de assinatura, exibidas em linguagem simplesRF-27"Só o comprador principal": apenas o 1º comprador recebe e assinaRF-28"Principal + 2º comprador em cópia": o 1º assina; o 2º recebe cópiaRF-29"Ambos assinam ao mesmo tempo": os dois recebem e assinam simultaneamenteRF-30"Um após o outro (em ordem)": o 1º assina primeiro; o 2º só recebe após a assinatura do 1ºRF-31A modalidade é aplicada a todos os compradores do disparoRF-32Se o comprador tiver apenas 1 pessoa, as modalidades que envolvem 2º comprador são desabilitadas automaticamente ou ignoradas, sem erro para o usuário

6.7 Etapa 6 — Confirmação (antiga 6.7)

IDRequisitoRF-33Exibir resumo da campanha: empreendimento, total de compradores, modelo selecionado (com miniatura), modalidade de assinaturaRF-34Botão "Confirmar e Disparar" inicia o envioRF-35O usuário pode voltar a qualquer etapa anterior antes de confirmar

6.8 Etapa 7 — Disparo em Massa (antiga 6.8)

IDRequisitoRF-36Ao confirmar, o sistema inicia o envio automático para todos os compradores selecionados via WhatsAppRF-37Exibir barra de progresso com contador "X de Y enviados"RF-38Exibir log ao vivo com nome do comprador e status de cada envio, em tempo realRF-39Falha no envio de um comprador não interrompe os demais — o sistema continua e registra o erroRF-40O usuário pode pausar ou cancelar o disparo a qualquer momentoRF-41Ao finalizar, exibir relatório completo da campanhaRF-42Nenhuma linguagem técnica deve aparecer na tela de disparo (sem mencionar "envelope", "API", "DocuSign" etc.)

6.9 Acompanhamento e Status (antiga 6.9)

IDRequisitoRF-43Após o disparo, exibir painel com status de cada envio, atualizado automaticamenteRF-44Status exibidos: Enviado, Aguardando, Visualizado, Assinado, ErroRF-45O usuário pode filtrar por statusRF-46Envios com erro podem ser reenviados individualmente ou em loteRF-47Exportar relatório da campanha em CSV

6.10 Histórico de Campanhas (antiga 6.10)

IDRequisitoRF-48Listar campanhas anteriores com: data, empreendimento, total enviados, total assinados, total com erroRF-49Busca e filtro por data e empreendimentoRF-50Acessar o relatório detalhado de qualquer campanha anterior

6.11 Painel Administrativo (antiga 6.11)

IDRequisitoRF-51Menu exclusivo para admins: Integrações, Modelos de Documento, Usuários, LogsRF-52Aba Integrações — TOTVS RM: campos URL, usuário, senha + botão "Testar conexão"RF-53Aba Integrações — DocuSign: campos Account ID, Integration Key, User ID, Chave Privada (RSA), URL base + botão "Testar conexão"RF-54Aba Modelos: listar, adicionar e remover modelos de documento disponíveis para o disparoRF-55Aba Usuários: criar, editar e inativar usuários, definindo perfil (admin / operacional)RF-56Todas as credenciais armazenadas com criptografia — campos sensíveis mascarados na telaRF-57Botão "Testar conexão" exibe resultado imediato: sucesso ou mensagem de erro simplificadaRF-58Registro de auditoria: toda alteração de configuração registra quem alterou, quando e qual campo

6.12 Design e UI Kit (novo)

IDRequisitoRF-59(Novo) A interface deve ser construída sobre um UI Kit / Design System moderno e consistente (ex.: shadcn/ui, Radix UI ou Material Design), garantindo padronização de componentes, espaçamentos e estadosRF-60(Novo) Todos os componentes reutilizáveis (botões, inputs, tabelas, cards, badges, steppers) devem seguir o mesmo Design System em todas as telasRF-61(Novo) O modo de exibição deve manter consistência visual entre desktop e tablet, conforme RNF-08

7. Requisitos Não Funcionais

IDCategoriaRequisitoRNF-01PerformanceLista de compradores carregada em < 3s para até 1.000 registrosRNF-02PerformanceSuporte a disparos de até 1.000 compradores por campanhaRNF-03PerformanceImportação de planilha processada em < 5s para até 1.000 linhasRNF-04SegurançaCredenciais de integração armazenadas com AES-256RNF-05SegurançaComunicação apenas via HTTPS/TLS 1.2+RNF-06SegurançaNenhuma chave ou credencial de API exposta no frontendRNF-07DisponibilidadeUptime mínimo de 99,5% em horário comercialRNF-08UsabilidadeInterface responsiva (desktop e tablet)RNF-09Rastreabilidade100% dos envios com log completo (status, timestamp, resposta da API)RNF-10AuditoriaTodas as ações do admin registradas com IP, usuário e timestampRNF-11LinguagemNenhum termo técnico exposto ao usuário operacional na interfaceRNF-12CompatibilidadeChrome 120+, Edge 120+, Firefox 120+RNF-13Design(Novo) A interface deve seguir um Design System moderno documentado (tokens de cor, tipografia, espaçamento e componentes), garantindo consistência visual em todo o portalRNF-14Performance(Novo) O preview do modelo de documento (Etapa 3) deve carregar em até 3s após a seleção

8. Design e Interface

8.1 Princípios

Design moderno com uso de UI Kit / Design System consistente, evitando componentes genéricos e desalinhados

Fluxo guiado em 7 etapas com stepper horizontal e indicador de progresso sempre visível

Linguagem simples, direta, orientada ao que o usuário faz — nunca ao que o sistema faz por baixo

Feedback imediato: toasts de sucesso/erro, loaders, progresso em tempo real

Conferência visual em pontos-chave: preview de compradores (Etapa 2) e preview do modelo (Etapa 3)

Tela de disparo é o momento mais importante — deve transmitir controle, clareza e velocidade

Estados claros em todo ponto: o que aconteceu, o que está acontecendo, o que vem a seguir

8.2 Telas Principais

TelaDescriçãoLoginFormulário de acessoDashboardResumo: disparos hoje, documentos enviados, aguardando assinatura, com problema + histórico recenteNovo Disparo (Wizard)Stepper de 7 etapas: Origem → Compradores (com preview) → Modelo (com preview) → Verificação → Assinatura → Confirmação → DisparoAndamento do DisparoBarra de progresso + log ao vivo + contadores + controles (pausar/cancelar)Relatório de CampanhaTabela de status por comprador com filtros, reenvio e exportação CSVHistóricoLista de disparos anteriores com busca e filtrosAdmin → IntegraçõesConfiguração de TOTVS RM e DocuSign com teste de conexãoAdmin → ModelosGerenciamento dos modelos de documento disponíveisAdmin → UsuáriosCriação e gestão de usuários e perfisAdmin → LogsRegistro de auditoria com filtros

8.3 Identidade Visual

Paleta: Azul escuro (#1A2E4A) + Branco + Verde (#22C55E) + Vermelho (#EF4444) + Âmbar (#F59E0B)

Tipografia: Inter — Regular 400 / Medium 500 / Semibold 600

Componentes: Stepper horizontal, cards clicáveis na seleção de origem e modalidade, badges coloridos por status, sidebar fixa, progress bar animada durante o disparo, cards de preview (compradores e modelo de documento)

8.4 UI Kit / Design System (novo)

Adoção de um UI Kit moderno como base de componentes (ex.: shadcn/ui, Radix UI ou Material Design), garantindo consistência, acessibilidade e agilidade no desenvolvimento

Definição de design tokens (cores, espaçamentos, tipografia, raios de borda) centralizados, herdados pela paleta e tipografia definidas em 8.3

Componentes padronizados para: tabelas de preview, cards de seleção, thumbnails/preview de documentos, steppers e badges de status

9. Arquitetura Técnica (Referência para Desenvolvimento)

9.1 Stack Recomendada

CamadaTecnologiaFrontendReact + TypeScript + Tailwind CSS + UI Kit (shadcn/ui ou Radix UI)BackendNode.js (Express) ou Python (FastAPI)Banco de DadosPostgreSQL + Redis (fila e cache)Fila de enviosBull (Node) ou Celery (Python)Processamento ExcelSheetJS (Node) ou openpyxl (Python)Preview de documentoRender de thumbnail/primeira página via API do DocuSign ou renderização de PDF (ex.: pdf.js)AutenticaçãoJWTSecretsAES-256 no banco + variáveis de ambiente

9.2 Fluxo Técnico do Disparo em Massa

Usuário carrega compradores (Etapa 2)
        ↓
Backend consulta templates do DocuSign (GET /templates)
  → Frontend exibe modelos disponíveis (Etapa 3)
        ↓
Usuário seleciona um modelo
  → Backend obtém preview/thumbnail do template selecionado
  → Frontend exibe o preview ao usuário
        ↓
Usuário avança para verificação de dados (Etapa 4) e assinantes (Etapa 5)
        ↓
Usuário confirma o disparo (Etapa 6)
        ↓
Backend valida sessão e permissões
        ↓
Backend consolida lista de compradores validada
        ↓
Backend enfileira 1 job por comprador (Redis/Bull)
  → Cada job carrega a modalidade de assinatura escolhida e o modelo selecionado
        ↓
Workers processam a fila com rate limiting configurável:
  → Autenticam no DocuSign (token cacheado / refresh automático)
  → POST /envelopes com deliveryMethod: whatsApp
  → Recipients configurados conforme modalidade de assinatura
  → Grava log no PostgreSQL (envelope ID, status, timestamp)
        ↓
Frontend recebe progresso via WebSocket ou SSE
  → Atualiza barra de progresso e log ao vivo em tempo real
        ↓
Polling automático consulta status dos envelopes a cada 5 min (configurável)
  → Atualiza status na tela de acompanhamento (Enviado → Visualizado → Assinado)

9.3 Diagrama de Integração

[Portal Web]
    │
    ├─→ [Backend API]
    │       │
    │       ├─→ [TOTVS RM]  ← Basic Auth
    │       │      └─ GET /empreendimentos
    │       │      └─ GET /empreendimentos/{id}/compradores
    │       │
    │       ├─→ [Parser Excel]  ← Upload do usuário
    │       │      └─ Leitura + validação de colunas
    │       │
    │       ├─→ [DocuSign API]  ← JWT OAuth 2.0
    │       │      └─ GET /templates                (Etapa 3)
    │       │      └─ GET /templates/{id}/preview    (Etapa 3 — preview)
    │       │      └─ POST /envelopes (1 por comprador, via fila)
    │       │      └─ GET /envelopes/{id} (polling de status)
    │       │
    │       └─→ [PostgreSQL]  ← logs, campanhas, credenciais criptografadas
    │
    └─→ [WebSocket / SSE]  ← progresso em tempo real para o frontend

10. Modelo de Dados

10.1 Tabela: campanhas

CampoTipoDescriçãoidUUIDChave primárianomeVARCHARNome da campanhaorigemENUMtotvs_rm, planilha_excelempreendimento_idVARCHARID no TOTVS (se aplicável)empreendimento_nomeVARCHARNome do empreendimentomodelo_idVARCHARID do template no DocuSignmodelo_preview_urlVARCHARURL/referência interna do preview do modelo selecionadomodalidade_assinaturaENUMapenas_principal, principal_copia, ambos_paralelo, sequencialstatusENUMem_andamento, concluida, pausada, canceladatotal_destinatariosINTEGERtotal_enviadosINTEGERtotal_errosINTEGERusuario_idUUIDFK → usuárioscriada_emTIMESTAMPconcluida_emTIMESTAMP

10.2 Tabela: envios

CampoTipoDescriçãoidUUIDChave primáriacampanha_idUUIDFK → campanhascomprador_nomeVARCHARNome do comprador principalcomprador_documentoVARCHARCPF/CNPJcomprador_telefoneVARCHARWhatsAppcomprador_emailVARCHARE-mailsegundo_comprador_nomeVARCHARNome do 2º comprador (se aplicável)segundo_comprador_telefoneVARCHARWhatsApp do 2º compradorunidadeVARCHARUnidade do empreendimentoblocoVARCHAR(Novo) Bloco do empreendimentoenvelope_idVARCHARID interno (DocuSign) — nunca exibido ao usuáriostatusENUMenviado, aguardando, visualizado, assinado, erroresposta_apiJSONBResposta técnica — log internoerro_mensagemTEXTMensagem técnica de erro — log internotentativasINTEGERNúmero de tentativasenviado_emTIMESTAMPstatus_atualizado_emTIMESTAMP

10.3 Tabela: configuracoes

CampoTipoDescriçãoidUUIDChave primáriaservicoENUMtotvs_rm, docusignchaveVARCHARNome do campovalorTEXTValor criptografado (AES-256)atualizado_porUUIDFK → usuáriosatualizado_emTIMESTAMP

11. Riscos e Mitigações

RiscoImpactoProbabilidadeMitigaçãoLimite de envios da API DocuSign atingidoAltoMédiaFila com controle de cadência configurável pelo adminSistema TOTVS indisponívelMédioBaixaCache da última lista + mensagem clara ao usuário para tentar novamenteToken DocuSign expirado durante disparoAltoMédiaRefresh automático antes de cada envio; transparente para o usuárioWhatsApp inválido no cadastroMédioAltaValidação obrigatória na Etapa 4 impede o avanço com dados incorretosPlanilha fora do formato esperadoAltoAltaTemplate de planilha disponível para download; validação de cabeçalhos na importaçãoComprador com apenas 1 pessoa em modalidade de 2 assinantesMédioAltaSistema aplica automaticamente a modalidade de 1 assinante e registra no logFalha parcial no meio do disparoAltoMédiaEstado persistido; usuário pode reenviar apenas os que falharamVolume acima de 1.000 compradoresMédioBaixaProcessamento em lotes com feedback visual; usuário não percebe a divisãoPreview do modelo indisponível/lento (API DocuSign)MédioMédiaExibir estado de carregamento e, em caso de falha, permitir avançar com aviso simples, mantendo o nome do modelo selecionado

12. Critérios de Aceite

Epic 1 — Autenticação

 Login funciona com e-mail e senha

 Perfis Admin e Operacional têm acessos distintos

 Sessão expira após período configurado

Epic 2 — Seleção de Origem (Etapa 1)

 Usuário pode escolher entre TOTVS RM e Planilha Excel

 Cada opção apresentada de forma clara, sem jargão técnico

Epic 3 — Carregamento de Compradores e Preview (Etapa 2)

 TOTVS RM: empreendimentos listados corretamente; compradores carregam ao selecionar

 Excel: upload funciona; pré-visualização exibida antes de avançar

 Template de planilha disponível para download (incluindo coluna Bloco)

 Erros de carregamento exibem mensagem simples, sem termos técnicos

Preview dos compradores exibido com Comprador, Unidade, Bloco, WhatsApp e E-mail

Epic 4 — Seleção do Modelo do Documento (Etapa 3, nova)

 Modelos listados corretamente via API do DocuSign

 Preview do documento exibido automaticamente após a seleção

 Falha na consulta/preview exibe mensagem simples com opção de tentar novamente

 Avanço bloqueado até confirmação da seleção do modelo

Epic 5 — Verificação de Dados (Etapa 4)

 Todos os campos obrigatórios são verificados automaticamente

 CPF/CNPJ validado com dígito verificador

 WhatsApp e e-mail validados por formato

 Problemas sinalizados com linguagem simples por registro

 Avanço bloqueado com dados incorretos; liberado ao corrigir todos

Epic 6 — Assinatura (Etapa 5)

 4 modalidades de assinatura disponíveis e funcionando

 Linguagem das opções é simples, sem termos do DocuSign

Epic 7 — Confirmação e Disparo (Etapas 6 e 7)

 Resumo da campanha exibido corretamente, incluindo miniatura do modelo

 Disparo inicia ao confirmar

 Barra de progresso e log ao vivo funcionam em tempo real

 Falhas individuais não interrompem o lote

 Pausar e cancelar funcionam

 Nenhum termo técnico aparece na tela de disparo

Epic 8 — Acompanhamento e Relatório

 Status atualizado automaticamente após o disparo

 5 status exibidos com linguagem simples e ícones

 Filtro por status funciona

 Reenvio de erros funciona

 Exportação CSV funciona

 Histórico de campanhas acessível com relatório detalhado

Epic 9 — Painel Admin

 Configurações de integração salvas com criptografia

 Teste de conexão funciona para TOTVS RM e DocuSign

 Gestão de usuários e perfis funciona

 Gestão de modelos de documento funciona

 Log de auditoria registrado

Epic 10 — Design e UI Kit (novo)

 Interface construída sobre UI Kit/Design System moderno e consistente

 Componentes padronizados (botões, tabelas, cards, badges) em todas as telas

 Consistência visual mantida em desktop e tablet

13. Roadmap Sugerido

FaseEntregávelPrazo EstimadoFase 1Autenticação + estrutura do projeto + Design System/UI Kit + painel admin (integrações, usuários, modelos)Semana 1–2Fase 2Integração TOTVS RM + importação de Planilha Excel + preview de compradoresSemana 3Fase 3Etapa de Seleção de Modelo via API DocuSign + preview do documentoSemana 4Fase 4Etapa de Verificação Automática de DadosSemana 5Fase 5Configuração de assinantes + fila de disparoSemana 6Fase 6Disparo em massa + progresso em tempo real (WebSocket/SSE)Semana 7Fase 7Acompanhamento de status automático + relatório + exportação CSVSemana 8Fase 8Testes, revisão de UX, linguagem do usuário, go-liveSemana 9

14. Glossário

Para o Usuário (linguagem da interface)

Termo na interfaceSignificadoDisparo em massaEnvio do documento para assinatura a todos os compradores ao mesmo tempo via WhatsAppModelo de documentoEstrutura do documento que será enviado para assinaturaPreview do modeloVisualização prévia do documento antes do envioCampanhaUm disparo em massa realizado para um grupo de compradoresAguardandoO comprador ainda não abriu o documentoVisualizadoO comprador abriu o documentoAssinadoO comprador concluiu a assinatura

## Desenvolvimento local

Requer Node.js 22+ e npm (o lockfile é o `package-lock.json`).

```sh
cp .env.example .env   # preencha com as chaves do Supabase
npm ci
npm run dev            # http://localhost:8080
```

## Deploy na Vercel + Supabase

O app (TanStack Start) é compilado pelo Nitro com o preset `vercel`, gerando a
saída em `.vercel/output`. Banco, auth e Edge Functions ficam no Supabase.

1. Importe o repositório na Vercel. O `vercel.json` já define install/build (`npm ci` / `npm run build`);
   deixe o *Framework Preset* como **Other**.
2. Em **Settings → Environment Variables**, cadastre as variáveis de
   [.env.example](.env.example) (incluindo `SUPABASE_SERVICE_ROLE_KEY`, disponível em
   Supabase → Project Settings → API). A service role fica **só** na Vercel e no `.env`
   local, que está no `.gitignore` — nunca em variável `VITE_*` nem no repositório.
3. No Supabase, em **Authentication → URL Configuration**, adicione o domínio da
   Vercel em *Site URL* / *Redirect URLs*.
4. Edge Functions (`supabase/functions`) seguem publicadas no Supabase:
   `supabase functions deploy <nome>` e secrets via `supabase secrets set`.
5. **Cabeçalhos de segurança** (HSTS, `X-Frame-Options`, `Content-Security-Policy` etc.) estão em
   [vercel.json](vercel.json) e valem para todas as rotas. A CSP libera só o próprio domínio, o
   Supabase (`*.supabase.co`, HTTPS e WebSocket) e o DocuSign (script `js.docusign.com` /
   `js-d.docusign.com`, iframe de assinatura em `*.docusign.net` / `*.docusign.com`); ao adicionar
   outro serviço externo (script, fonte, API), inclua a origem na diretiva correspondente.
   Para conferir depois do deploy:

   ```sh
   curl -I https://<dominio-na-vercel>/ | grep -i -E "strict-transport|content-security|x-frame|x-content-type|referrer-policy|permissions-policy"
   ```

   Se algo da tela parar de carregar, o console do navegador mostra qual diretiva bloqueou.

## Integração TOTVS RM

Segue o mesmo modelo do Portal DP (mesmo projeto Supabase, schemas separados):

- **Credenciais:** usuário e senha do RM são comuns a todas as integrações; cada integração
  (empreendimentos, compradores) tem o seu endpoint (URL completa). Ficam no schema privado
  `envio_privado`, fora da Data API, e só a chave `service_role` lê — pelas funções `public.rm_*`.
  A senha nunca volta para a tela nem vai para log.
- **Chamada:** o servidor do app (Vercel) chama o RM direto, com Basic Auth
  ([rm.server.ts](src/lib/integracoes/rm.server.ts)). Não há mais Edge Function intermediária.
- **Tela:** Configurações → Integrações TOTVS RM. Admin testa a conexão; só Super Admin cadastra
  ou troca as credenciais.

Implantação:

1. No SQL Editor, rode `supabase/migrations/20260929120000_rm_credenciais_privado.sql` (cria o schema
   privado e copia usuário, senha e endpoints de `public.totvs_config`).
2. Publique o app e as Edge Functions do gateway: `supabase functions deploy api-proxy totvs-soap-proxy`.
3. Remova a Edge Function antiga: `supabase functions delete totvs-proxy`, e os secrets que não são
   mais usados: `supabase secrets unset TOTVS_USER TOTVS_PASSWORD`.
4. Confira a tela de Integrações e o "Testar conexão"; depois rode
   `supabase/pos-migracao/20260929_remover_totvs_config.sql` para apagar a tabela antiga (senha em
   texto legível).

## Privacidade e LGPD

O portal trata CPF, telefone e e-mail de compradores. Base legal, inventário de dados, retenção
(anonimização automática após 12 meses), direitos do titular (Administração › Privacidade),
backup/restauração e o roteiro de resposta a incidentes estão em
[docs/lgpd-privacidade.md](docs/lgpd-privacidade.md). O plano e o histórico das correções de
segurança estão em [docs/plano-correcao-seguranca.md](docs/plano-correcao-seguranca.md).

## Segurança (antes do deploy)

- **Acesso aos dados do RM por papel:** listar empreendimentos e compradores (CPF, telefone,
  e-mail) exige perfil Analista, Admin ou Super Admin. Contas com o papel padrão `cliente` não leem
  esses dados.
- **Conta ativa e troca de senha no servidor e no banco:** `wa_project_users` (ativo /
  troca de senha pendente) é lida em toda server function e nas Edge Functions, e só o servidor
  escreve nela (policies de escrita removidas + trigger). A flag de troca só é desligada por
  `trocarMinhaSenha`, que confere a senha atual antes de gravar a nova.
- **Credenciais fora da Data API:** TOTVS RM (`envio_privado`) e DocuSign (`docusign_config`, sem
  policies) só são lidos e gravados pelo servidor com a `service_role`. Só Super Admin altera.
- **Gateway:** cadastrar/apagar APIs é de Super Admin (RLS); `totvs-soap-proxy` só chama o host do
  endpoint cadastrado em Integrações TOTVS RM; `api-proxy` recusa secrets do runtime
  (`SUPABASE_*`, service_role, URL do banco) como credencial de API e descarta cabeçalhos extras
  sensíveis (`Authorization`, `apikey`, `Cookie`, …).
- **Sem auto-cadastro:** a tela de login não cria contas; usuários são criados em
  Administração → Usuários. Desative também o cadastro no Supabase (Authentication →
  Sign In / Providers → desmarcar **Allow new users to sign up**), para fechar a API de signup.
- **Sessões:** desativar um usuário não encerra sessões abertas em outros sistemas Calper (a conta
  de login é compartilhada); neste portal o acesso é negado na próxima chamada ao servidor.
- **Depois de publicar as Edge Functions**, rode
  `supabase/pos-migracao/20260929_remover_totvs_config.sql` — a tabela antiga ainda guarda a
  senha do RM em texto legível.

## Permissões por aplicativo (Central de acessos da Calper)

A mesma regra vale em todos os sistemas do projeto Supabase (Gestão Comercial, Financeiro, Gestão de
Contratos, Portal DP). Depois do login o portal pergunta `pode_acessar_app('disparo_massa')`
(`src/lib/app-access.ts`, chave em `src/lib/app-key.ts`): no login, ao abrir a área logada, na renovação
do token e ao voltar para a aba. Se a resposta for "não", a sessão é encerrada e abre o pop-up
**"Sem permissão nessa aplicação, contacte o Administrador."**. Só um "não" explícito bloqueia: erro ou
função inexistente deixam entrar.

- **Duas travas:** a da Central e a do próprio portal (membro ativo em `wa_project_users` + perfil). As
  server functions também consultam a Central (`src/lib/authz.ts`).
- **Menu** Administração › **Permissões por aplicativo** (`/administracao/permissoes-aplicativo`): a mesma
  tela dos outros sistemas, grava no schema `acessos`. Só aparece para o **Super admin da Central**
  (`public.pa_sou_super_admin()`), não pelo perfil deste portal.
- **Cadastro na Central:** como o portal usa o schema `public` (compartilhado), ele é adicionado à mão:
  Permissões por aplicativo › **Adicionar** → chave `disparo_massa`, schema de dados `public`. Enquanto o
  controle estiver desligado, todo login da Calper passa pela Central (as travas do portal continuam).

