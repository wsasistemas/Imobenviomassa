// Conteúdo do guia "Como usar o Disparo de Cobranças e Documentos". Os textos seguem o que o código do portal faz hoje
// (rótulos de botões, limites e validações); se uma tela mudar, atualize o passo correspondente.
// Os prints ficam em public/guias/disparo-em-massa/ (veja docs/treinamento-disparo-em-massa.md).
import type { Guia } from "./tipos";

export const guiaDisparoEmMassa: Guia = {
  slug: "disparo-em-massa",
  titulo: "Como usar o Disparo de Cobranças e Documentos – WSA Sistemas",
  subtitulo:
    "Do primeiro acesso ao acompanhamento das assinaturas: escolha os compradores, o modelo do documento e quem assina, confira e dispare.",
  publico: "Para analistas, equipe administrativa e administradores do portal",
  atualizadoEm: "outubro de 2026",
  passos: [
    {
      id: "acesso",
      titulo: "Acessar o portal e fazer o primeiro login",
      resumo: "Entrar com o e-mail corporativo e definir a sua própria senha.",
      onde: "Tela de login",
      perfil: "Todos os perfis",
      instrucoes: [
        "Abra o endereço do portal Disparo de Cobranças e Documentos no navegador (Edge ou Chrome) e informe o seu e-mail corporativo e a senha que o administrador entregou.",
        "Clique em “Entrar”. Se tudo estiver certo, aparece o aviso “Bem-vindo!”.",
        "No primeiro acesso, o portal abre a tela “Defina uma nova senha”. Em “Senha atual”, digite a senha que você recebeu; depois digite a nova senha em “Nova senha” e repita em “Confirmar senha”.",
        "Clique em “Salvar e entrar”. A nova senha precisa ter de 12 a 128 caracteres e misturar pelo menos três tipos entre letra minúscula, letra maiúscula, número e símbolo.",
      ],
      prints: [
        { arquivo: "01-login.png", legenda: "Tela “Acessar o sistema”: e-mail, senha, link “Esqueceu a senha?” e botão Entrar." },
        { arquivo: "02-trocar-senha.png", legenda: "Tela “Defina uma nova senha”, exibida no primeiro acesso." },
      ],
      alertas: [
        {
          tipo: "dica",
          titulo: "Esqueceu a senha?",
          texto:
            "Na tela de login, clique em “Esqueceu a senha?” e informe o seu e-mail. Chega um link que vale por 30 minutos e uma única vez para criar a nova senha. Se o e-mail não chegar (confira o spam), peça a um Super Admin para gerar uma nova senha.",
        },
        {
          tipo: "atencao",
          titulo: "Bloqueio por tentativas",
          texto:
            "Cinco senhas erradas em 15 minutos bloqueiam a conta por 15 minutos. Um Super Admin pode desbloquear antes disso.",
        },
        {
          tipo: "dica",
          titulo: "Escolha uma senha forte",
          texto:
            "Não use “senha”, o nome da empresa, sequências como 123456 ou qwerty, nem um único caractere repetido. Uma frase longa com números e símbolos funciona bem.",
        },
      ],
    },
    {
      id: "conhecer-portal",
      titulo: "Conhecer o portal e o seu perfil",
      resumo: "Saber onde ficam os menus e o que o seu perfil permite fazer.",
      onde: "Página Inicial",
      perfil: "Todos os perfis",
      instrucoes: [
        "Depois do login você chega à Página Inicial, com uma saudação e os cartões dos módulos que o seu perfil pode usar. O cartão “Novo Disparo” fica em destaque.",
        "Na barra lateral (“Menu Principal”) ficam os grupos Disparo de Cobranças e Documentos, Configurações, Administração, Centro de Treinamento e Minha conta. Clique no nome do grupo para abrir.",
        "Use “Recolher menu” para ganhar espaço na tela. Para encerrar a sessão, clique em “Sair” (no menu lateral ou no ícone no canto superior direito).",
        "O que você vê depende do perfil: Analista usa Dashboard, Novo Disparo, Histórico e Relatórios. Admin soma consulta às Integrações, Gateway de APIs, Logs Gerais e Privacidade. Super Admin soma credenciais, Usuários e Perfis.",
        "Se abrir uma tela que o seu perfil não permite, o portal mostra “Acesso não liberado” e o link “Voltar ao início”.",
      ],
      prints: [{ arquivo: "03-home.png", legenda: "Página Inicial com o menu lateral aberto no grupo Disparo de Cobranças e Documentos." }],
      alertas: [
        {
          tipo: "atencao",
          titulo: "Você vê as suas campanhas",
          texto:
            "O Analista enxerga apenas as campanhas que ele mesmo criou, no Dashboard, no Histórico e nos Relatórios. Admin e Super Admin enxergam todas.",
        },
      ],
    },
    {
      id: "origem",
      titulo: "Iniciar um novo disparo: origem dos compradores",
      resumo: "Dar um nome à campanha e escolher de onde vêm os compradores.",
      onde: "Disparo de Cobranças e Documentos › Novo Disparo › 1. Origem",
      perfil: "Todos os perfis",
      instrucoes: [
        "Clique em “Novo Disparo”, no menu lateral ou no botão do Dashboard. O assistente tem 6 etapas, mostradas no topo: Origem, Compradores, Modelo, Verificação, Assinatura e Revisão.",
        "Escolha a origem: “TOTVS RM” (busca os contratos direto do ERP, por empreendimento) ou “Planilha Excel” (arquivo .xlsx ou .csv).",
        "Preencha o “Nome da campanha” (obrigatório, até 120 caracteres). Exemplo: “Contratos Bloco A — Out/26”.",
        "TOTVS RM: pesquise o empreendimento e clique no cartão dele; os compradores carregam sozinhos. Se a lista estiver desatualizada, clique em “Recarregar”.",
        "Planilha Excel: clique em “Baixar planilha modelo”, preencha e envie o arquivo em “Clique para escolher arquivo”. Colunas obrigatórias: comprador_1, email, telefone, unidade e bloco. Colunas opcionais do 2º comprador: comprador_2, email_2 e telefone_2.",
        "Quando os compradores aparecerem como carregados, clique em “Continuar”. O botão só habilita com origem escolhida, nome preenchido e pelo menos um comprador.",
      ],
      prints: [
        { arquivo: "04-origem-escolha.png", legenda: "Escolha da origem (TOTVS RM ou Planilha Excel) e nome da campanha." },
        { arquivo: "05-origem-planilha.png", legenda: "Origem “Planilha Excel” com o arquivo importado." },
      ],
      alertas: [
        {
          tipo: "atencao",
          titulo: "Limites da planilha",
          texto:
            "Até 5 MB e 5.000 linhas, nos formatos .xlsx, .xls ou .csv. A primeira linha precisa ser o cabeçalho com os nomes das colunas.",
        },
        {
          tipo: "critico",
          titulo: "Não renomeie as colunas do modelo",
          texto:
            "O portal não reclama no envio do arquivo: uma coluna com nome diferente simplesmente fica vazia e o erro só aparece nas etapas seguintes.",
        },
        {
          tipo: "atencao",
          titulo: "Trocar de origem ou reimportar substitui a lista inteira",
          texto: "Todos os compradores carregados antes são descartados e os novos já vêm marcados.",
        },
        {
          tipo: "dica",
          titulo: "Segundo comprador só pela planilha",
          texto: "O TOTVS RM traz um comprador por contrato. Para incluir o 2º comprador, use a planilha com as colunas comprador_2, email_2 e telefone_2.",
        },
      ],
    },
    {
      id: "compradores",
      titulo: "Conferir e selecionar os compradores",
      resumo: "Escolher quem vai receber o documento. Linhas com problema ficam bloqueadas.",
      onde: "Disparo de Cobranças e Documentos › Novo Disparo › 2. Compradores",
      perfil: "Todos os perfis",
      instrucoes: [
        "Use a busca (“Buscar por nome, telefone ou e-mail…”) para localizar alguém. Os selos mostram “Total”, “Válidos” e quantos estão selecionados.",
        "Só pode ser marcada a linha válida: com nome, telefone com DDD (10 a 13 dígitos) e e-mail válido. A coluna “Status” mostra “ok” ou o motivo em vermelho: “sem nome”, “telefone” ou “e-mail”.",
        "Todos os válidos já vêm marcados. Desmarque quem não deve receber, ou use a caixa do cabeçalho para marcar ou desmarcar todos de uma vez.",
        "A tabela mostra 10 linhas por vez: use “Exibir mais 10” ou “Exibir todos”. A coluna “Tipo de comprador” indica “Principal” ou “Principal + 2º comprador”.",
        "Clique em “Continuar com N selecionados”.",
      ],
      prints: [{ arquivo: "06-compradores.png", legenda: "Lista de compradores com o status de cada linha." }],
      alertas: [
        {
          tipo: "critico",
          titulo: "Linha em vermelho não se corrige aqui",
          texto:
            "A tela não permite editar. Corrija a planilha (ou o cadastro no TOTVS RM) e volte à etapa 1 para carregar de novo.",
        },
      ],
      exemplo: {
        titulo: "planilha com 4 compradores",
        texto:
          "Campanha “Contratos Bloco A — Out/26”, com dados fictícios. Esta etapa confere nome, telefone e e-mail; bloco e unidade só são conferidos na Verificação (passo 6).",
        tabela: {
          colunas: ["Bloco", "Unidade", "Nome", "Telefone", "Status"],
          linhas: [
            ["A", "101", "João da Silva", "(11) 98765-4321", "ok"],
            ["A", "102", "Maria Oliveira", "(11) 9876", "telefone"],
            ["B", "202", "Carlos Souza", "(11) 91234-5678", "ok"],
            ["—", "203", "Fernanda Lima", "(11) 99876-5432", "ok"],
          ],
        },
        conclusao:
          "Resultado: 3 de 4 válidos. A Maria fica bloqueada: corrija o telefone na planilha e importe de novo para incluí-la. A Fernanda passa aqui, mas a Verificação vai apontar “Bloco ausente” (passo 6).",
      },
    },
    {
      id: "modelo",
      titulo: "Escolher o modelo do documento e o canal de envio",
      resumo: "Definir qual documento será assinado e por onde o comprador será avisado.",
      onde: "Disparo de Cobranças e Documentos › Novo Disparo › 3. Modelo",
      perfil: "Todos os perfis",
      instrucoes: [
        "O portal lista os modelos de documento cadastrados no DocuSign (os 20 primeiros). Clique no cartão do modelo desejado: aparece o selo “Selecionado”.",
        "Se quiser ver o documento antes de decidir, clique em “Preview”. Na janela, use “Usar este modelo” ou “Fechar”.",
        "No cartão “Canais de envio”, escolha como os compradores serão avisados: “WhatsApp”, “E-mail” ou “Ambos” (o padrão).",
        "Clique em “Continuar”. O botão só habilita com um modelo selecionado.",
      ],
      prints: [{ arquivo: "07-modelo.png", legenda: "Modelos do DocuSign e o cartão “Canais de envio”." }],
      alertas: [
        {
          tipo: "atencao",
          titulo: "O canal escolhido muda as exigências",
          texto:
            "WhatsApp ou Ambos exigem telefone válido. E-mail ou Ambos exigem e-mail válido. Mesmo no canal só WhatsApp, o e-mail do comprador continua obrigatório, porque o DocuSign precisa dele.",
        },
        {
          tipo: "dica",
          titulo: "O canal fica nesta etapa",
          texto: "Ele não aparece na etapa de Assinatura. Se quiser mudar o canal, volte aqui.",
        },
      ],
    },
    {
      id: "verificacao",
      titulo: "Verificação final dos destinatários",
      resumo: "Ver quem está pronto para receber e quem tem dado faltando.",
      onde: "Disparo de Cobranças e Documentos › Novo Disparo › 4. Verificação",
      perfil: "Todos os perfis",
      instrucoes: [
        "Confira os selos “Prontos” e “Com erro”. A tabela mostra cada comprador com o status “pronto” ou “erro” e, na coluna “Erro”, o motivo.",
        "Motivos possíveis: “Nome ausente”, “Telefone/WhatsApp inválido”, “E-mail ausente/inválido”, “Bloco ausente”, “Unidade ausente” e “CPF inválido” (quando um CPF foi informado e não passa na conferência).",
        "Se houver erros, clique em “Baixar erros (N)” para receber o arquivo erros-campanha.csv com a lista do que corrigir.",
        "Se aparecer o aviso amarelo “Campos exigidos pelo modelo selecionado e ausentes na origem”, adicione essas colunas à planilha ou escolha outro modelo que não use esses campos.",
        "Estando tudo certo, clique em “Continuar com N destinatários”.",
      ],
      prints: [{ arquivo: "08-verificacao.png", legenda: "Verificação final: prontos, com erro e o motivo de cada erro." }],
      alertas: [
        {
          tipo: "critico",
          titulo: "Não siga em frente com linhas em erro",
          texto:
            "Esta tela só mostra o resultado, não corrige nada. Volte à etapa 1, ajuste a planilha (ou o cadastro no RM) e importe de novo antes de continuar.",
        },
      ],
    },
    {
      id: "assinatura",
      titulo: "Configurar a assinatura",
      resumo: "Definir o que acontece com o 2º comprador e confirmar prazos e idioma.",
      onde: "Disparo de Cobranças e Documentos › Novo Disparo › 5. Assinatura",
      perfil: "Todos os perfis",
      instrucoes: [
        "Em “Segundo comprador”, escolha uma opção: “Não há segundo comprador”, “Assina o documento” ou “Recebe apenas em cópia (CC)”.",
        "Se o modelo escolhido não tem espaço para um 2º comprador, a opção fica travada em “Não há segundo comprador”, com uma explicação na tela.",
        "No cartão “Prazos e idioma”, confira “Lembrete (dias)”, “Expiração (dias)” e o “Idioma da cerimônia” (Português (Brasil), English (US) ou Español). Mantenha os valores padrão, a menos que a TI oriente outro.",
        "Clique em “Continuar”.",
      ],
      prints: [{ arquivo: "09-assinatura.png", legenda: "Configuração da assinatura: 2º comprador, prazos e idioma." }],
      alertas: [
        {
          tipo: "atencao",
          titulo: "A cópia (CC) só vale no canal E-mail",
          texto:
            "Se o canal escolhido inclui WhatsApp (“WhatsApp” ou “Ambos”), o 2º comprador marcado só para cópia não é incluído no envio. Para ele receber, escolha “Assina o documento” ou use o canal “E-mail”.",
        },
        {
          tipo: "atencao",
          titulo: "2º comprador que assina precisa de dados completos",
          texto:
            "Precisa ter nome, e-mail válido e, se o canal usa WhatsApp, telefone válido. Se faltar algo, ele é ignorado sem aviso. Confira depois no relatório da campanha.",
        },
      ],
    },
    {
      id: "revisao",
      titulo: "Revisar e disparar",
      resumo: "Conferir o resumo, ajustar a mensagem e enviar os documentos.",
      onde: "Disparo de Cobranças e Documentos › Novo Disparo › 6. Revisão",
      perfil: "Todos os perfis",
      instrucoes: [
        "Se o canal inclui WhatsApp, escreva a “Mensagem” que vai junto com o documento (obrigatória, até 1.000 caracteres). Você pode usar {{nome}}, {{empreendimento}} e {{unidade}}, que o portal troca pelos dados de cada comprador. O cartão “Prévia” mostra como fica.",
        "Confira o cartão “Resumo”: origem, quantidade de destinatários, modelo, 2º comprador, lembrete, prazo de expiração, nome da campanha e canais.",
        "Se estiver tudo certo, clique em “Disparar agora”. Abre a janela “Disparando envelopes”, com a porcentagem, os contadores Enviados, Erros e Restantes e a estimativa de tempo.",
        "Aguarde até o fim. Ao concluir, o portal avisa “Disparo concluído: N enviado(s)” e leva você ao Histórico.",
        "Compradores que pediram para não receber (lista de descadastro, LGPD) são pulados automaticamente. O portal avisa quantos e quem foram.",
      ],
      prints: [{ arquivo: "10-revisao.png", legenda: "Revisão: mensagem, prévia, resumo e botão “Disparar agora”." }],
      alertas: [
        {
          tipo: "critico",
          titulo: "Depois de “Disparar agora” não há como desfazer",
          texto:
            "Os documentos seguem de verdade para os compradores. Confira o modelo, o canal, a mensagem e a quantidade de destinatários antes de clicar.",
        },
        {
          tipo: "critico",
          titulo: "Não feche a janela durante o disparo",
          texto:
            "Se a aba for fechada no meio, os destinatários que ainda não foram processados ficam com o erro “Disparo interrompido antes de processar este destinatário”.",
        },
        {
          tipo: "atencao",
          titulo: "Limites",
          texto: "Até 2.000 destinatários por campanha e 5.000 envios por dia por usuário. Acima disso, divida em campanhas ou fale com um administrador.",
        },
      ],
      exemplo: {
        titulo: "como a mensagem é montada",
        texto:
          "Mensagem digitada: “Olá, {{nome}}! O contrato da unidade {{unidade}} do {{empreendimento}} está pronto para assinatura.”",
        conclusao:
          "João da Silva recebe: “Olá, João da Silva! O contrato da unidade 101 do Residencial Jardim das Acácias está pronto para assinatura.”",
      },
    },
    {
      id: "acompanhar",
      titulo: "Acompanhar as assinaturas e exportar",
      resumo: "Ver quem já assinou, reenviar para quem está pendente e baixar o relatório.",
      onde: "Disparo de Cobranças e Documentos › Dashboard, Histórico e Relatórios",
      perfil: "Todos os perfis",
      instrucoes: [
        "Dashboard: mostra “Disparos hoje”, “Documentos enviados”, “Aguardando assinatura” e “Com problema”, além das cinco “Últimas campanhas”.",
        "Histórico: lista simples de todas as campanhas, com busca por nome ou modelo. O botão “Abrir” leva ao relatório da campanha.",
        "Relatórios: lista as campanhas com filtros de status, origem e período (“De” e “Até”). Clique em “Abrir” para ver o detalhe de cada destinatário.",
        "No detalhe, o portal consulta o DocuSign sozinho e atualiza os status a cada 30 segundos enquanto houver pendentes. “Atualizar status” força a consulta na hora.",
        "Os status são “Assinado”, “Pendente assinatura” e “Cancelado”. Clique nos indicadores do topo (Total, Assinados, Pendentes, Cancelados) para filtrar a tabela.",
        "Para quem está “Pendente assinatura”, o botão “Reenviar” manda o aviso de novo pelo mesmo canal.",
        "“Exportar CSV” baixa o relatório com CPF, telefone e e-mail mascarados. “Mostrar contatos” revela telefone e e-mail na tela (o acesso fica registrado). O “Exportar CSV completo” é exclusivo de Admin e Super Admin.",
      ],
      prints: [
        { arquivo: "11-dashboard.png", legenda: "Dashboard com os indicadores e as últimas campanhas." },
        { arquivo: "12-historico.png", legenda: "Histórico de campanhas." },
        { arquivo: "13-relatorios.png", legenda: "Lista de relatórios com filtros e indicadores." },
        { arquivo: "14-relatorio-detalhe.png", legenda: "Detalhe da campanha: status de assinatura de cada destinatário." },
      ],
      alertas: [
        {
          tipo: "atencao",
          titulo: "“Cancelado” também significa falha no envio",
          texto:
            "Quem teve erro de envio aparece como “Cancelado” e não tem o botão “Reenviar”. O motivo está na coluna “erro” do CSV. Para esses casos, crie uma nova campanha só com eles.",
        },
        {
          tipo: "critico",
          titulo: "Relatório com contatos é dado pessoal",
          texto:
            "Não envie o CSV completo nem prints com nomes, CPF, telefone ou e-mail de compradores por e-mail ou chat. Guarde em pasta com acesso restrito (LGPD).",
        },
      ],
    },
    {
      id: "administracao",
      titulo: "Para administradores: usuários, integrações e privacidade",
      resumo: "Cadastrar pessoas, testar as integrações e atender pedidos de LGPD.",
      onde: "Administração e Configurações",
      perfil: "Admin e Super Admin (cada item indica o mínimo)",
      instrucoes: [
        "Usuários (Super Admin): clique em “Novo usuário”, informe nome, e-mail corporativo e perfil e clique em “Salvar usuário”. A “Senha inicial gerada” aparece uma única vez: use “Copiar” e entregue por um canal seguro. Para quem perdeu a senha, use “Gerar nova senha”; para quem foi bloqueado, “desbloquear”.",
        "Perfis (Super Admin): consulta da tabela que mostra o que cada perfil pode fazer. Para mudar o perfil de alguém, use a tela Usuários.",
        "Integrações (Admin consulta, Super Admin altera): em Configurações › Integrações TOTVS RM e Integração DocuSign, use “Testar conexão” para checar se está tudo funcionando. Só o Super Admin cadastra ou troca credenciais.",
        "Logs Gerais (Admin): histórico das ações dos usuários e das tentativas de login. É só consulta.",
        "Privacidade (Admin): em “Direitos do titular”, consulte por CPF/CNPJ, e-mail ou telefone e use “Registrar descadastro” para quem pediu para não receber. A “Lista de descadastro” guarda esses pedidos, e “Retenção automática” anonimiza dados antigos todo dia.",
      ],
      prints: [
        { arquivo: "16-perfis.png", legenda: "Administração › Perfis: o que cada perfil pode fazer." },
        { arquivo: "17-privacidade.png", legenda: "Administração › Privacidade (LGPD)." },
        { arquivo: "18-integracoes.png", legenda: "Configurações › Integrações TOTVS RM." },
      ],
      alertas: [
        {
          tipo: "critico",
          titulo: "Anonimizar é irreversível",
          texto:
            "“Anonimizar este titular” e “Anonimizar campanha” apagam os dados pessoais para sempre. Só o Super Admin consegue executar.",
        },
        {
          tipo: "atencao",
          titulo: "Entregue a senha inicial com cuidado",
          texto: "Ela aparece uma só vez e deve ser enviada diretamente à pessoa. No primeiro acesso, o próprio usuário é obrigado a trocá-la.",
        },
      ],
    },
  ],
  problemas: [
    {
      sintoma: "“E-mail ou senha incorretos.”",
      causa: "E-mail ou senha digitados errado (a mensagem é a mesma se o e-mail não existe).",
      solucao: "Confira os dados. Se não lembra a senha, peça a um Super Admin para gerar uma nova.",
    },
    {
      sintoma: "“Muitas tentativas. Tente novamente em alguns minutos.”",
      causa: "Bloqueio automático depois de várias senhas erradas.",
      solucao: "Aguarde cerca de 15 minutos ou peça a um Super Admin para desbloquear a conta.",
    },
    {
      sintoma: "“Sua conta não tem acesso a este portal.”",
      causa: "A conta não foi cadastrada no portal ou está desativada.",
      solucao: "Peça a um Super Admin para cadastrar ou reativar o seu usuário.",
    },
    {
      sintoma: "“Acesso não liberado”",
      causa: "O seu perfil não tem permissão para essa tela.",
      solucao: "Se precisar da função, peça a um Super Admin para ajustar o seu perfil.",
    },
    {
      sintoma: "“Integração TOTVS RM não configurada” ou “Falha ao consultar TOTVS”",
      causa: "Credenciais do RM não cadastradas ou o RM está fora do ar.",
      solucao: "Avise a TI. Enquanto isso, use a origem “Planilha Excel”.",
    },
    {
      sintoma: "“DocuSign não configurado” ou nenhum modelo aparece",
      causa: "A integração com o DocuSign não está configurada ou perdeu a conexão.",
      solucao: "Peça a um Admin para abrir Configurações › Integração DocuSign e usar “Testar conexão”; se falhar, acione a TI.",
    },
    {
      sintoma: "O botão “Continuar” está desabilitado",
      causa: "Falta o nome da campanha, a origem, nenhum comprador válido marcado ou nenhum modelo escolhido.",
      solucao: "Veja o que a etapa pede: nome preenchido, ao menos um comprador válido marcado e um modelo selecionado.",
    },
    {
      sintoma: "“Formato não suportado”, “Arquivo muito grande” ou “Planilha com linhas demais”",
      causa: "O arquivo está fora dos limites do portal.",
      solucao: "Use .xlsx, .xls ou .csv com até 5 MB e 5.000 linhas. Para listas maiores, divida em mais de uma campanha.",
    },
    {
      sintoma: "Linha com “sem nome”, “telefone” ou “e-mail” em vermelho",
      causa: "O dado está vazio ou inválido na planilha (ou no cadastro do RM).",
      solucao: "Corrija na origem e importe de novo. A tela não permite editar.",
    },
    {
      sintoma: "“Limite de 5000 envios por dia atingido”",
      causa: "O seu usuário já enviou 5.000 documentos nas últimas 24 horas.",
      solucao: "Fale com um administrador antes de tentar de novo.",
    },
    {
      sintoma: "Aviso de compradores “na lista de descadastro”",
      causa: "Esses titulares pediram para não receber comunicações.",
      solucao: "Não é erro: eles são pulados de propósito. Só um Admin remove alguém da lista, e apenas a pedido do próprio titular.",
    },
    {
      sintoma: "Disparo interrompido (aba fechada ou queda de internet)",
      causa: "Os destinatários que ainda não tinham sido processados ficam com erro.",
      solucao: "Abra o relatório da campanha: use “Reenviar” para quem tem envio pendente e crie uma nova campanha só para quem ficou com erro.",
    },
  ],
  suporte:
    "Se o problema continuar, acione o suporte da WSA Sistemas informando o horário, a tela e o texto exato da mensagem de erro. Nunca envie senhas, nem prints ou arquivos com dados de compradores, por e-mail ou chat.",
};
