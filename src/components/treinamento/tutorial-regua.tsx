import { PreviaEmail, PreviaWhatsapp } from "@/components/regua/ui";
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

// Tutorial ilustrado — Disparo de boletos (Régua de Cobrança). Dados fictícios.

const PASSOS_LOTE = [
  "Origem",
  "Remessa e filtros",
  "Canais e templates",
  "Pré-visualização",
  "Confirmação",
];
const TRILHA = "Início / Disparo em Massa / Régua de Cobrança / Novo lote";

export const tutorialRegua: Tutorial = {
  slug: "tutorial-boleto",
  titulo: "Tutorial: disparo de boletos (Régua de Cobrança)",
  subtitulo:
    "Do Novo disparo ao acompanhamento: monte o lote, escolha canais e templates, confira as mensagens e acompanhe as entregas.",
  passos: [
    {
      id: "inicio",
      titulo: "Começar pelo Novo disparo",
      onde: "Página Inicial",
      explicacao:
        "Na Página Inicial, a faixa “Escolha o tipo de disparo” leva aos dois processos. Para cobrança, escolha Boleto.",
      acoes: [
        "Clique em “Novo disparo”.",
        "Na janela, escolha “Boleto”: abre o passo a passo do Novo lote da Régua de Cobrança.",
      ],
      dica: "Também dá para entrar pelo menu: Disparo em Massa › Régua de Cobrança › Novo lote.",
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
              <Alvo n={2}>
                <MOpcao
                  ativo
                  titulo="Boleto"
                  texto="Régua de Cobrança: a vencer ou em atraso, por WhatsApp e e-mail."
                />
              </Alvo>
              <MOpcao titulo="DocuSign" texto="Documentos para assinatura." />
            </div>
          </MCard>
        </MJanela>
      ),
    },
    {
      id: "origem",
      titulo: "Escolher a origem dos boletos",
      onde: "Régua de Cobrança › Novo lote › 1. Origem",
      explicacao:
        "Os boletos vêm do TOTVS RM (pela API cadastrada no Gateway) ou de uma planilha no modelo do sistema. As duas origens geram a mesma pré-visualização.",
      acoes: [
        "Escolha “TOTVS RM” para buscar direto do ERP…",
        "…ou “Planilha”: clique em “Baixar modelo”, preencha e envie o arquivo (.xlsx ou .csv, até 2.000 linhas).",
        "Clique em “Continuar”.",
      ],
      dica: "Na planilha, a coluna “registrado” (S/N) indica se o boleto está registrado no banco. Boleto não registrado fica fora do disparo.",
      tela: () => (
        <MJanela trilha={TRILHA} titulo="Novo lote" menu="Régua de Cobrança">
          <MPassos passos={PASSOS_LOTE} atual={1} />
          <MCard titulo="De onde vêm os boletos?">
            <div className="grid grid-cols-2 gap-2">
              <Alvo n={1}>
                <MOpcao
                  ativo
                  titulo="TOTVS RM"
                  texto="API.FIN.BOLETOS_EM_ATRASO cadastrada no Gateway."
                />
              </Alvo>
              <Alvo n={2}>
                <MOpcao
                  titulo="Planilha (.xlsx ou .csv)"
                  texto="⬇ Baixar modelo · até 2.000 linhas"
                />
              </Alvo>
            </div>
          </MCard>
          <div className="flex justify-end">
            <Alvo n={3}>
              <MBotao>Continuar →</MBotao>
            </Alvo>
          </div>
        </MJanela>
      ),
    },
    {
      id: "remessa",
      titulo: "Dar título à remessa e escolher a faixa",
      onde: "Régua de Cobrança › Novo lote › 2. Remessa e filtros",
      explicacao:
        "O título identifica a remessa em Lotes, no Painel, no relatório e na Auditoria. Depois, escolha o tipo de régua e a faixa de atraso: uma pronta ou personalizada.",
      acoes: [
        "Confira o título sugerido (ex.: “Atraso 60 dias · Vista Mar · Out/2026”) e ajuste se quiser.",
        "Em “Tipo de régua”, escolha “A vencer” (período de vencimento) ou “Em atraso”.",
        "Escolha a faixa: 30, 60, 90, acima de 90 dias, ou “Personalizada” (de X a Y dias).",
        "Marque os empreendimentos (nenhum marcado = todos).",
      ],
      tela: () => (
        <MJanela trilha={TRILHA} titulo="Novo lote" menu="Régua de Cobrança">
          <MPassos passos={PASSOS_LOTE} atual={2} />
          <Alvo n={1}>
            <MCard titulo="Identificação da remessa">
              <MCampo
                rotulo="Título da remessa *"
                valor="Atraso 60 dias · Residencial Vista Mar · Out/2026"
              />
            </MCard>
          </Alvo>
          <MCard titulo="Filtros">
            <div className="flex flex-col gap-2.5">
              <Alvo n={2} className="self-start">
                <span className="inline-flex overflow-hidden rounded-[7px] border border-border-strong text-[11px] font-semibold">
                  <span className="px-2.5 py-1 text-muted-foreground">A vencer</span>
                  <span className="bg-foreground px-2.5 py-1 text-white">Em atraso</span>
                </span>
              </Alvo>
              <Alvo n={3}>
                <div className="grid grid-cols-5 gap-1.5">
                  <MOpcao titulo="30 dias" texto="1 a 30" />
                  <MOpcao ativo titulo="60 dias" texto="31 a 60" />
                  <MOpcao titulo="90 dias" texto="61 a 90" />
                  <MOpcao titulo="Acima de 90" texto="91+" />
                  <MOpcao titulo="Personalizada" texto="você escolhe" />
                </div>
              </Alvo>
              <Alvo n={4}>
                <div className="flex flex-wrap gap-1.5">
                  {["Residencial Vista Mar", "Parque das Águas", "Torre Aurora"].map((e, k) => (
                    <span
                      key={e}
                      className={
                        k === 0
                          ? "rounded-full bg-foreground px-2.5 py-0.5 text-[10.5px] font-semibold text-white"
                          : "rounded-full border px-2.5 py-0.5 text-[10.5px] font-semibold"
                      }
                    >
                      {e}
                    </span>
                  ))}
                </div>
              </Alvo>
            </div>
          </MCard>
        </MJanela>
      ),
    },
    {
      id: "campos",
      titulo: "Filtrar por campos do TOTVS (opcional)",
      onde: "Régua de Cobrança › Novo lote › 2. Remessa e filtros",
      explicacao:
        "Além da faixa, você pode montar filtros com as colunas que a API do TOTVS RM devolve (ou as colunas da planilha). Todos os filtros valem juntos.",
      acoes: [
        "Clique em “Carregar campos do TOTVS”: o sistema lista as colunas disponíveis com exemplos de valores.",
        "Monte a regra: campo + condição + valor (ex.: SITUACAO é igual a “Em aberto”).",
        "Use “Adicionar filtro” para combinar mais regras (ex.: VALOR é maior que 1.000).",
      ],
      dica: "Campos com dado pessoal (CPF, nome, telefone, e-mail) podem ser filtrados, mas não mostram exemplos.",
      tela: () => (
        <MJanela trilha={TRILHA} titulo="Novo lote" menu="Régua de Cobrança">
          <MCard>
            <div className="mb-2 flex items-center justify-between gap-2">
              <b className="text-[12.5px]">Filtros por campo (opcional)</b>
              <Alvo n={1}>
                <MBotao tipo="contorno">↻ Carregar campos do TOTVS</MBotao>
              </Alvo>
            </div>
            <div className="flex flex-col gap-1.5">
              <Alvo n={2}>
                <div className="flex flex-wrap items-center gap-1.5 rounded-[7px] border bg-secondary/50 p-1.5 text-[10.5px]">
                  <b className="w-5 text-center text-muted-foreground">SE</b>
                  <MSelo>SITUACAO</MSelo> é igual a <MSelo tom="info">Em aberto</MSelo>
                </div>
              </Alvo>
              <div className="flex flex-wrap items-center gap-1.5 rounded-[7px] border bg-secondary/50 p-1.5 text-[10.5px]">
                <b className="w-5 text-center text-muted-foreground">E</b>
                <MSelo>VALORORIGINAL</MSelo> é maior que <MSelo tom="info">1.000,00</MSelo>
              </div>
              <div className="flex items-center gap-2">
                <Alvo n={3}>
                  <MBotao tipo="contorno">+ Adicionar filtro</MBotao>
                </Alvo>
                <span className="text-[10.5px] text-muted-foreground">
                  14 campos · 312 linhas na origem
                </span>
              </div>
            </div>
          </MCard>
        </MJanela>
      ),
    },
    {
      id: "canais",
      titulo: "Escolher canais e templates",
      onde: "Régua de Cobrança › Novo lote › 3. Canais e templates",
      explicacao:
        "Marque por onde o boleto vai sair: WhatsApp, e-mail ou os dois. Para cada canal marcado, escolha o template da mensagem (só aparecem os prontos).",
      acoes: [
        "Marque WhatsApp, E-mail ou os dois no card “Canais”.",
        "Escolha o template de WhatsApp (aprovado na Zenvia, com o PDF no cabeçalho).",
        "Escolha o template de e-mail. O sistema sugere o template da faixa escolhida.",
        "Clique em “Montar pré-visualização”.",
      ],
      tela: () => (
        <MJanela trilha={TRILHA} titulo="Novo lote" menu="Régua de Cobrança">
          <MPassos passos={PASSOS_LOTE} atual={3} />
          <Alvo n={1}>
            <MCard titulo="Canais">
              <div className="grid grid-cols-2 gap-2">
                <MOpcao ativo titulo="✓ WhatsApp" texto="Template aprovado na Zenvia" />
                <MOpcao ativo titulo="✓ E-mail" texto="Provedor ativo (Resend)" />
              </div>
            </MCard>
          </Alvo>
          <div className="grid grid-cols-2 gap-2">
            <Alvo n={2}>
              <MCard titulo="Template de WhatsApp">
                <MCampo rotulo="Template *" valor="Cobrança 60 dias" />
              </MCard>
            </Alvo>
            <Alvo n={3}>
              <MCard titulo="Template de e-mail">
                <MCampo rotulo="Template *" valor="Cobrança 60 dias · formal" />
              </MCard>
            </Alvo>
          </div>
          <div className="flex justify-end">
            <Alvo n={4}>
              <MBotao>Montar pré-visualização →</MBotao>
            </Alvo>
          </div>
        </MJanela>
      ),
    },
    {
      id: "previa",
      titulo: "Conferir boletos e mensagens",
      onde: "Régua de Cobrança › Novo lote › 4. Pré-visualização",
      explicacao:
        "Os cards mostram quantos boletos vieram, quantos estão elegíveis e as exceções. Clique num cliente para ver exatamente o que ele vai receber em cada canal.",
      acoes: [
        "Confira os totais: encontrados, elegíveis, não registrados no banco e sem contato válido.",
        "Desmarque a linha de quem não deve entrar no lote.",
        "Clique num cliente: as prévias do WhatsApp e do e-mail aparecem lado a lado.",
      ],
      dica: "CPF/CNPJ aparece sempre mascarado. Quem tem só um contato válido recebe só por esse canal.",
      tela: () => (
        <MJanela trilha={TRILHA} titulo="Novo lote" menu="Régua de Cobrança">
          <Alvo n={1}>
            <div className="grid grid-cols-4 gap-1.5 text-[10.5px]">
              <div className="rounded-[8px] bg-secondary p-2">
                <b className="block text-[15px]">226</b>encontrados
              </div>
              <div className="rounded-[8px] bg-success-soft p-2">
                <b className="block text-[15px]">214</b>elegíveis
              </div>
              <div className="rounded-[8px] bg-primary-soft p-2">
                <b className="block text-[15px]">5</b>não registrados
              </div>
              <div className="rounded-[8px] bg-warning-soft p-2">
                <b className="block text-[15px]">7</b>sem contato
              </div>
            </div>
          </Alvo>
          <Alvo n={2}>
            <MTabela
              destaque={0}
              colunas={[
                "",
                "Cliente",
                "CPF/CNPJ",
                "Boleto",
                "Atraso",
                "Valor",
                "WhatsApp",
                "E-mail",
              ]}
              linhas={[
                [
                  <MCheck marcado />,
                  <b>Mariana Costa</b>,
                  "***.482.917-**",
                  "000184522",
                  "59 dias",
                  "R$ 2.847,30",
                  <MSelo tom="success">Válido</MSelo>,
                  <MSelo tom="success">Válido</MSelo>,
                ],
                [
                  <MCheck marcado />,
                  "João Pedro Alves",
                  "***.103.558-**",
                  "000184523",
                  "54 dias",
                  "R$ 3.112,00",
                  <MSelo tom="warning">Não localizado</MSelo>,
                  <MSelo tom="success">Válido</MSelo>,
                ],
                [
                  <MCheck />,
                  "Roberto Nunes",
                  "***.774.006-**",
                  "000184541",
                  "43 dias",
                  "R$ 1.980,40",
                  <MSelo tom="success">Válido</MSelo>,
                  <MSelo tom="success">Válido</MSelo>,
                ],
              ]}
            />
          </Alvo>
          <Alvo n={3}>
            <div className="grid gap-3 rounded-[10px] border bg-card p-2.5 lg:grid-cols-2">
              <div className="origin-top scale-[0.9]">
                <PreviaWhatsapp
                  documento="boleto-000184522.pdf"
                  texto="Olá, Mariana Costa. Não identificamos o pagamento do boleto da unidade Bl A 302 do Residencial Vista Mar, vencido em 20/08/2026 (59 dias), no valor de R$ 2.847,30. A senha do PDF são os 5 primeiros dígitos do seu CPF."
                />
              </div>
              <PreviaEmail
                de="Financeiro ImobSystems <cobranca@imobsystems.com.br>"
                para="m****@email.com"
                assunto="Boleto em atraso · Residencial Vista Mar Bl A 302"
                texto={
                  "Prezada Mariana Costa,\n\nAté hoje não identificamos o pagamento do boleto vencido em 20/08/2026, no valor de R$ 2.847,30.\n\nO PDF está protegido. A senha são os 5 primeiros dígitos do seu CPF."
                }
                anexo="boleto-000184522.pdf"
              />
            </div>
          </Alvo>
        </MJanela>
      ),
    },
    {
      id: "acionar",
      titulo: "Confirmar e acionar o lote",
      onde: "Régua de Cobrança › Novo lote › 5. Confirmação",
      explicacao:
        "O resumo mostra título, régua, filtros, canais e templates. Confira tudo antes de acionar: depois disso as mensagens saem de verdade.",
      acoes: [
        "Confira o resumo da remessa.",
        "Só se precisar: ligue “Disparo extraordinário” para ignorar a trava de 24 h (exige permissão e justificativa).",
        "Clique em “Acionar lote”.",
      ],
      dica: "Trava de 24 h: um boleto que já saiu por um canal nas últimas 24 h não sai de novo por ele.",
      tela: () => (
        <MJanela trilha={TRILHA} titulo="Novo lote" menu="Régua de Cobrança">
          <MPassos passos={PASSOS_LOTE} atual={5} />
          <div className="grid gap-2 lg:grid-cols-[1.4fr_1fr]">
            <Alvo n={1}>
              <MCard titulo="Resumo da remessa">
                <MTabela
                  colunas={["Item", "Valor"]}
                  linhas={[
                    ["Título", <b>Atraso 60 dias · Residencial Vista Mar · Out/2026</b>],
                    ["Régua", "Em atraso · 31 a 60 dias"],
                    ["Filtros por campo", "SITUACAO é igual a “Em aberto”"],
                    ["Boletos", "214 elegíveis · 12 exceções"],
                    ["WhatsApp / E-mail", "Cobrança 60 dias / Cobrança 60 dias · formal"],
                  ]}
                />
              </MCard>
            </Alvo>
            <MCard titulo="Acionar">
              <div className="flex flex-col gap-2">
                <Alvo n={2}>
                  <span className="flex items-center gap-2 text-[11px] font-semibold">
                    <span className="inline-block h-4 w-7 rounded-full bg-border-strong" /> Disparo
                    extraordinário
                  </span>
                </Alvo>
                <Alvo n={3}>
                  <MBotao className="w-full">Acionar lote (214 boletos)</MBotao>
                </Alvo>
              </div>
            </MCard>
          </div>
        </MJanela>
      ),
    },
    {
      id: "acompanhar",
      titulo: "Acompanhar o envio",
      onde: "Régua de Cobrança › Lotes › detalhe do lote",
      explicacao:
        "Ao acionar, abre a tela do lote e o envio começa. Ele respeita o intervalo entre mensagens de WhatsApp e mostra o andamento.",
      acoes: [
        "Acompanhe a barra: boletos processados e mensagens na fila.",
        "Mantenha a tela aberta durante o envio. Se precisar, use “Pausar envio” e depois “Continuar envio”.",
        "Veja os contadores: no lote, exceções, elegíveis, sucesso e falhas.",
      ],
      dica: "Se a tela for fechada, o lote fica “Em processamento” e continua de onde parou quando você abrir o lote de novo.",
      tela: () => (
        <MJanela
          trilha="Início / Régua de Cobrança / Lotes / #0143"
          titulo="Atraso 60 dias · Residencial Vista Mar · Out/2026"
          menu="Régua de Cobrança"
        >
          <Alvo n={1}>
            <div className="flex items-center gap-2 rounded-[9px] border bg-card p-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <i className="block h-full w-[62%] animate-pulse rounded-full bg-primary" />
              </div>
              <span className="text-[10.5px]">133 de 214 boletos · 81 mensagens na fila</span>
              <Alvo n={2}>
                <MBotao tipo="contorno">❚❚ Pausar envio</MBotao>
              </Alvo>
            </div>
          </Alvo>
          <Alvo n={3}>
            <div className="grid grid-cols-6 gap-1.5 text-[10px]">
              {[
                ["226", "No lote", ""],
                ["5", "Não registrados", "text-primary-dark"],
                ["7", "Sem contato", "text-warning"],
                ["214", "Elegíveis", ""],
                ["129", "Sucesso", "text-success"],
                ["4", "Falhas", "text-primary-dark"],
              ].map(([v, r, c]) => (
                <div key={r} className="rounded-[8px] border bg-card p-1.5">
                  <b className={`block text-[14px] ${c}`}>{v}</b>
                  {r}
                </div>
              ))}
            </div>
          </Alvo>
        </MJanela>
      ),
    },
    {
      id: "trilha",
      titulo: "Reenviar falhas e ver a trilha do boleto",
      onde: "Régua de Cobrança › Lotes › detalhe do lote",
      explicacao:
        "Cada boleto mostra o resultado por canal. Nas falhas há “Reenviar”, e a trilha mostra tudo o que aconteceu com o boleto, com o que foi enviado e a resposta do provedor.",
      acoes: [
        "Use o filtro “Falhas” para ver só o que deu errado.",
        "Clique em “Reenviar” no canal que falhou (ou em “Reenviar todas as falhas”).",
        "Clique em “Ver trilha” para abrir a linha do tempo do boleto.",
      ],
      tela: () => (
        <MJanela
          trilha="Início / Régua de Cobrança / Lotes / #0143"
          titulo="Boletos do lote"
          menu="Régua de Cobrança"
        >
          <Alvo n={1} className="self-start">
            <span className="inline-flex overflow-hidden rounded-[7px] border border-border-strong text-[10.5px] font-semibold">
              <span className="px-2 py-1 text-muted-foreground">Todos</span>
              <span className="px-2 py-1 text-muted-foreground">Sucesso</span>
              <span className="bg-foreground px-2 py-1 text-white">Falhas</span>
              <span className="px-2 py-1 text-muted-foreground">Exceções</span>
            </span>
          </Alvo>
          <MTabela
            colunas={["Cliente", "Boleto", "WhatsApp", "E-mail", "Resultado", ""]}
            linhas={[
              [
                "João Pedro Alves",
                "000184523",
                <span className="inline-flex items-center gap-1">
                  <MSelo tom="danger">Falha</MSelo>
                  <Alvo n={2}>
                    <b className="px-1 text-[10px] text-primary">Reenviar</b>
                  </Alvo>
                </span>,
                <MSelo tom="success">Entregue</MSelo>,
                <MSelo tom="warning">Parcial</MSelo>,
                <Alvo n={3}>
                  <b className="px-1 text-[10px] text-primary">Ver trilha</b>
                </Alvo>,
              ],
            ]}
          />
          <MCard titulo="Trilha do boleto 000184523">
            <ul className="flex flex-col gap-1 text-[10.5px]">
              <li>🟢 Consultado no TOTVS RM · 18/10 15:40</li>
              <li>🟢 PDF gerado com senha · link válido até 21/10</li>
              <li>🟢 E-mail enviado e entregue · Resend</li>
              <li>🔴 WhatsApp — falha · número sem WhatsApp</li>
            </ul>
          </MCard>
        </MJanela>
      ),
    },
    {
      id: "painel",
      titulo: "Ver os indicadores no Painel",
      onde: "Régua de Cobrança › Painel",
      explicacao:
        "O Painel resume a régua por período, empreendimento, canal, status, régua/faixa e lote. Os totais batem com o relatório exportado do lote.",
      acoes: [
        "Ajuste os filtros no topo (período, empreendimento, canal, régua/faixa…).",
        "Leia os indicadores: taxa de sucesso, WhatsApp e e-mails enviados/entregues, contatos inválidos e falhas.",
        "No detalhe de cada lote, exporte o relatório em Excel ou PDF.",
      ],
      tela: () => (
        <MJanela
          trilha="Início / Régua de Cobrança / Painel"
          titulo="Painel da Régua"
          menu="Régua de Cobrança"
        >
          <Alvo n={1}>
            <div className="grid grid-cols-4 gap-1.5">
              <MCampo rotulo="Período" valor="Últimos 30 dias" />
              <MCampo rotulo="Empreendimento" valor="Todos" />
              <MCampo rotulo="Canal" valor="WhatsApp + E-mail" />
              <MCampo rotulo="Régua / faixa" valor="Atraso 60 dias" />
            </div>
          </Alvo>
          <Alvo n={2}>
            <div className="grid grid-cols-3 gap-1.5 text-[10.5px]">
              <div className="rounded-[8px] border bg-card p-2">
                <b className="block text-[16px]">94,2%</b>Taxa de sucesso
              </div>
              <div className="rounded-[8px] border bg-card p-2">
                <b className="block text-[16px]">1.812 / 1.640</b>WhatsApp enviados / entregues
              </div>
              <div className="rounded-[8px] border bg-card p-2">
                <b className="block text-[16px]">87</b>Contatos inválidos
              </div>
            </div>
          </Alvo>
          <div className="flex justify-end gap-1.5">
            <Alvo n={3}>
              <span className="flex gap-1.5">
                <MBotao tipo="contorno">⬇ Excel</MBotao>
                <MBotao tipo="contorno">⬇ PDF</MBotao>
              </span>
            </Alvo>
          </div>
        </MJanela>
      ),
    },
  ],
};
