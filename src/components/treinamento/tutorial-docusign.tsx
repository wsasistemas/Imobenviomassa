import {
  Alvo,
  MBotao,
  MCampo,
  MCard,
  MCheck,
  MJanela,
  MOpcao,
  MPassos,
  MSelo,
  MTabela,
  type Tutorial,
} from "./tutorial-mockup";

// Tutorial ilustrado — Envio de documentos para assinatura (DocuSign). Dados fictícios.

const PASSOS = ["Origem", "Compradores", "Modelo", "Verificação", "Assinatura", "Revisão"];
const TRILHA = "Início / Disparo de Cobranças e Documentos / DocuSign / Novo Disparo";

export const tutorialDocusign: Tutorial = {
  slug: "tutorial-docusign",
  titulo: "Tutorial: envio para assinatura (DocuSign)",
  subtitulo:
    "Do Novo disparo às assinaturas: escolha os compradores, o modelo, quem assina, confira e dispare.",
  passos: [
    {
      id: "inicio",
      titulo: "Começar pelo Novo disparo",
      onde: "Página Inicial",
      explicacao:
        "Na Página Inicial, clique em Novo disparo e escolha DocuSign para enviar documentos para assinatura em lote.",
      acoes: ["Clique em “Novo disparo”.", "Escolha “DocuSign”: abre o assistente de 6 etapas."],
      dica: "Também dá para entrar pelo menu: Disparo de Cobranças e Documentos › DocuSign › Novo Disparo.",
      tela: () => (
        <MJanela trilha="Início" titulo="Boa tarde, Ana" menu="Página Inicial">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[radial-gradient(120%_140%_at_100%_0%,oklch(0.62_0.1_245)_0%,oklch(0.46_0.1_252)_60%,oklch(0.33_0.07_258)_100%)] p-3.5 text-white">
            <div>
              <b className="text-[14px]">Escolha o tipo de disparo</b>
              <p className="text-[10.5px] text-white/85">
                Boletos por WhatsApp e e-mail, ou documentos para assinatura pelo DocuSign.
              </p>
            </div>
            <Alvo n={1}>
              <span className="inline-flex h-7 items-center rounded-[7px] bg-white px-2.5 text-[11px] font-semibold text-foreground">
                Novo disparo
              </span>
            </Alvo>
          </div>
          <MCard titulo="Qual tipo de disparo?">
            <div className="grid grid-cols-2 gap-2">
              <MOpcao titulo="Boleto" texto="Régua de Cobrança." />
              <Alvo n={2}>
                <MOpcao
                  ativo
                  titulo="DocuSign"
                  texto="Empreendimento, compradores e modelo DocuSign."
                />
              </Alvo>
            </div>
          </MCard>
        </MJanela>
      ),
    },
    {
      id: "origem",
      titulo: "Origem dos compradores e nome da campanha",
      onde: "DocuSign › Novo Disparo › 1. Origem",
      explicacao:
        "Os compradores vêm do TOTVS RM, por empreendimento, ou de uma planilha no modelo. Dê um nome à campanha para encontrá-la depois.",
      acoes: [
        "Escolha “TOTVS RM” ou “Planilha Excel”.",
        "Preencha o “Nome da campanha” (ex.: “Contratos Bloco A — Out/26”).",
        "TOTVS RM: clique no cartão do empreendimento; os compradores carregam sozinhos.",
        "Clique em “Continuar”.",
      ],
      tela: () => (
        <MJanela trilha={TRILHA} titulo="Novo Disparo" menu="DocuSign">
          <MPassos passos={PASSOS} atual={1} />
          <Alvo n={1}>
            <div className="grid grid-cols-2 gap-2">
              <MOpcao ativo titulo="TOTVS RM" texto="Contratos direto do ERP" />
              <MOpcao titulo="Planilha Excel" texto=".xlsx ou .csv" />
            </div>
          </Alvo>
          <Alvo n={2}>
            <MCampo rotulo="Nome da campanha *" valor="Contratos Bloco A — Out/26" />
          </Alvo>
          <Alvo n={3}>
            <div className="grid grid-cols-3 gap-1.5">
              <MOpcao
                ativo
                titulo="Residencial Jardim das Acácias"
                texto="Cód. 104 · 48 compradores"
              />
              <MOpcao titulo="Residencial Vista Mar" texto="Cód. 087" />
              <MOpcao titulo="Torre Aurora" texto="Cód. 112" />
            </div>
          </Alvo>
          <div className="flex justify-end">
            <Alvo n={4}>
              <MBotao>Continuar →</MBotao>
            </Alvo>
          </div>
        </MJanela>
      ),
    },
    {
      id: "compradores",
      titulo: "Conferir e selecionar os compradores",
      onde: "DocuSign › Novo Disparo › 2. Compradores",
      explicacao:
        "Só entra quem tem nome, telefone com DDD e e-mail válido. Os válidos já vêm marcados; desmarque quem não deve receber.",
      acoes: [
        "Use a busca para localizar alguém e confira os selos Total, Válidos e Selecionados.",
        "Linha com motivo em vermelho (“telefone”, “e-mail”) não pode ser marcada: corrija na origem.",
        "Clique em “Continuar com N selecionados”.",
      ],
      tela: () => (
        <MJanela trilha={TRILHA} titulo="Novo Disparo" menu="DocuSign">
          <MPassos passos={PASSOS} atual={2} />
          <Alvo n={1}>
            <div className="flex items-center gap-1.5">
              <MCampo rotulo="Buscar" vazio="Buscar por nome, telefone ou e-mail…" />
              <MSelo>Total 4</MSelo>
              <MSelo tom="success">Válidos 3</MSelo>
              <MSelo tom="info">Selecionados 3</MSelo>
            </div>
          </Alvo>
          <Alvo n={2}>
            <MTabela
              colunas={["", "Comprador", "Telefone", "E-mail", "Unidade", "Status"]}
              linhas={[
                [
                  <MCheck marcado />,
                  "João da Silva",
                  "(11) 9****-5678",
                  "j****@exemplo.com",
                  "Bl A 101",
                  <MSelo tom="success">ok</MSelo>,
                ],
                [
                  <MCheck marcado />,
                  "Carlos Souza",
                  "(11) 9****-4321",
                  "c****@exemplo.com",
                  "Bl A 102",
                  <MSelo tom="success">ok</MSelo>,
                ],
                [
                  <MCheck />,
                  "Maria Lima",
                  "(11) 1234",
                  "m****@exemplo.com",
                  "Bl A 201",
                  <MSelo tom="danger">telefone</MSelo>,
                ],
                [
                  <MCheck marcado />,
                  "Fernanda Rocha",
                  "(11) 9****-1111",
                  "f****@exemplo.com",
                  "202",
                  <MSelo tom="success">ok</MSelo>,
                ],
              ]}
            />
          </Alvo>
          <div className="flex justify-end">
            <Alvo n={3}>
              <MBotao>Continuar com 3 selecionados →</MBotao>
            </Alvo>
          </div>
        </MJanela>
      ),
    },
    {
      id: "modelo",
      titulo: "Escolher o modelo e o canal",
      onde: "DocuSign › Novo Disparo › 3. Modelo",
      explicacao:
        "O portal lista os modelos de documento do DocuSign. Escolha o modelo e como os compradores serão avisados.",
      acoes: [
        "Clique no cartão do modelo: aparece o selo “Selecionado”. Use “Preview” para ver o documento.",
        "Em “Canais de envio”, escolha WhatsApp, E-mail ou Ambos.",
        "Clique em “Continuar”.",
      ],
      dica: "Mesmo no canal só WhatsApp, o e-mail do comprador é obrigatório: o DocuSign precisa dele.",
      tela: () => (
        <MJanela trilha={TRILHA} titulo="Novo Disparo" menu="DocuSign">
          <MPassos passos={PASSOS} atual={3} />
          <Alvo n={1}>
            <div className="grid grid-cols-3 gap-1.5">
              <MOpcao ativo titulo="Contrato de Compra e Venda" texto="✓ Selecionado · Preview" />
              <MOpcao titulo="Aditivo de Prazo" texto="Preview" />
              <MOpcao titulo="Termo de Vistoria" texto="Preview" />
            </div>
          </Alvo>
          <Alvo n={2}>
            <MCard titulo="Canais de envio">
              <div className="grid grid-cols-3 gap-1.5">
                <MOpcao titulo="WhatsApp" />
                <MOpcao titulo="E-mail" />
                <MOpcao ativo titulo="Ambos" />
              </div>
            </MCard>
          </Alvo>
          <div className="flex justify-end">
            <Alvo n={3}>
              <MBotao>Continuar →</MBotao>
            </Alvo>
          </div>
        </MJanela>
      ),
    },
    {
      id: "verificacao",
      titulo: "Verificação final dos destinatários",
      onde: "DocuSign › Novo Disparo › 4. Verificação",
      explicacao:
        "O portal confere cada comprador contra o modelo escolhido: nome, telefone, e-mail, bloco, unidade e CPF.",
      acoes: [
        "Confira os selos “Prontos” e “Com erro” e a coluna “Erro”.",
        "Se houver erros, clique em “Baixar erros (N)” e corrija a origem.",
        "Estando tudo certo, clique em “Continuar com N destinatários”.",
      ],
      tela: () => (
        <MJanela trilha={TRILHA} titulo="Novo Disparo" menu="DocuSign">
          <MPassos passos={PASSOS} atual={4} />
          <Alvo n={1}>
            <div className="flex flex-col gap-1.5">
              <div className="flex gap-1.5">
                <MSelo tom="success">Prontos 2</MSelo>
                <MSelo tom="danger">Com erro 1</MSelo>
              </div>
              <MTabela
                colunas={["Comprador", "Unidade", "Status", "Erro"]}
                linhas={[
                  ["João da Silva", "Bl A 101", <MSelo tom="success">pronto</MSelo>, "—"],
                  ["Carlos Souza", "Bl A 102", <MSelo tom="success">pronto</MSelo>, "—"],
                  ["Fernanda Rocha", "202", <MSelo tom="danger">erro</MSelo>, "Bloco ausente"],
                ]}
              />
            </div>
          </Alvo>
          <div className="flex justify-between">
            <Alvo n={2}>
              <MBotao tipo="contorno">⬇ Baixar erros (1)</MBotao>
            </Alvo>
            <Alvo n={3}>
              <MBotao>Continuar com 2 destinatários →</MBotao>
            </Alvo>
          </div>
        </MJanela>
      ),
    },
    {
      id: "assinatura",
      titulo: "Configurar a assinatura",
      onde: "DocuSign › Novo Disparo › 5. Assinatura",
      explicacao: "Defina o papel do segundo comprador e os prazos do envelope.",
      acoes: [
        "Em “Segundo comprador”, escolha: não há, assina o documento ou recebe em cópia (CC).",
        "Confira lembrete, expiração e idioma da cerimônia (mantenha o padrão, salvo orientação da TI).",
        "Clique em “Continuar”.",
      ],
      dica: "A cópia (CC) só vale no canal E-mail. Com WhatsApp, o 2º comprador em cópia não é incluído.",
      tela: () => (
        <MJanela trilha={TRILHA} titulo="Novo Disparo" menu="DocuSign">
          <MPassos passos={PASSOS} atual={5} />
          <Alvo n={1}>
            <MCard titulo="Segundo comprador">
              <div className="grid grid-cols-3 gap-1.5">
                <MOpcao titulo="Não há segundo comprador" />
                <MOpcao ativo titulo="Assina o documento" />
                <MOpcao titulo="Recebe em cópia (CC)" />
              </div>
            </MCard>
          </Alvo>
          <Alvo n={2}>
            <MCard titulo="Prazos e idioma">
              <div className="grid grid-cols-3 gap-1.5">
                <MCampo rotulo="Lembrete (dias)" valor="3" />
                <MCampo rotulo="Expiração (dias)" valor="30" />
                <MCampo rotulo="Idioma" valor="Português (Brasil)" />
              </div>
            </MCard>
          </Alvo>
          <div className="flex justify-end">
            <Alvo n={3}>
              <MBotao>Continuar →</MBotao>
            </Alvo>
          </div>
        </MJanela>
      ),
    },
    {
      id: "revisao",
      titulo: "Revisar e disparar",
      onde: "DocuSign › Novo Disparo › 6. Revisão",
      explicacao:
        "Escreva a mensagem do WhatsApp (se o canal incluir WhatsApp), confira o resumo e dispare. Depois de disparar não há como desfazer.",
      acoes: [
        "Escreva a “Mensagem” usando {{nome}}, {{empreendimento}} e {{unidade}}; a prévia mostra como chega.",
        "Confira o “Resumo”: origem, destinatários, modelo, 2º comprador, prazos e canais.",
        "Clique em “Disparar agora” e aguarde até o fim, sem fechar a janela.",
      ],
      tela: () => (
        <MJanela trilha={TRILHA} titulo="Novo Disparo" menu="DocuSign">
          <MPassos passos={PASSOS} atual={6} />
          <div className="grid gap-2 lg:grid-cols-2">
            <Alvo n={1}>
              <MCard titulo="Mensagem (WhatsApp)">
                <p className="rounded-[6px] border bg-card p-2 text-[10.5px]">
                  Olá, {"{{nome}}"}! O contrato da unidade {"{{unidade}}"} do {"{{empreendimento}}"}{" "}
                  está pronto para assinatura.
                </p>
                <p className="mt-1.5 rounded-[6px] bg-success-soft p-2 text-[10.5px]">
                  Prévia: Olá, João da Silva! O contrato da unidade 101 do Residencial Jardim das
                  Acácias está pronto para assinatura.
                </p>
              </MCard>
            </Alvo>
            <Alvo n={2}>
              <MCard titulo="Resumo">
                <MTabela
                  colunas={["Item", "Valor"]}
                  linhas={[
                    ["Destinatários", "2"],
                    ["Modelo", "Contrato de Compra e Venda"],
                    ["2º comprador", "Assina"],
                    ["Canais", "WhatsApp + E-mail"],
                  ]}
                />
              </MCard>
            </Alvo>
          </div>
          <div className="flex justify-end">
            <Alvo n={3}>
              <MBotao>Disparar agora</MBotao>
            </Alvo>
          </div>
        </MJanela>
      ),
    },
    {
      id: "acompanhar",
      titulo: "Acompanhar as assinaturas",
      onde: "DocuSign › Dashboard, Histórico e Relatórios",
      explicacao:
        "Depois do disparo, acompanhe a campanha: quem recebeu, quem assinou e quem ainda falta. Os relatórios podem ser exportados.",
      acoes: [
        "No Dashboard, veja os totais de enviados, assinados e pendentes.",
        "No Histórico, abra a campanha para ver cada destinatário.",
        "Em Relatórios, exporte o CSV (dado pessoal: guarde com acesso restrito).",
      ],
      tela: () => (
        <MJanela trilha="Início / DocuSign / Dashboard" titulo="Dashboard" menu="DocuSign">
          <Alvo n={1}>
            <div className="grid grid-cols-3 gap-1.5 text-[10.5px]">
              <div className="rounded-[8px] border bg-card p-2">
                <b className="block text-[16px]">48</b>Enviados
              </div>
              <div className="rounded-[8px] border bg-card p-2">
                <b className="block text-[16px] text-success">31</b>Assinados
              </div>
              <div className="rounded-[8px] border bg-card p-2">
                <b className="block text-[16px] text-warning">17</b>Aguardando
              </div>
            </div>
          </Alvo>
          <Alvo n={2}>
            <MTabela
              colunas={["Campanha", "Data", "Destinatários", "Assinados", "Status"]}
              linhas={[
                [
                  "Contratos Bloco A — Out/26",
                  "18/10/2026",
                  "48",
                  "31",
                  <MSelo tom="info">Em andamento</MSelo>,
                ],
                [
                  "Aditivos Torre Aurora",
                  "10/10/2026",
                  "22",
                  "22",
                  <MSelo tom="success">Concluída</MSelo>,
                ],
              ]}
            />
          </Alvo>
          <div className="flex justify-end">
            <Alvo n={3}>
              <MBotao tipo="contorno">⬇ Exportar CSV</MBotao>
            </Alvo>
          </div>
        </MJanela>
      ),
    },
  ],
};
