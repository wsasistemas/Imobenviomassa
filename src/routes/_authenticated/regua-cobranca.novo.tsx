import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Download,
  FileSpreadsheet,
  Loader2,
  Mail,
  MessageCircle,
  PlugZap,
  Receipt,
  Search,
  Send,
  Upload,
} from "lucide-react";
import { z } from "zod";
import { PageHead, SemAcesso } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { IconeIlustrativo } from "@/components/icones/icone-colorido";
import {
  Aviso,
  PreviaEmail,
  PreviaWhatsapp,
  SeloBoleto,
  SeloContato,
  SeloRegistro,
} from "@/components/regua/ui";
import { useCurrentUser } from "@/hooks/use-current-user";
import { listarEmpreendimentosTotvs } from "@/lib/integracoes/totvs.functions";
import { bibliotecaTemplates } from "@/lib/regua/regua.functions";
import {
  acionarLote,
  alternarInclusao,
  listarPrevia,
  prepararLote,
  previaMensagem,
  type Contadores,
  type LinhaPrevia,
} from "@/lib/regua/lote.functions";
import {
  FAIXAS,
  ROTULO_REGUA,
  dataBr,
  moeda,
  sugerirTitulo,
  descreverFiltro,
  type FiltroCampo,
  type Canal,
  type FaixaAtraso,
  type TipoRegua,
} from "@/lib/regua/comum";
import { cn } from "@/lib/utils";
import { FiltrosPorCampo } from "@/components/regua/filtros-por-campo";

export const Route = createFileRoute("/_authenticated/regua-cobranca/novo")({
  validateSearch: z.object({ lote: z.string().uuid().optional() }),
  component: NovoLotePage,
});

const PASSOS = [
  { n: 1, titulo: "Origem", sub: "TOTVS RM ou planilha" },
  { n: 2, titulo: "Remessa e filtros", sub: "Título, faixa e campos" },
  { n: 3, titulo: "Canais e templates", sub: "WhatsApp, e-mail ou os dois" },
  { n: 4, titulo: "Pré-visualização", sub: "Boletos e mensagens" },
  { n: 5, titulo: "Confirmação", sub: "Acionar lote" },
] as const;

const COLUNAS_MODELO = [
  "codigo_cliente",
  "nome",
  "cpf_cnpj",
  "empreendimento",
  "unidade",
  "numero_boleto",
  "vencimento",
  "dias_atraso",
  "valor",
  "linha_digitavel",
  "whatsapp",
  "email",
  "registrado",
];

type Linha = Record<string, string | number | boolean | null>;

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <section
      className={cn(
        "flex flex-col gap-3.5 rounded-xl border bg-card px-5 py-4 shadow-card",
        className,
      )}
    >
      {children}
    </section>
  );
}

function Opcao({
  ativo,
  onClick,
  children,
  className,
}: {
  ativo: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex gap-3.5 rounded-[13px] border-[1.5px] bg-card p-4 text-left",
        ativo ? "border-primary bg-primary-soft" : "border-border hover:border-border-strong",
        className,
      )}
    >
      {children}
    </button>
  );
}

