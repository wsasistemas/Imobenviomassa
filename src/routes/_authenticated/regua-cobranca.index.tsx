import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  AlertTriangle,
  Clock,
  Loader2,
  Mail,
  MessageCircle,
  Plus,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { PageHead, SemAcesso } from "@/components/page";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Aviso, Kpi, SeloLote, SeloRegua, Vazio } from "@/components/regua/ui";
import { reguaDoLote } from "@/lib/regua/comum";
import { useCurrentUser } from "@/hooks/use-current-user";
import { painelRegua } from "@/lib/regua/regua.functions";
import { dataHoraBr } from "@/lib/regua/comum";

export const Route = createFileRoute("/_authenticated/regua-cobranca/")({
  component: PainelReguaPage,
});

// Cores validadas (dataviz/validate_palette.js, modo claro): passam CVD, contraste e separação.
const COR_WHATSAPP = "#2e9e5b";
const COR_EMAIL = "#3b78c4";

const hoje = () => new Date().toISOString().slice(0, 10);
const diasAtras = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

function tempo(seg: number): string {
  if (!seg) return "—";
  const m = Math.floor(seg / 60);
  const s = Math.round(seg % 60);
  return m ? `${m} min ${s} s` : `${s} s`;
}

const pct = (a: number, b: number) =>
  b ? `${((a / b) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%` : "—";

function Filtro({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        {rotulo}
      </span>
      {children}
    </label>
  );
}

const selCls = "h-9 w-full rounded-[7px] border border-border-strong bg-card px-2.5 text-[13px]";

