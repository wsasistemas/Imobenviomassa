import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";

import { useQuery } from "@tanstack/react-query";
import { StepShell } from "@/components/wizard/step-shell";
import { useWizardStore, type CompradorRow } from "@/stores/wizard-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Database, Download, FileSpreadsheet, RefreshCw, Search, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  listarEmpreendimentosTotvs,
  buscarCompradoresPorEmpreendimento,
} from "@/lib/integracoes/totvs.functions";
import { EmpreendimentoCard } from "@/components/wizard/empreendimento-card";
import {
  readEmpreendimentosCache,
  writeEmpreendimentosCache,
  isEmpreendimentosCacheFresh,
  TOTVS_CACHE_TTL_MS,
} from "@/services/totvs-cache";
import { toast } from "sonner";

const UPLOAD_MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const UPLOAD_MAX_LINHAS = 5_000; // linhas de dados (sem o cabeçalho)
const UPLOAD_EXTENSOES = ["xlsx", "xls", "csv"];

export const Route = createFileRoute("/_authenticated/disparo/novo/origem")({
  component: EtapaOrigem,
});

function EtapaOrigem() {
  const navigate = useNavigate();
  const origem = useWizardStore((s) => s.origem);
  const setOrigem = useWizardStore((s) => s.setOrigem);
  const filtros = useWizardStore((s) => s.filtros_totvs);
  const setFiltros = useWizardStore((s) => s.setFiltrosTotvs);
  const setCompradores = useWizardStore((s) => s.setCompradores);
  const setSelecionados = useWizardStore((s) => s.setSelecionados);
  const setNome = useWizardStore((s) => s.setNome);
  const compradores = useWizardStore((s) => s.compradores);

  const [q, setQ] = useState("");
  const [dq, setDq] = useState("");
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [xlsLoading, setXlsLoading] = useState(false);

  // Debounce da busca (200 ms) — evita refiltrar a lista a cada tecla.
  useEffect(() => {
    const t = setTimeout(() => setDq(q), 200);
    return () => clearTimeout(t);
  }, [q]);

  const [refreshTick, setRefreshTick] = useState(0);
  const [now, setNow] = useState(Date.now());


  // Semente do cache local (localStorage, TTL 5 min) — padrão "superapp":
  // hidrata a UI imediatamente e o React Query revalida em segundo plano.
  const initialCacheRef = useRef(readEmpreendimentosCache());
  const initialCache = initialCacheRef.current;

  const empQ = useQuery({
    queryKey: ["totvs-empreendimentos"],
    queryFn: async () => {
      const res = await listarEmpreendimentosTotvs({
        data: { forceRefresh: refreshTick > 0 },
      });
      if (!res.error && res.empreendimentos.length > 0 && res.fetchedAt) {
        writeEmpreendimentosCache({
          empreendimentos: res.empreendimentos,
          fetchedAt: res.fetchedAt,
          count: res.count,
        });
      }
      return res;
    },
    enabled: origem === "totvs",
    staleTime: TOTVS_CACHE_TTL_MS,
    refetchInterval: origem === "totvs" ? TOTVS_CACHE_TTL_MS : false,
    refetchOnWindowFocus: true,
    initialData: initialCache
      ? {
          empreendimentos: initialCache.empreendimentos,
          fetchedAt: initialCache.fetchedAt,
          fromCache: true,
          count: initialCache.count ?? initialCache.empreendimentos.length,
        }
      : undefined,
    initialDataUpdatedAt: initialCache && isEmpreendimentosCacheFresh(initialCache)
      ? new Date(initialCache.fetchedAt).getTime()
      : 0,
  });

  // Tick a cada 10s para atualizar "há Xs" na tela
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(t);
  }, []);

  const recarregar = async () => {
    setRefreshTick((n) => n + 1);
    const r = await empQ.refetch();
    if (r.data?.error) {
      toast.error("Falha ao consultar TOTVS", { description: r.data.error });
    } else if (r.data) {
      toast.success(`${r.data.empreendimentos.length} empreendimentos carregados`);
    }
  };

  const fetchedAt = empQ.data?.fetchedAt;
  const relTime = useMemo(() => {
    if (!fetchedAt) return null;
    const secs = Math.max(0, Math.floor((now - new Date(fetchedAt).getTime()) / 1000));
    if (secs < 60) return `há ${secs}s`;
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `há ${mins} min`;
    return `há ${Math.floor(mins / 60)}h`;
  }, [fetchedAt, now]);

  const filtered = useMemo(() => {
    const list = empQ.data?.empreendimentos ?? [];
    if (!dq.trim()) return list;
    const t = dq.toLowerCase();
    return list.filter(
      (e) =>
        e.nome.toLowerCase().includes(t) ||
        e.codigo.toLowerCase().includes(t) ||
        e.subtitulo.toLowerCase().includes(t),
    );
  }, [empQ.data, dq]);

  const selecionarEmpreendimento = async (emp: {
    id: string;
    codigo: string;
    nome: string;
  }) => {
    setLoadingId(emp.id);
    setFiltros({
      empreendimento_id: emp.id,
      empreendimento_nome: emp.nome,
      empreendimento_codigo: emp.codigo,
    });
    try {
      const res = await buscarCompradoresPorEmpreendimento({
        data: { empreendimento_id: emp.id },
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      const rows: CompradorRow[] = res.contratos.map((c) => ({
        id: c.id,
        nome: c.nome,
        cpf: c.cpf,
        telefone: c.telefone,
        email: c.email,
        empreendimento: c.empreendimento,
        bloco: c.bloco,
        unidade: c.unidade,
        dados_extras: c.dados_extras,
      }));
      setCompradores(rows);
      setSelecionados(rows.map((r) => r.id));
      if (rows.length === 0) {
        toast.warning(`Nenhum comprador retornado pela TOTVS para ${emp.nome}`);
      } else {
        toast.success(`${rows.length} compradores carregados de ${emp.nome}`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao buscar compradores");
    } finally {
      setLoadingId(null);
    }

  };

  const handleFile = async (file: File) => {
    // Limites de upload: tamanho e extensão conferidos antes de parsear;
    // linhas limitadas na leitura (sheetRows) para não processar além do teto.
    const ext = (file.name.split(".").pop() ?? "").toLowerCase();
    if (!UPLOAD_EXTENSOES.includes(ext)) {
      toast.error("Formato não suportado", { description: "Envie um arquivo .xlsx, .xls ou .csv." });
      return;
    }
    if (file.size > UPLOAD_MAX_BYTES) {
      toast.error("Arquivo muito grande", {
        description: `O limite é ${UPLOAD_MAX_BYTES / (1024 * 1024)} MB (este arquivo tem ${(file.size / (1024 * 1024)).toFixed(1)} MB).`,
      });
      return;
    }

    setXlsLoading(true);
    try {
      // Carrega o parser XLSX sob demanda (evita ~500 KB no bundle inicial).
      const XLSX = await import("xlsx");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, {
        type: "array",
        dense: true,
        sheetRows: UPLOAD_MAX_LINHAS + 2, // cabeçalho + limite + 1 para detectar excesso
        cellHTML: false,
        cellFormula: false,
      });
      const ws = wb.Sheets[wb.SheetNames[0]];
      if (!ws) throw new Error("Planilha vazia");
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
      if (json.length > UPLOAD_MAX_LINHAS) {
        toast.error("Planilha com linhas demais", {
          description: `O limite é ${UPLOAD_MAX_LINHAS.toLocaleString("pt-BR")} linhas de dados. Divida o arquivo em partes menores.`,
        });
        return;
      }
      const rows: CompradorRow[] = json.map((r: Record<string, unknown>, i: number) => {
        const pick = (keys: string[]) => {
          for (const k of keys) {
            const found = Object.keys(r).find((c) => c.toLowerCase().trim() === k);
            if (found && r[found] !== "") return String(r[found]);
          }
          return null;
        };
        const nomeSegundo = pick(["comprador_2", "comprador 2", "nome_2", "nome 2"]);
        const emailSegundo = pick(["email_2", "e-mail_2", "email 2"]);
        const telSegundo = pick(["telefone_2", "celular_2", "whatsapp_2", "telefone 2"]);
        const dados_extras: Record<string, unknown> = {};
        if (nomeSegundo) dados_extras.nome_conjuge = nomeSegundo;
        if (emailSegundo) dados_extras.email_conjuge = emailSegundo;
        if (telSegundo) dados_extras.telefone_conjuge = telSegundo;
        return {
          id: `XLS-${i + 1}`,
          nome: pick(["comprador_1", "comprador 1", "nome", "nome completo", "comprador"]) ?? "",
          cpf: pick(["cpf"]),
          telefone: pick(["telefone", "celular", "whatsapp"]),
          email: pick(["email", "e-mail"]),
          empreendimento: pick(["empreendimento", "obra"]),
          bloco: pick(["bloco", "torre"]),
          unidade: pick(["unidade", "apto", "apartamento"]),
          dados_extras: Object.keys(dados_extras).length ? dados_extras : undefined,
        };
      });

      setCompradores(rows);
      setSelecionados(rows.map((r) => r.id));
      toast.success(`${rows.length} linhas importadas`);
    } catch (e) {
      toast.error("Não foi possível ler a planilha");
    } finally {
      setXlsLoading(false);
    }
  };

  const baixarPlanilhaModelo = async () => {
    try {
      const XLSX = await import("xlsx");
      const headers = ["comprador_1", "comprador_2", "email", "email_2", "telefone", "telefone_2", "unidade", "bloco"];
      const exemplo = [
        {
          comprador_1: "João da Silva",
          comprador_2: "Maria da Silva",
          email: "joao@exemplo.com",
          email_2: "maria@exemplo.com",
          telefone: "55 (11) 91234-5678",
          telefone_2: "55 (11) 98888-1111",
          unidade: "101",
          bloco: "A",
        },
        {
          comprador_1: "Carlos Souza",
          comprador_2: "",
          email: "carlos@exemplo.com",
          email_2: "",
          telefone: "55 (11) 98765-4321",
          telefone_2: "",
          unidade: "202",
          bloco: "B",
        },
      ];
      const ws = XLSX.utils.json_to_sheet(exemplo, { header: headers });
      ws["!cols"] = [{ wch: 26 }, { wch: 26 }, { wch: 28 }, { wch: 28 }, { wch: 18 }, { wch: 18 }, { wch: 12 }, { wch: 10 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Compradores");
      XLSX.writeFile(wb, "modelo-compradores.xlsx");

    } catch {
      toast.error("Não foi possível gerar a planilha modelo");
    }
  };


  // limpar seleção ao trocar origem
  useEffect(() => {
    if (!origem) return;
  }, [origem]);

  const nome = useWizardStore((s) => s.nome);
  const [touchedNome, setTouchedNome] = useState(false);
  // Com compradores carregados, o nome vazio já aparece como pendência (o campo fica acima da lista).
  const nomeErro = (touchedNome || compradores.length > 0) && !nome.trim();

  // O botão habilita com origem + compradores; o nome é conferido no clique, que leva o foco ao campo.
  const canContinue = !!origem && compradores.length > 0;

  function continuar() {
    if (!nome.trim()) {
      setTouchedNome(true);
      const campo = document.getElementById("wiz-nome");
      campo?.scrollIntoView({ behavior: "smooth", block: "center" });
      campo?.focus();
      toast.error("Informe o nome da campanha para continuar.");
      return;
    }
    navigate({ to: "/disparo/novo/compradores" });
  }

  return (
    <StepShell
      title="Origem dos dados"
      description="Escolha de onde vêm os compradores que receberão o documento."
      onNext={continuar}
      nextDisabled={!canContinue}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <OrigemCard
          selected={origem === "totvs"}
          onClick={() => setOrigem("totvs")}
          icon={<Database className="h-5 w-5" />}
          title="TOTVS RM"
          desc="Buscar contratos direto do ERP por empreendimento."
          badge="Integração estruturada"
        />
        <OrigemCard
          selected={origem === "excel"}
          onClick={() => setOrigem("excel")}
          icon={<FileSpreadsheet className="h-5 w-5" />}
          title="Planilha Excel"
          desc="Importar arquivo .xlsx / .csv com a lista de compradores."
          badge="Colunas: comprador_1, comprador_2, email, telefone, unidade"
        />
      </div>

      <div className="mt-6">
        <Label htmlFor="wiz-nome" className="text-xs text-muted-foreground">
          Nome da campanha <span className="text-destructive">*</span>
        </Label>
        <Input
          id="wiz-nome"
          placeholder="Ex.: Contratos Bloco A — Set/26"
          value={nome}
          onChange={(e) => {
            setNome(e.target.value);
            if (!touchedNome) setTouchedNome(true);
          }}
          className={nomeErro ? "border-destructive focus-visible:ring-destructive" : ""}
        />
        {nomeErro && (
          <p className="mt-1 text-xs text-destructive">Informe o nome da campanha para continuar.</p>
        )}
      </div>

      {origem === "totvs" && (
        <Card className="mt-6">
          <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
            <div className="min-w-0 flex-1">
              <CardTitle className="text-sm">Selecionar empreendimento</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Selecione o empreendimento para buscar os compradores via API TOTVS.
              </p>
              {relTime && (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                  <span className="text-muted-foreground">
                    Última sincronização: {relTime}
                    {typeof empQ.data?.count === "number" && ` · ${empQ.data.count} empreendimentos`}
                    {empQ.data?.fromCache && " · cache"}
                  </span>
                </div>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={recarregar}
              disabled={empQ.isFetching}
            >
              <RefreshCw className={cn("mr-2 h-3.5 w-3.5", empQ.isFetching && "animate-spin")} />
              {empQ.isFetching ? "Consultando TOTVS…" : "Recarregar"}
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {filtros.empreendimento_nome && compradores.length > 0 && (
              <div className="flex items-center gap-3 rounded-lg border bg-primary/10 px-4 py-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                  {compradores.length}
                </span>
                <div>
                  <p className="text-sm font-medium">{compradores.length} compradores carregados</p>
                  <p className="text-xs text-muted-foreground">
                    de {filtros.empreendimento_nome}. Prossiga para revisar.
                  </p>
                </div>
              </div>
            )}
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Pesquisar empreendimento…"
                className="pl-9"
              />
            </div>
            {empQ.data?.error && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                <div className="font-medium">Falha ao consultar TOTVS</div>
                <div className="mt-1 text-xs opacity-90">{empQ.data.error}</div>
              </div>
            )}


            {empQ.isLoading ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-[120px] animate-pulse rounded-xl border bg-muted/40"
                  />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
                Nenhum empreendimento encontrado.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {filtered.map((e) => (
                  <EmpreendimentoCard
                    key={e.id}
                    codigo={e.codigo}
                    nome={e.nome}
                    subtitulo={e.subtitulo}
                    selected={filtros.empreendimento_id === e.id}
                    loading={loadingId === e.id}
                    onClick={() => selecionarEmpreendimento(e)}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {origem === "excel" && (
        <Card className="mt-6">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
            <CardTitle className="text-sm">Upload da planilha</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={baixarPlanilhaModelo}>
              <Download className="mr-2 h-4 w-4" />
              Baixar planilha modelo
            </Button>
          </CardHeader>
          <CardContent>
            {compradores.length > 0 && (
              <div className="mb-4 flex items-center gap-3 rounded-lg border bg-primary/10 px-4 py-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                  {compradores.length}
                </span>
                <div>
                  <p className="text-sm font-medium">{compradores.length} compradores prontos para revisão</p>
                  <p className="text-xs text-muted-foreground">Prossiga para a próxima etapa para revisar.</p>
                </div>
              </div>
            )}
            <div className="mb-3 rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
              Colunas obrigatórias:{" "}
              <span className="font-medium text-foreground">comprador_1, email, telefone, unidade, bloco</span>.
              Colunas opcionais (2º comprador):{" "}
              <span className="font-medium text-foreground">comprador_2, email_2, telefone_2</span>.
              Baixe o modelo acima para garantir o formato correto.
            </div>

            <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed py-10 text-center hover:bg-muted/40">
              <Upload className="h-8 w-8 text-muted-foreground" />
              <span className="mt-2 text-sm font-medium">
                {xlsLoading ? "Processando…" : "Clique para escolher arquivo"}
              </span>
              <span className="text-xs text-muted-foreground">.xlsx, .xls ou .csv</span>
              <input
                type="file"
                className="hidden"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
            </label>
          </CardContent>
        </Card>
      )}
    </StepShell>
  );
}

function OrigemCard({
  selected,
  onClick,
  icon,
  title,
  desc,
  badge,
}: {
  selected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  desc: string;
  badge: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-start rounded-lg border p-4 text-left transition-colors",
        selected
          ? "border-primary bg-primary/5 ring-1 ring-primary"
          : "hover:border-primary/40 hover:bg-muted/40",
      )}
    >
      <div
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-lg",
          selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
        )}
      >
        {icon}
      </div>
      <div className="mt-3 font-medium">{title}</div>
      <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
      <span className="mt-3 rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
        {badge}
      </span>
    </button>
  );
}