function Chip({
  ativo,
  onClick,
  children,
}: {
  ativo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-[12.5px] font-semibold",
        ativo
          ? "border-foreground bg-foreground text-white"
          : "border-border-strong bg-card text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function NovoLotePage() {
  const { podeAcessar, loading } = useCurrentUser();
  const { lote: loteRascunho } = Route.useSearch();
  const navigate = useNavigate();
  const carregarBiblioteca = useServerFn(bibliotecaTemplates);
  const carregarEmps = useServerFn(listarEmpreendimentosTotvs);
  const preparar = useServerFn(prepararLote);
  const acionar = useServerFn(acionarLote);

  const [passo, setPasso] = useState(loteRascunho ? 4 : 1);
  const [origem, setOrigem] = useState<"rm" | "planilha">("rm");
  const [linhas, setLinhas] = useState<Linha[] | null>(null);
  const [arquivo, setArquivo] = useState<string | null>(null);
  const [titulo, setTitulo] = useState("");
  const [tituloEditado, setTituloEditado] = useState(false);
  const [observacao, setObservacao] = useState("");
  const [tipo, setTipo] = useState<TipoRegua>("atraso");
  const [faixa, setFaixa] = useState<FaixaAtraso | null>("30");
  const [diasMin, setDiasMin] = useState("120");
  const [diasMax, setDiasMax] = useState("");
  const [filtrosCampos, setFiltrosCampos] = useState<FiltroCampo[]>([]);
  const [vencDe, setVencDe] = useState(new Date().toISOString().slice(0, 10));
  const [vencAte, setVencAte] = useState(
    new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10),
  );
  const [emps, setEmps] = useState<string[]>([]);
  const [unidades, setUnidades] = useState("");
  const [canais, setCanais] = useState<Canal[]>(["whatsapp", "email"]);
  const [tplWhats, setTplWhats] = useState<string>("");
  const [tplEmail, setTplEmail] = useState<string>("");
  const [loteId, setLoteId] = useState<string | null>(loteRascunho ?? null);
  const [preparo, setPreparo] = useState<{
    contadores: Contadores;
    ignoradas: { linha: number; motivo: string }[];
    limiteAtingido: boolean;
  } | null>(null);
  const [preparando, setPreparando] = useState(false);
  const [extra, setExtra] = useState(false);
  const [justificativa, setJustificativa] = useState("");
  const [acionando, setAcionando] = useState(false);

  const biblioteca = useQuery({
    queryKey: ["regua-biblioteca"],
    queryFn: () => carregarBiblioteca(),
    enabled: !loading && podeAcessar("regua_lote_criar"),
  });
  const empsRm = useQuery({
    queryKey: ["regua-emps-rm"],
    queryFn: () => carregarEmps({ data: {} }),
    enabled: !loading && origem === "rm" && podeAcessar("regua_lote_criar"),
    staleTime: 5 * 60_000,
  });

  const opcoesEmps = useMemo(() => {
    if (origem === "planilha") {
      const s = new Set<string>();
      for (const l of linhas ?? []) {
        const v = Object.entries(l).find(([k]) => /^empreend|^obra/i.test(k))?.[1];
        if (v) s.add(String(v).trim());
      }
      return [...s].sort();
    }
    return (empsRm.data?.empreendimentos ?? []).map((e) => e.nome).filter(Boolean);
  }, [origem, linhas, empsRm.data]);

  // Título sugerido (D6) enquanto o usuário não editar.
  useEffect(() => {
    if (!tituloEditado)
      setTitulo(
        sugerirTitulo(tipo, faixa, emps, new Date(), {
          min: diasMin ? Number(diasMin) : null,
          max: diasMax ? Number(diasMax) : null,
        }),
      );
  }, [tipo, faixa, emps, tituloEditado, diasMin, diasMax]);

  const prontos = useMemo(() => {
    const t = biblioteca.data?.templates ?? [];
    return {
      whatsapp: t.filter((x) => x.canal === "whatsapp" && x.prontidao.pronto),
      email: t.filter((x) => x.canal === "email" && x.prontidao.pronto),
    };
  }, [biblioteca.data]);

  // Sugere o template pela faixa (régua sugerida), sem passar por cima da escolha do usuário.
  const reguaAtual = tipo === "a_vencer" ? "a_vencer" : faixa;
  useEffect(() => {
    const sugerido = (c: Canal) =>
      (prontos[c].find((x) => x.reguaSugerida === reguaAtual) ?? prontos[c][0])?.id ?? "";
    if (!prontos.whatsapp.some((x) => x.id === tplWhats)) setTplWhats(sugerido("whatsapp"));
    if (!prontos.email.some((x) => x.id === tplEmail)) setTplEmail(sugerido("email"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prontos, reguaAtual]);

  if (loading) return null;
  if (!podeAcessar("regua_lote_criar"))
    return <SemAcesso texto="Seu perfil não monta lotes da Régua de Cobrança." />;

  const podeAcionar = podeAcessar("regua_lote_acionar");
  const podeExtra = podeAcessar("regua_disparo_extraordinario");

  async function lerPlanilha(f: File) {
    if (f.size > 5 * 1024 * 1024) return toast.error("Arquivo maior que 5 MB.");
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await f.arrayBuffer(), {
        type: "array",
        cellDates: true,
        sheetRows: 2002,
      });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
      if (json.length > 2000)
        return toast.error("A planilha passa de 2.000 linhas. Divida em mais de um lote.");
      const limpas: Linha[] = json.map((r) => {
        const o: Linha = {};
        for (const [k, v] of Object.entries(r)) {
          if (v instanceof Date) o[k] = v.toISOString().slice(0, 10);
          else if (typeof v === "number" || typeof v === "boolean") o[k] = v;
          else o[k] = v == null ? null : String(v).slice(0, 500);
        }
        return o;
      });
      setLinhas(limpas);
      setArquivo(f.name);
      setEmps([]);
      toast.success(`${limpas.length} linhas lidas de ${f.name}.`);
    } catch {
      toast.error("Não foi possível ler a planilha. Use .xlsx ou .csv no modelo.");
    }
  }

  async function baixarModelo() {
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.json_to_sheet(
      [
        {
          codigo_cliente: "C001",
          nome: "Mariana Costa",
          cpf_cnpj: "123.482.917-00",
          empreendimento: "Residencial Vista Mar",
          unidade: "Bl A 302",
          numero_boleto: "000184522",
          vencimento: "2026-08-20",
          dias_atraso: 59,
          valor: "2.847,30",
          linha_digitavel: "34191.09008 01845.221092 00000.000000 1 00000000284730",
          whatsapp: "(21) 98877-6655",
          email: "mariana@email.com",
          registrado: "S",
        },
      ],
      { header: COLUNAS_MODELO },
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Boletos");
    XLSX.writeFile(wb, "modelo-regua-cobranca.xlsx");
  }

  function validarPasso(n: number): string | null {
    if (n >= 1 && origem === "planilha" && !linhas?.length)
      return "Envie a planilha com os boletos.";
    if (n >= 2) {
      if (titulo.trim().length < 3) return "Informe o título da remessa.";
      if (tipo === "atraso" && !faixa) return "Escolha a faixa de atraso.";
      if (tipo === "atraso" && faixa === "personalizada") {
        if (!diasMin) return "Informe a partir de quantos dias de atraso.";
        if (diasMax && Number(diasMax) < Number(diasMin))
          return "Na faixa personalizada, o máximo de dias precisa ser maior que o mínimo.";
      }
      const incompleto = filtrosCampos.find(
        (f) =>
          !f.campo ||
          (!["vazio", "preenchido"].includes(f.op) && !(f.valor ?? "").trim()) ||
          (f.op === "entre" && !(f.valor2 ?? "").trim()),
      );
      if (incompleto) return "Complete ou remova o filtro por campo que está pela metade.";
      if (tipo === "a_vencer" && (!vencDe || !vencAte || vencDe > vencAte))
        return "Informe um período de vencimento válido.";
    }
    if (n >= 3) {
      if (!canais.length) return "Escolha ao menos um canal.";
      if (canais.includes("whatsapp") && !tplWhats) return "Escolha o template de WhatsApp.";
      if (canais.includes("email") && !tplEmail) return "Escolha o template de e-mail.";
    }
    return null;
  }

  async function carregarPrevia() {
    const erro = validarPasso(3);
    if (erro) return toast.error(erro);
    setPreparando(true);
    try {
      const r = await preparar({
        data: {
          loteId: loteId ?? undefined,
          titulo: titulo.trim(),
          observacao: observacao.trim() || null,
          origem,
          tipoRegua: tipo,
          faixa: tipo === "atraso" ? faixa : null,
          diasMin: tipo === "atraso" && faixa === "personalizada" ? Number(diasMin) : null,
          diasMax:
            tipo === "atraso" && faixa === "personalizada" && diasMax ? Number(diasMax) : null,
          filtrosCampos,
          vencimentoDe: tipo === "a_vencer" ? vencDe : null,
          vencimentoAte: tipo === "a_vencer" ? vencAte : null,
          empreendimentos: emps,
          unidades: unidades
            .split(",")
            .map((u) => u.trim())
            .filter(Boolean),
          canais,
          templateWhatsappId: canais.includes("whatsapp") ? tplWhats : null,
          templateEmailId: canais.includes("email") ? tplEmail : null,
          linhas: origem === "planilha" ? (linhas ?? []) : undefined,
        },
      });
      setLoteId(r.loteId);
      setPreparo(r);
      setPasso(4);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível montar a pré-visualização.");
    } finally {
      setPreparando(false);
    }
  }

  async function avancar() {
    if (passo === 3) return carregarPrevia();
    const erro = validarPasso(passo);
    if (erro) return toast.error(erro);
    setPasso(Math.min(5, passo + 1));
  }

  async function acionarAgora() {
    if (!loteId) return;
    if (extra && justificativa.trim().length < 10)
      return toast.error("Escreva a justificativa do disparo extraordinário (mín. 10 caracteres).");
    setAcionando(true);
    try {
      const r = await acionar({
        data: { loteId, extraordinario: extra, justificativa: extra ? justificativa.trim() : null },
      });
      toast.success(`Lote acionado: ${r.whatsapp} WhatsApp e ${r.email} e-mails na fila.`);
      navigate({
        to: "/regua-cobranca/lotes/$loteId",
        params: { loteId },
        search: { processar: true },
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível acionar o lote.");
    } finally {
      setAcionando(false);
    }
  }

  const tplWhatsSel = prontos.whatsapp.find((x) => x.id === tplWhats);
  const tplEmailSel = prontos.email.find((x) => x.id === tplEmail);
  const waDoTemplate = biblioteca.data?.whatsapp.find(
    (w) => w.id === tplWhatsSel?.whatsappTemplateId,
  );
  const remDoTemplate = biblioteca.data?.remetentes.find((r) => r.id === tplWhatsSel?.remetenteId);
  const rascunhoExterno = !!loteRascunho && !preparo;

  return (
    <div className="flex flex-col gap-5">
      <PageHead title="Novo lote">
        Monte a remessa, escolha os templates, revise a mensagem de cada cliente e acione o envio.
      </PageHead>

      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-5">
        {PASSOS.map((p) => (
          <button
            key={p.n}
            type="button"
            disabled={rascunhoExterno ? p.n < 4 : p.n > passo && !(p.n === 5 && passo === 4)}
            onClick={() => (p.n === 4 && passo < 4 ? carregarPrevia() : setPasso(p.n))}
            className={cn(
              "flex items-center gap-2.5 rounded-xl border bg-card px-3.5 py-3 text-left disabled:cursor-not-allowed disabled:opacity-60",
              p.n === passo && "border-primary bg-primary-soft",
            )}
          >
            <span
              className={cn(
                "grid h-7 w-7 shrink-0 place-items-center rounded-full text-[12.5px] font-extrabold",
                p.n === passo
                  ? "bg-primary text-white"
                  : p.n < passo
                    ? "bg-success text-white"
                    : "bg-muted text-muted-foreground",
              )}
            >
              {p.n}
            </span>
            <span className="min-w-0">
              <b className="block text-[13px]">{p.titulo}</b>
              <small className="text-[11.5px] text-muted-foreground">{p.sub}</small>
            </span>
          </button>
        ))}
      </div>

      {rascunhoExterno && passo < 4 && (
        <Aviso>
          Este rascunho já foi montado. Para mudar origem ou filtros, comece um novo lote.
        </Aviso>
      )}

      {passo === 1 && (
        <Card>
          <div>
            <h2 className="text-[16px] font-bold">De onde vêm os boletos?</h2>
            <p className="text-[12.5px] text-muted-foreground">
              As duas origens geram a mesma pré-visualização para os mesmos boletos.
            </p>
          </div>
          <div className="grid gap-3.5 md:grid-cols-2">
            <Opcao ativo={origem === "rm"} onClick={() => setOrigem("rm")}>
              <IconeIlustrativo icon={PlugZap} size={32} />
              <div>
                <b className="mb-0.5 block text-[14.5px]">TOTVS RM</b>
                <p className="text-[12.5px] text-muted-foreground">
                  Consulta as APIs{" "}
                  <span className="font-mono text-[11.5px]">API.FIN.BOLETOS_A_VENCER</span> ou{" "}
                  <span className="font-mono text-[11.5px]">API.FIN.BOLETOS_EM_ATRASO</span>{" "}
                  cadastradas no Gateway de APIs, com as credenciais de Integrações › TOTVS RM.
                </p>
              </div>
            </Opcao>
            <Opcao ativo={origem === "planilha"} onClick={() => setOrigem("planilha")}>
              <IconeIlustrativo icon={FileSpreadsheet} size={32} />
              <div>
                <b className="mb-0.5 block text-[14.5px]">Planilha (.xlsx ou .csv)</b>
                <p className="text-[12.5px] text-muted-foreground">
                  Envie o arquivo no modelo. As colunas são conferidas antes de seguir.
                </p>
                <button
                  type="button"
                  onClick={(e) => (e.stopPropagation(), void baixarModelo())}
                  className="mt-2 inline-flex items-center gap-1 text-[12px] font-bold text-primary"
                >
                  <Download className="h-3.5 w-3.5" /> Baixar modelo
                </button>
              </div>
            </Opcao>
          </div>
          {origem === "planilha" && (
            <label className="flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border-[1.5px] border-dashed border-border-strong p-6 text-center text-[13px] text-muted-foreground hover:bg-secondary">
              <Upload className="h-7 w-7" />
              <b className="text-foreground">
                {arquivo
                  ? `${arquivo} · ${linhas?.length ?? 0} linhas`
                  : "Clique para escolher a planilha"}
              </b>
              <span className="text-[11.5px]">
                Colunas: {COLUNAS_MODELO.join(", ")} · até 2.000 linhas e 5 MB
              </span>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && void lerPlanilha(e.target.files[0])}
              />
            </label>
          )}
        </Card>
      )}

      {passo === 2 && (
        <>
          <Card>
            <div className="flex items-center gap-3.5">
              <div className="grid h-[46px] w-[46px] place-items-center rounded-xl bg-secondary">
                <IconeIlustrativo icon={Receipt} size={28} />
              </div>
              <div>
                <h2 className="text-[16px] font-bold">Identificação da remessa</h2>
                <p className="text-[12.5px] text-muted-foreground">
                  O título aparece em Lotes, no Painel, no relatório exportado e na Auditoria.
                </p>
              </div>
            </div>
            <div className="grid gap-3.5 md:grid-cols-2">
              <label className="flex flex-col gap-1.5">
                <span className="text-[12.5px] font-semibold">Título da remessa *</span>
                <Input
                  value={titulo}
                  maxLength={140}
                  onChange={(e) => {
                    setTitulo(e.target.value);
                    setTituloEditado(true);
                  }}
                />
                <small className="text-[11.5px] text-muted-foreground">
                  Sugerido pelo tipo, pela faixa, pelos empreendimentos e pelo mês.{" "}
                  {tituloEditado && (
                    <button
                      type="button"
                      className="font-bold text-primary"
                      onClick={() => setTituloEditado(false)}
                    >
                      Voltar à sugestão
                    </button>
                  )}
                </small>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12.5px] font-semibold">Observação (opcional)</span>
                <Input
                  value={observacao}
                  maxLength={300}
                  onChange={(e) => setObservacao(e.target.value)}
                  placeholder="Ex.: 2ª tentativa depois da renegociação de setembro"
                />
              </label>
            </div>
          </Card>
          <Card>
            <h2 className="text-[16px] font-bold">Filtros</h2>
            <div className="flex flex-col gap-1.5">
              <span className="text-[12.5px] font-semibold">Tipo de régua</span>
              <div className="inline-flex self-start overflow-hidden rounded-[9px] border border-border-strong">
                {(["a_vencer", "atraso"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTipo(t)}
                    className={cn(
                      "px-3.5 py-1.5 text-[12.5px] font-semibold",
                      tipo === t ? "bg-foreground text-white" : "text-muted-foreground",
                    )}
                  >
                    {t === "a_vencer" ? "A vencer" : "Em atraso"}
                  </button>
                ))}
              </div>
              <small className="text-[11.5px] text-muted-foreground">
                A vencer usa o período de vencimento. Em atraso usa a faixa de dias de atraso.
              </small>
            </div>
            {tipo === "atraso" ? (
              <div className="flex flex-col gap-1.5">
                <span className="text-[12.5px] font-semibold">Faixa de atraso *</span>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                  {FAIXAS.map((f) => (
                    <Opcao key={f.id} ativo={faixa === f.id} onClick={() => setFaixa(f.id)}>
                      <div>
                        <b className="block text-[14px]">{f.rotulo}</b>
                        <p className="text-[12px] text-muted-foreground">{f.descricao}</p>
                      </div>
                    </Opcao>
                  ))}
                  <Opcao
                    ativo={faixa === "personalizada"}
                    onClick={() => setFaixa("personalizada")}
                  >
                    <div>
                      <b className="block text-[14px]">Personalizada</b>
                      <p className="text-[12px] text-muted-foreground">Você escolhe os dias</p>
                    </div>
                  </Opcao>
                </div>
                {faixa === "personalizada" && (
                  <div className="flex flex-wrap items-end gap-2.5 rounded-lg bg-secondary px-3 py-2.5">
                    <label className="flex flex-col gap-1">
                      <span className="text-[12px] font-semibold">De (dias de atraso) *</span>
                      <Input
                        value={diasMin}
                        onChange={(e) => setDiasMin(e.target.value.replace(/\D/g, "").slice(0, 5))}
                        className="h-8 w-[120px] bg-card"
                        inputMode="numeric"
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-[12px] font-semibold">Até (dias)</span>
                      <Input
                        value={diasMax}
                        onChange={(e) => setDiasMax(e.target.value.replace(/\D/g, "").slice(0, 5))}
                        placeholder="sem limite"
                        className="h-8 w-[120px] bg-card"
                        inputMode="numeric"
                      />
                    </label>
                    <span className="pb-1.5 text-[12px] text-muted-foreground">
                      Ex.: de 120 até 180 dias. Deixe “Até” vazio para “ou mais”.
                    </span>
                  </div>
                )}
                {origem === "rm" && (
                  <small className="text-[11.5px] text-muted-foreground">
                    A faixa vai para a API do TOTVS como <span className="font-mono">DIAS_MIN</span>{" "}
                    e <span className="font-mono">DIAS_MAX</span>.
                  </small>
                )}
              </div>
            ) : (
              <div className="grid gap-3.5 md:grid-cols-2">
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12.5px] font-semibold">Vencimento de *</span>
                  <Input type="date" value={vencDe} onChange={(e) => setVencDe(e.target.value)} />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12.5px] font-semibold">Vencimento até *</span>
                  <Input type="date" value={vencAte} onChange={(e) => setVencAte(e.target.value)} />
                </label>
              </div>
            )}
            <div className="grid gap-3.5 md:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <span className="text-[12.5px] font-semibold">Empreendimentos</span>
                {origem === "rm" && empsRm.isLoading ? (
                  <span className="text-[12px] text-muted-foreground">Carregando do TOTVS RM…</span>
                ) : opcoesEmps.length === 0 ? (
                  <span className="text-[12px] text-muted-foreground">
                    {origem === "rm"
                      ? (empsRm.data?.error ??
                        "Nenhum empreendimento encontrado; o lote considera todos.")
                      : "Nenhum empreendimento na planilha; o lote considera todos."}
                  </span>
                ) : (
                  <div className="flex max-h-[150px] flex-wrap gap-1.5 overflow-y-auto">
                    {opcoesEmps.map((e) => (
                      <Chip
                        key={e}
                        ativo={emps.includes(e)}
                        onClick={() =>
                          setEmps(emps.includes(e) ? emps.filter((x) => x !== e) : [...emps, e])
                        }
                      >
                        {e}
                      </Chip>
                    ))}
                  </div>
                )}
                <small className="text-[11.5px] text-muted-foreground">
                  Nenhum marcado = todos.
                </small>
              </div>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12.5px] font-semibold">Unidades</span>
                <Input
                  value={unidades}
                  onChange={(e) => setUnidades(e.target.value)}
                  placeholder="Todas as unidades dos empreendimentos marcados"
                />
                <small className="text-[11.5px] text-muted-foreground">
                  Opcional: unidades separadas por vírgula, como aparecem na origem.
                </small>
              </label>
            </div>
          </Card>
          <FiltrosPorCampo
            origem={origem}
            linhasPlanilha={linhas}
            consulta={{
              tipoRegua: tipo,
              faixa: tipo === "atraso" ? faixa : null,
              diasMin:
                tipo === "atraso" && faixa === "personalizada" && diasMin ? Number(diasMin) : null,
              diasMax:
                tipo === "atraso" && faixa === "personalizada" && diasMax ? Number(diasMax) : null,
              vencimentoDe: tipo === "a_vencer" ? vencDe : null,
              vencimentoAte: tipo === "a_vencer" ? vencAte : null,
            }}
            filtros={filtrosCampos}
            onChange={setFiltrosCampos}
          />
        </>
      )}

      {passo === 3 && (
        <>
          <Card>
            <div>
              <h2 className="text-[16px] font-bold">Canais</h2>
              <p className="text-[12.5px] text-muted-foreground">
                Escolha por onde o boleto vai sair: um canal ou os dois. Para cada canal marcado,
                escolha abaixo o template da mensagem.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {(
                [
                  [
                    "whatsapp",
                    "WhatsApp",
                    MessageCircle,
                    "Template aprovado na Zenvia, com o PDF do boleto no cabeçalho.",
                  ],
                  [
                    "email",
                    "E-mail",
                    Mail,
                    "Pelo provedor ativo em Integrações › E-mail, com o PDF anexo ou só o link.",
                  ],
                ] as const
              ).map(([c, rotulo, Icone, texto]) => {
                const ativo = canais.includes(c);
                return (
                  <Opcao
                    key={c}
                    ativo={ativo}
                    onClick={() =>
                      setCanais(ativo ? canais.filter((x) => x !== c) : [...canais, c])
                    }
                  >
                    <IconeIlustrativo icon={Icone} size={30} />
                    <div className="min-w-0 flex-1">
                      <b className="block text-[14.5px]">{rotulo}</b>
                      <p className="text-[12.5px] text-muted-foreground">{texto}</p>
                    </div>
                    <span
                      className={cn(
                        "grid h-5 w-5 shrink-0 place-items-center rounded-[5px] border-[1.5px] text-[12px] font-bold text-white",
                        ativo ? "border-primary bg-primary" : "border-border-strong bg-card",
                      )}
                    >
                      {ativo ? "✓" : ""}
                    </span>
                  </Opcao>
                );
              })}
            </div>
            {canais.length === 0 && (
              <Aviso tom="warning">Marque ao menos um canal para continuar.</Aviso>
            )}
          </Card>
          {canais.length > 0 && (
            <Aviso>
              O sistema monta a mensagem de cada cliente com os templates escolhidos e mostra o
              resultado na pré-visualização. Só aparecem templates prontos: WhatsApp <b>Aprovado</b>{" "}
              na Zenvia e e-mail com todas as variáveis válidas.
            </Aviso>
          )}
          {biblioteca.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando templates…
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {canais.includes("whatsapp") && (
                <Card>
                  <div className="flex items-center gap-3.5">
                    <div className="grid h-[46px] w-[46px] place-items-center rounded-xl bg-secondary">
                      <IconeIlustrativo icon={MessageCircle} size={28} />
                    </div>
                    <div>
                      <h2 className="text-[16px] font-bold">Template de WhatsApp</h2>
                      <p className="text-[12.5px] text-muted-foreground">
                        Da biblioteca de Templates, ligado a um template Zenvia.
                      </p>
                    </div>
                  </div>
                  {prontos.whatsapp.length === 0 ? (
                    <Aviso tom="warning">
                      Nenhum template de WhatsApp pronto. Cadastre em{" "}
                      <Link to="/regua-cobranca/templates" className="font-bold underline">
                        Templates
                      </Link>{" "}
                      (precisa de template Aprovado na Zenvia).
                    </Aviso>
                  ) : (
                    <>
                      <label className="flex flex-col gap-1.5">
                        <span className="text-[12.5px] font-semibold">Template *</span>
                        <select
                          className="h-9 rounded-[7px] border border-border-strong bg-card px-2.5 text-[13px]"
                          value={tplWhats}
                          onChange={(e) => setTplWhats(e.target.value)}
                        >
                          {prontos.whatsapp.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.nome}
                              {t.reguaSugerida ? ` · ${ROTULO_REGUA[t.reguaSugerida]}` : ""}
                            </option>
                          ))}
                        </select>
                        {reguaAtual && (
                          <small className="text-[11.5px] text-muted-foreground">
                            Sugerido pela régua escolhida: <b>{ROTULO_REGUA[reguaAtual]}</b>.
                          </small>
                        )}
                      </label>
                      <Table>
                        <TableBody>
                          <TableRow>
                            <TableCell className="text-muted-foreground">Remetente</TableCell>
                            <TableCell className="font-mono text-[12px]">
                              {remDoTemplate
                                ? `${remDoTemplate.numero}${remDoTemplate.setor ? ` · ${remDoTemplate.setor}` : ""}`
                                : "—"}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="text-muted-foreground">Template Zenvia</TableCell>
                            <TableCell className="font-mono text-[12px]">
                              {waDoTemplate?.nome ?? "—"}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="text-muted-foreground">Cabeçalho</TableCell>
                            <TableCell>
                              {waDoTemplate?.headerTipo === "MEDIA_DOCUMENT"
                                ? "Documento · PDF protegido do boleto"
                                : "Sem documento"}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="text-muted-foreground">Variáveis</TableCell>
                            <TableCell>{waDoTemplate?.variaveis.length ?? 0} mapeadas</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </>
                  )}
                </Card>
              )}
              {canais.includes("email") && (
                <Card>
                  <div className="flex items-center gap-3.5">
                    <div className="grid h-[46px] w-[46px] place-items-center rounded-xl bg-secondary">
                      <IconeIlustrativo icon={Mail} size={28} />
                    </div>
                    <div>
                      <h2 className="text-[16px] font-bold">Template de e-mail</h2>
                      <p className="text-[12.5px] text-muted-foreground">
                        Enviado pelo provedor ativo em Integrações › E-mail.
                      </p>
                    </div>
                  </div>
                  {!biblioteca.data?.emailPronto.ok && (
                    <Aviso tom="warning">
                      {biblioteca.data?.emailPronto.motivo} O lote não poderá ser acionado assim.
                    </Aviso>
                  )}
                  {prontos.email.length === 0 ? (
                    <Aviso tom="warning">
                      Nenhum template de e-mail pronto. Cadastre em{" "}
                      <Link to="/regua-cobranca/templates" className="font-bold underline">
                        Templates
                      </Link>
                      .
                    </Aviso>
                  ) : (
                    <>
                      <label className="flex flex-col gap-1.5">
                        <span className="text-[12.5px] font-semibold">Template *</span>
                        <select
                          className="h-9 rounded-[7px] border border-border-strong bg-card px-2.5 text-[13px]"
                          value={tplEmail}
                          onChange={(e) => setTplEmail(e.target.value)}
                        >
                          {prontos.email.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.nome}
                              {t.reguaSugerida ? ` · ${ROTULO_REGUA[t.reguaSugerida]}` : ""}
                            </option>
                          ))}
                        </select>
                      </label>
                      <Table>
                        <TableBody>
                          <TableRow>
                            <TableCell className="text-muted-foreground">Assunto</TableCell>
                            <TableCell>{tplEmailSel?.assunto}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="text-muted-foreground">Anexo</TableCell>
                            <TableCell>
                              {tplEmailSel?.anexoTipo === "link"
                                ? "Só link"
                                : "PDF protegido + link"}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="text-muted-foreground">Remetente</TableCell>
                            <TableCell>{biblioteca.data?.emailPronto.remetente ?? "—"}</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </>
                  )}
                </Card>
              )}
            </div>
          )}
        </>
      )}

      {passo === 4 && loteId && <PassoPrevia loteId={loteId} preparo={preparo} />}

      {passo === 5 && loteId && (
        <PassoConfirmacao
          loteId={loteId}
          podeAcionar={podeAcionar}
          podeExtra={podeExtra}
          extra={extra}
          setExtra={setExtra}
          justificativa={justificativa}
          setJustificativa={setJustificativa}
          acionando={acionando}
          onAcionar={acionarAgora}
          resumo={{
            titulo,
            origem,
            regua:
              tipo === "a_vencer"
                ? `A vencer · ${dataBr(vencDe)} a ${dataBr(vencAte)}`
                : faixa === "personalizada"
                  ? `Em atraso · faixa personalizada: ${diasMin || 1}${diasMax ? ` a ${diasMax}` : " ou mais"} dias`
                  : `Em atraso · faixa ${FAIXAS.find((f) => f.id === faixa)?.descricao ?? ""}`,
            emps,
            filtros: filtrosCampos.map(descreverFiltro),
            whats: canais.includes("whatsapp") ? (tplWhatsSel?.nome ?? null) : null,
            email: canais.includes("email") ? (tplEmailSel?.nome ?? null) : null,
            externo: rascunhoExterno,
          }}
        />
      )}

      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          disabled={passo === 1 || (rascunhoExterno && passo <= 4)}
          onClick={() => setPasso(passo - 1)}
        >
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Voltar
        </Button>
        <div className="flex items-center gap-3">
          {loteId && (
            <span className="text-[12px] text-muted-foreground">
              Rascunho salvo · aparece em Lotes
            </span>
          )}
          {passo < 5 && (
            <Button onClick={() => void avancar()} disabled={preparando}>
              {preparando ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              {passo === 3 ? "Montar pré-visualização" : "Continuar"}{" "}
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- passo 4

function PassoPrevia({
  loteId,
  preparo,
}: {
  loteId: string;
  preparo: {
    contadores: Contadores;
    ignoradas: { linha: number; motivo: string }[];
    limiteAtingido: boolean;
  } | null;
}) {
  const listar = useServerFn(listarPrevia);
  const alternar = useServerFn(alternarInclusao);
  const mensagem = useServerFn(previaMensagem);
  const [filtro, setFiltro] = useState<"todos" | "elegiveis" | "excecoes" | "excluidos">("todos");
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(0);
  const [sel, setSel] = useState<string | null>(null);

  const lista = useQuery({
    queryKey: ["regua-previa", loteId, filtro, busca, pagina],
    queryFn: () => listar({ data: { loteId, filtro, busca: busca || undefined, pagina } }),
    placeholderData: (a) => a,
  });
  const linhas = useMemo(() => lista.data?.linhas ?? [], [lista.data]);
  useEffect(() => {
    if (!sel && linhas.length)
      setSel((linhas.find((l) => l.status === "elegivel") ?? linhas[0]).id);
  }, [linhas, sel]);
  const msg = useQuery({
    queryKey: ["regua-msg", loteId, sel],
    queryFn: () => mensagem({ data: { loteId, boletoId: sel! } }),
    enabled: !!sel,
  });

  const c = lista.data?.contadores ?? preparo?.contadores;
  const indice = linhas.findIndex((l) => l.id === sel);

  async function alternarLinha(l: LinhaPrevia) {
    try {
      await alternar({ data: { loteId, ids: [l.id], incluido: !l.incluido } });
      await lista.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível alterar a linha.");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {c && (
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
          <div className="rounded-[10px] bg-secondary px-3.5 py-3">
            <b className="block text-[20px] font-extrabold">{c.no_lote + c.excluidos}</b>
            <span className="text-[12px] text-muted-foreground">Boletos encontrados</span>
          </div>
          <div className="rounded-[10px] bg-success-soft px-3.5 py-3">
            <b className="block text-[20px] font-extrabold">{c.elegiveis}</b>
            <span className="text-[12px] text-muted-foreground">Elegíveis para envio</span>
          </div>
          <div className="rounded-[10px] bg-primary-soft px-3.5 py-3">
            <b className="block text-[20px] font-extrabold">{c.nao_registrados}</b>
            <span className="text-[12px] text-muted-foreground">Não registrados no banco</span>
          </div>
          <div className="rounded-[10px] bg-warning-soft px-3.5 py-3">
            <b className="block text-[20px] font-extrabold">{c.sem_contato}</b>
            <span className="text-[12px] text-muted-foreground">Sem contato válido</span>
          </div>
        </div>
      )}
      {preparo?.limiteAtingido && (
        <Aviso tom="warning">
          A origem trouxe mais de 2.000 boletos; o lote ficou com os 2.000 primeiros. Refine os
          filtros e monte outro lote para o restante.
        </Aviso>
      )}
      {!!preparo?.ignoradas.length && (
        <Aviso tom="warning">
          {preparo.ignoradas.length} linha(s) da origem foram ignoradas:{" "}
          {preparo.ignoradas
            .slice(0, 4)
            .map((i) => `linha ${i.linha} (${i.motivo})`)
            .join("; ")}
          {preparo.ignoradas.length > 4 ? "…" : "."}
        </Aviso>
      )}

      <Card>
        <div className="flex flex-wrap items-center gap-2.5">
          <h2 className="text-[16px] font-bold">Boletos da remessa</h2>
          <span className="text-[12.5px] text-muted-foreground">
            Clique numa linha para ver a mensagem daquele cliente. Desmarque o que não deve entrar.
          </span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={busca}
                onChange={(e) => {
                  setBusca(e.target.value);
                  setPagina(0);
                }}
                placeholder="Cliente ou boleto"
                className="h-8 w-[180px] pl-7"
              />
            </div>
            <div className="inline-flex overflow-hidden rounded-[9px] border border-border-strong">
              {(
                [
                  ["todos", "Todos"],
                  ["elegiveis", "Elegíveis"],
                  ["excecoes", "Exceções"],
                  ["excluidos", "Excluídos"],
                ] as const
              ).map(([id, r]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setFiltro(id);
                    setPagina(0);
                  }}
                  className={cn(
                    "px-3 py-1.5 text-[12.5px] font-semibold",
                    filtro === id ? "bg-foreground text-white" : "text-muted-foreground",
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead />
                <TableHead>Cliente</TableHead>
                <TableHead>CPF/CNPJ</TableHead>
                <TableHead>Empreendimento · Unidade</TableHead>
                <TableHead>Boleto</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Atraso</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Banco</TableHead>
                <TableHead>WhatsApp</TableHead>
                <TableHead>E-mail</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhas.map((l) => (
                <TableRow
                  key={l.id}
                  onClick={() => setSel(l.id)}
                  className={cn(
                    "cursor-pointer",
                    sel === l.id &&
                      "bg-primary-soft outline outline-2 -outline-offset-2 outline-primary",
                    !l.incluido && "opacity-55",
                    (l.status === "excecao_registro" || l.status === "excecao_contato") &&
                      "bg-secondary/60",
                  )}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      aria-label={`Incluir ${l.cliente}`}
                      checked={l.incluido}
                      onChange={() => void alternarLinha(l)}
                      className="h-4 w-4 accent-[var(--primary)]"
                    />
                  </TableCell>
                  <TableCell className={cn("font-semibold", !l.incluido && "line-through")}>
                    {l.cliente}
                  </TableCell>
                  <TableCell className="whitespace-nowrap font-mono text-[12px]">
                    {l.documento}
                  </TableCell>
                  <TableCell>
                    {l.empreendimento ?? "—"}
                    {l.unidade ? ` · ${l.unidade}` : ""}
                  </TableCell>
                  <TableCell className="font-mono text-[12px]">{l.numero}</TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums">
                    {dataBr(l.vencimento)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums">
                    {l.diasAtraso != null && l.diasAtraso > 0 ? `${l.diasAtraso} dias` : "—"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums">{moeda(l.valor)}</TableCell>
                  <TableCell>
                    {l.status === "excluido" ? (
                      <SeloBoleto s="excluido" />
                    ) : (
                      <SeloRegistro s={l.registro} />
                    )}
                  </TableCell>
                  <TableCell>
                    <SeloContato s={l.whatsapp} />
                  </TableCell>
                  <TableCell>
                    <SeloContato s={l.email} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="flex items-center justify-between text-[12px] text-muted-foreground">
          <span>
            {lista.data ? `Mostrando ${linhas.length} de ${lista.data.total}` : "Carregando…"}
            {lista.isFetching && <Loader2 className="ml-1.5 inline h-3.5 w-3.5 animate-spin" />}
          </span>
          {lista.data && lista.data.total > lista.data.porPagina && (
            <div className="flex gap-1.5">
              <Button
                size="sm"
                variant="outline"
                disabled={pagina === 0}
                onClick={() => setPagina(pagina - 1)}
              >
                Anterior
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={(pagina + 1) * lista.data.porPagina >= lista.data.total}
                onClick={() => setPagina(pagina + 1)}
              >
                Próxima
              </Button>
            </div>
          )}
        </div>
      </Card>

      <Card>
        <div className="flex flex-wrap items-center gap-2.5">
          <h2 className="text-[16px] font-bold">
            Como a mensagem chega{msg.data ? ` para ${msg.data.cliente}` : ""}
          </h2>
          <span className="text-[12.5px] text-muted-foreground">
            Montada com os templates escolhidos e os dados deste boleto. Com os dois canais, as
            prévias ficam lado a lado.
          </span>
          <div className="ml-auto flex gap-1.5">
            <Button
              size="sm"
              variant="outline"
              disabled={indice <= 0}
              onClick={() => setSel(linhas[indice - 1]?.id ?? null)}
            >
              ‹ Anterior
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={indice < 0 || indice >= linhas.length - 1}
              onClick={() => setSel(linhas[indice + 1]?.id ?? null)}
            >
              Próximo cliente ›
            </Button>
          </div>
        </div>
        {msg.isLoading || !msg.data ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Montando a mensagem…
          </div>
        ) : (
          <>
            <div
              className={cn("grid gap-4", msg.data.whatsapp && msg.data.email && "lg:grid-cols-2")}
            >
              {msg.data.whatsapp && (
                <div>
                  <div className="mb-2.5 flex flex-wrap items-center gap-1.5 text-[12.5px]">
                    <b className="inline-flex items-center gap-1">
                      <MessageCircle className="h-4 w-4 text-success" /> WhatsApp
                    </b>
                    <span className="text-muted-foreground">
                      · {msg.data.whatsapp.template} · para {msg.data.whatsapp.para}
                    </span>
                  </div>
                  <PreviaWhatsapp
                    texto={msg.data.whatsapp.texto}
                    documento={msg.data.whatsapp.documento}
                  />
                </div>
              )}
              {msg.data.email && (
                <div>
                  <div className="mb-2.5 flex flex-wrap items-center gap-1.5 text-[12.5px]">
                    <b className="inline-flex items-center gap-1">
                      <Mail className="h-4 w-4 text-info" /> E-mail
                    </b>
                    <span className="text-muted-foreground">
                      · {msg.data.email.template} · para {msg.data.email.para}
                    </span>
                  </div>
                  <PreviaEmail
                    de={msg.data.email.de}
                    para={msg.data.email.para}
                    assunto={msg.data.email.assunto}
                    texto={msg.data.email.texto}
                    anexo={msg.data.email.anexo}
                  />
                </div>
              )}
            </div>
            {!msg.data.whatsapp && !msg.data.email && (
              <Aviso tom="warning">Nenhuma mensagem sai para este cliente.</Aviso>
            )}
            {msg.data.avisos.map((a) => (
              <Aviso key={a} tom="warning">
                {a}
              </Aviso>
            ))}
          </>
        )}
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------- passo 5

function PassoConfirmacao(p: {
  loteId: string;
  podeAcionar: boolean;
  podeExtra: boolean;
  extra: boolean;
  setExtra: (v: boolean) => void;
  justificativa: string;
  setJustificativa: (v: string) => void;
  acionando: boolean;
  onAcionar: () => void;
  resumo: {
    titulo: string;
    origem: "rm" | "planilha";
    regua: string;
    emps: string[];
    filtros: string[];
    whats: string | null;
    email: string | null;
    externo: boolean;
  };
}) {
  const listar = useServerFn(listarPrevia);
  const { data } = useQuery({
    queryKey: ["regua-previa", p.loteId, "todos", "", 0],
    queryFn: () => listar({ data: { loteId: p.loteId, filtro: "todos", pagina: 0 } }),
  });
  const c = data?.contadores;
  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <Card>
        <h2 className="text-[16px] font-bold">Resumo da remessa</h2>
        <Table>
          <TableBody>
            <TableRow>
              <TableCell className="text-muted-foreground">Título</TableCell>
              <TableCell className="font-bold">{data?.lote.titulo ?? p.resumo.titulo}</TableCell>
            </TableRow>
            {!p.resumo.externo && (
              <>
                <TableRow>
                  <TableCell className="text-muted-foreground">Origem</TableCell>
                  <TableCell>{p.resumo.origem === "rm" ? "TOTVS RM" : "Planilha"}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-muted-foreground">Régua</TableCell>
                  <TableCell>{p.resumo.regua}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-muted-foreground">Empreendimentos</TableCell>
                  <TableCell>{p.resumo.emps.length ? p.resumo.emps.join(", ") : "Todos"}</TableCell>
                </TableRow>
                {p.resumo.filtros.length > 0 && (
                  <TableRow>
                    <TableCell className="text-muted-foreground">Filtros por campo</TableCell>
                    <TableCell>{p.resumo.filtros.join(" · ")}</TableCell>
                  </TableRow>
                )}
              </>
            )}
            <TableRow>
              <TableCell className="text-muted-foreground">Boletos</TableCell>
              <TableCell>
                {c ? (
                  <>
                    <b>{c.elegiveis}</b> elegíveis · {c.nao_registrados + c.sem_contato} exceções
                    {c.excluidos ? ` · ${c.excluidos} excluídos` : ""}
                  </>
                ) : (
                  "…"
                )}
              </TableCell>
            </TableRow>
            {data?.lote.canais.includes("whatsapp") && (
              <TableRow>
                <TableCell className="text-muted-foreground">WhatsApp</TableCell>
                <TableCell>{p.resumo.whats ?? "Template escolhido no rascunho"}</TableCell>
              </TableRow>
            )}
            {data?.lote.canais.includes("email") && (
              <TableRow>
                <TableCell className="text-muted-foreground">E-mail</TableCell>
                <TableCell>{p.resumo.email ?? "Template escolhido no rascunho"}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <Aviso>
          <b>Trava de 24 h.</b> Um boleto que já saiu por um canal nas últimas 24 h não sai de novo
          por ele (fica como “Trava 24 h”), salvo no disparo extraordinário.
        </Aviso>
      </Card>
      <Card>
        <h2 className="text-[16px] font-bold">Acionar</h2>
        {p.podeExtra && (
          <>
            <label className="flex items-center gap-2.5 text-[13px] font-semibold">
              <Switch checked={p.extra} onCheckedChange={p.setExtra} /> Disparo extraordinário
            </label>
            <p className="text-[12.5px] text-muted-foreground">
              Ignora a trava de 24 h. Exige justificativa e fica destacado na Auditoria.
            </p>
            {p.extra && (
              <Textarea
                value={p.justificativa}
                onChange={(e) => p.setJustificativa(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="Por que este disparo precisa ignorar a trava?"
              />
            )}
          </>
        )}
        {p.podeAcionar ? (
          <Button
            onClick={p.onAcionar}
            disabled={p.acionando || !c?.elegiveis}
            className="justify-center"
          >
            {p.acionando ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-1.5 h-4 w-4" />
            )}
            Acionar lote ({c?.elegiveis ?? 0} boletos)
          </Button>
        ) : (
          <Aviso tom="warning">
            Seu perfil monta o lote mas não aciona. Peça a um gestor para acionar este rascunho em
            Lotes.
          </Aviso>
        )}
        <p className="text-center text-[12px] text-muted-foreground">
          O envio acontece com a tela do lote aberta, respeitando o intervalo entre mensagens. Você
          acompanha em Lotes.
        </p>
      </Card>
    </div>
  );
}