function PainelReguaPage() {
  const { podeAcessar, loading } = useCurrentUser();
  const carregar = useServerFn(painelRegua);
  const [periodo, setPeriodo] = useState("30");
  const [de, setDe] = useState(diasAtras(30));
  const [ate, setAte] = useState(hoje());
  const [empreendimento, setEmpreendimento] = useState("");
  const [canal, setCanal] = useState("");
  const [regua, setRegua] = useState("");
  const [status, setStatus] = useState("");
  const [lote, setLote] = useState("");

  const filtros = useMemo(
    () => ({
      de: periodo === "custom" ? de : diasAtras(Number(periodo)),
      ate: periodo === "custom" ? ate : hoje(),
      empreendimento: empreendimento || null,
      canal: (canal || null) as "whatsapp" | "email" | null,
      regua: (regua || null) as "a_vencer" | "30" | "60" | "90" | "90+" | null,
      status: (status || null) as
        "em_processamento" | "concluido" | "concluido_com_falhas" | "cancelado" | null,
      loteId: lote || null,
    }),
    [periodo, de, ate, empreendimento, canal, regua, status, lote],
  );
  const {
    data: p,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["regua-painel", filtros],
    queryFn: () => carregar({ data: filtros }),
    enabled: !loading && podeAcessar("regua_dashboard_ver"),
  });

  if (loading) return null;
  if (!podeAcessar("regua_dashboard_ver"))
    return <SemAcesso texto="Seu perfil não vê o painel da Régua de Cobrança." />;

  const porDia = (p?.por_dia ?? []).map((d) => ({
    ...d,
    rotulo: d.dia.slice(8, 10) + "/" + d.dia.slice(5, 7),
  }));
  const maxEmp = Math.max(1, ...(p?.por_empreendimento ?? []).map((e) => e.boletos));

  return (
    <div className="flex flex-col gap-5">
      <PageHead
        title="Painel da Régua"
        actions={
          podeAcessar("regua_lote_criar") && (
            <Button asChild size="sm">
              <Link to="/regua-cobranca/novo">
                <Plus className="mr-1.5 h-4 w-4" /> Novo lote
              </Link>
            </Button>
          )
        }
      >
        Indicadores dos lotes de boletos a vencer e em atraso enviados por WhatsApp e e-mail.
      </PageHead>

      <section className="rounded-xl border bg-card px-5 py-4 shadow-card">
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4 xl:grid-cols-7">
          <Filtro rotulo="Período">
            <select className={selCls} value={periodo} onChange={(e) => setPeriodo(e.target.value)}>
              <option value="7">Últimos 7 dias</option>
              <option value="30">Últimos 30 dias</option>
              <option value="90">Últimos 90 dias</option>
              <option value="365">Últimos 12 meses</option>
              <option value="custom">Escolher datas</option>
            </select>
          </Filtro>
          {periodo === "custom" && (
            <>
              <Filtro rotulo="De">
                <input
                  type="date"
                  className={selCls}
                  value={de}
                  onChange={(e) => setDe(e.target.value)}
                />
              </Filtro>
              <Filtro rotulo="Até">
                <input
                  type="date"
                  className={selCls}
                  value={ate}
                  onChange={(e) => setAte(e.target.value)}
                />
              </Filtro>
            </>
          )}
          <Filtro rotulo="Empreendimento">
            <select
              className={selCls}
              value={empreendimento}
              onChange={(e) => setEmpreendimento(e.target.value)}
            >
              <option value="">Todos</option>
              {(p?.empreendimentos ?? []).map((e) => (
                <option key={e}>{e}</option>
              ))}
            </select>
          </Filtro>
          <Filtro rotulo="Canal">
            <select className={selCls} value={canal} onChange={(e) => setCanal(e.target.value)}>
              <option value="">WhatsApp + E-mail</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="email">E-mail</option>
            </select>
          </Filtro>
          <Filtro rotulo="Status do lote">
            <select className={selCls} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Todos</option>
              <option value="em_processamento">Em processamento</option>
              <option value="concluido">Concluído</option>
              <option value="concluido_com_falhas">Concluído com falhas</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </Filtro>
          <Filtro rotulo="Régua / faixa">
            <select className={selCls} value={regua} onChange={(e) => setRegua(e.target.value)}>
              <option value="">Todas</option>
              <option value="a_vencer">A vencer</option>
              <option value="30">Atraso 30 dias</option>
              <option value="60">Atraso 60 dias</option>
              <option value="90">Atraso 90 dias</option>
              <option value="90+">Acima de 90</option>
            </select>
          </Filtro>
          <Filtro rotulo="Lote">
            <select className={selCls} value={lote} onChange={(e) => setLote(e.target.value)}>
              <option value="">Todos</option>
              {(p?.ultimos ?? [])
                .filter((l) => l.status !== "rascunho")
                .map((l) => (
                  <option key={l.id} value={l.id}>
                    #{l.numero} · {l.titulo}
                  </option>
                ))}
            </select>
          </Filtro>
        </div>
      </section>

      {error && (
        <Aviso tom="danger">
          {error instanceof Error ? error.message : "Não foi possível carregar o painel."}
        </Aviso>
      )}
      {isLoading || !p ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando indicadores…
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <Kpi
              icone={TrendingUp}
              valor={pct(p.sucesso, p.elegiveis)}
              rotulo="Taxa de sucesso da régua"
              extra={`${p.sucesso} de ${p.elegiveis} elegíveis`}
            />
            <Kpi
              icone={MessageCircle}
              valor={`${p.whatsapp.enviados} / ${p.whatsapp.entregues}`}
              rotulo="WhatsApp enviados / entregues"
            />
            <Kpi
              icone={Mail}
              valor={`${p.email.enviados} / ${p.email.entregues}`}
              rotulo="E-mails enviados / entregues"
            />
            <Kpi
              icone={AlertTriangle}
              valor={p.invalidos}
              rotulo={`Contatos inválidos (${pct(p.invalidos, p.boletos)})`}
            />
            <Kpi
              icone={XCircle}
              valor={p.falhas + p.nao_registrados}
              rotulo={`Falhas de processamento (${pct(p.falhas + p.nao_registrados, p.boletos)})`}
            />
            <Kpi icone={Clock} valor={tempo(p.tempo_medio_seg)} rotulo="Tempo médio por lote" />
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
            <section className="rounded-xl border bg-card px-5 py-4 shadow-card">
              <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-[16px] font-bold">Mensagens enviadas por dia e canal</h2>
                <div className="flex gap-3.5 text-[12px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <i
                      className="inline-block h-2.5 w-2.5 rounded-[3px]"
                      style={{ background: COR_WHATSAPP }}
                    />{" "}
                    WhatsApp
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <i
                      className="inline-block h-2.5 w-2.5 rounded-[3px]"
                      style={{ background: COR_EMAIL }}
                    />{" "}
                    E-mail
                  </span>
                </div>
              </div>
              {porDia.length === 0 ? (
                <Vazio titulo="Nenhuma mensagem enviada no período" />
              ) : (
                <div className="h-[230px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={porDia} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke="var(--border)" />
                      <XAxis dataKey="rotulo" tickLine={false} axisLine={false} fontSize={11} />
                      <YAxis
                        allowDecimals={false}
                        tickLine={false}
                        axisLine={false}
                        fontSize={11}
                      />
                      <Tooltip
                        cursor={{ fill: "var(--muted)" }}
                        contentStyle={{ borderRadius: 10, fontSize: 12 }}
                        formatter={(v: number, nome: string) => [
                          v,
                          nome === "whatsapp" ? "WhatsApp" : "E-mail",
                        ]}
                      />
                      <Bar
                        dataKey="email"
                        stackId="c"
                        fill={COR_EMAIL}
                        stroke="var(--card)"
                        strokeWidth={2}
                      />
                      <Bar
                        dataKey="whatsapp"
                        stackId="c"
                        fill={COR_WHATSAPP}
                        stroke="var(--card)"
                        strokeWidth={2}
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </section>
            <section className="rounded-xl border bg-card px-5 py-4 shadow-card">
              <h2 className="mb-2.5 text-[16px] font-bold">Taxa de sucesso por empreendimento</h2>
              {(p.por_empreendimento ?? []).length === 0 ? (
                <Vazio titulo="Sem boletos no período" />
              ) : (
                <div className="flex flex-col">
                  {p.por_empreendimento.map((e) => (
                    <div
                      key={e.empreendimento}
                      className="grid grid-cols-[minmax(0,150px)_1fr_auto] items-center gap-2.5 py-1.5 text-[12.5px]"
                    >
                      <span className="truncate" title={e.empreendimento}>
                        {e.empreendimento}
                      </span>
                      <div
                        className="h-2 overflow-hidden rounded-full bg-muted"
                        title={`${e.boletos} boletos`}
                      >
                        <i
                          className="block h-full rounded-full bg-primary"
                          style={{ width: `${(e.sucesso / Math.max(1, e.boletos)) * 100}%` }}
                        />
                      </div>
                      <b className="text-right tabular-nums">
                        {pct(e.sucesso, e.boletos)}{" "}
                        <span className="font-normal text-muted-foreground">· {e.boletos}</span>
                      </b>
                    </div>
                  ))}
                  <p className="mt-1.5 text-[11.5px] text-muted-foreground">
                    Volume: boletos enviados por empreendimento (maior: {maxEmp}).
                  </p>
                </div>
              )}
            </section>
          </div>

          <section className="rounded-xl border bg-card px-5 py-4 shadow-card">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[16px] font-bold">Últimos lotes</h2>
              <Button asChild variant="outline" size="sm">
                <Link to="/regua-cobranca/lotes">Ver todos</Link>
              </Button>
            </div>
            {p.ultimos.length === 0 ? (
              <Vazio titulo="Nenhum lote ainda">Monte o primeiro em Novo lote.</Vazio>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Lote</TableHead>
                      <TableHead>Título da remessa</TableHead>
                      <TableHead>Régua</TableHead>
                      <TableHead>Acionado em</TableHead>
                      <TableHead>Por</TableHead>
                      <TableHead>Boletos</TableHead>
                      <TableHead>Sucesso</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {p.ultimos.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell className="font-bold">#{l.numero}</TableCell>
                        <TableCell className="font-semibold">{l.titulo}</TableCell>
                        <TableCell>
                          <SeloRegua r={reguaDoLote(l.tipoRegua, l.faixa)} />
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {dataHoraBr(l.iniciadoEm)}
                        </TableCell>
                        <TableCell>{l.usuario ?? "—"}</TableCell>
                        <TableCell className="tabular-nums">
                          {l.contadores.no_lote ?? "—"}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {pct(l.contadores.sucesso ?? 0, l.contadores.elegiveis ?? 0)}
                        </TableCell>
                        <TableCell>
                          <SeloLote s={l.status} />
                        </TableCell>
                        <TableCell>
                          <Link
                            to="/regua-cobranca/lotes/$loteId"
                            params={{ loteId: l.id }}
                            className="text-[12px] font-bold text-primary"
                          >
                            Abrir
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
