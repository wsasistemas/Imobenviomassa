import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { PageHead, Panel, SemAcesso, Selo } from "@/components/page";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCurrentUser } from "@/hooks/use-current-user";
import { listarTentativasLogin, type TentativaLogin } from "@/lib/auth.functions";
import { listarAuditoria, type LinhaAuditoria } from "@/lib/logs.functions";

export const Route = createFileRoute("/_authenticated/administracao/logs")({
  component: LogsPage,
});

type LogRow = LinhaAuditoria;

/** Aviso discreto para o Admin: IP e e-mail chegam mascarados do servidor (só o Super Admin vê completos). */
function AvisoMascara() {
  return (
    <p className="mb-3 text-xs text-muted-foreground">IP e e-mail aparecem mascarados para o seu perfil.</p>
  );
}

/** Detalhe legível: objetos viram "chave: valor · chave: valor". */
function detalheTexto(d: unknown): string {
  if (d == null) return "";
  if (typeof d !== "object") return String(d);
  return Object.entries(d as Record<string, unknown>)
    .map(([k, v]) => `${k.replace(/_/g, " ")}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
    .join(" · ");
}

function LogsPage() {
  const { pode, loading } = useCurrentUser();
  if (loading) return null;
  if (!pode("logs")) return <SemAcesso texto="Seu perfil não tem acesso ao histórico de ações." />;
  return (
    <div className="flex flex-col gap-5">
      <PageHead title="Logs Gerais — Histórico de Ações">
        Registro do que os usuários fazem no portal — alterações de usuários, integrações e credenciais, disparos e
        demais ações administrativas, sempre gravado pelo servidor com o IP de origem. Somente para consulta — não é
        possível editar nem apagar este histórico por aqui.
      </PageHead>
      <Logs />
      <TentativasLogin />
    </div>
  );
}

function Logs() {
  const listar = useServerFn(listarAuditoria);
  const [rows, setRows] = useState<LogRow[] | null>(null);
  const [mascarado, setMascarado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const r = await listar();
        setRows(r.linhas);
        setMascarado(r.mascarado);
      } catch (e) {
        setErro(e instanceof Error ? e.message : String(e));
        setRows([]);
      }
    })();
  }, [listar]);

  const linhas = useMemo(
    () =>
      (rows ?? []).map((r) => ({
        ...r,
        acaoTexto: r.acao.replace(/_/g, " "),
        referencia: [r.entidade, r.entidade_id].filter(Boolean).join(" · "),
        detalhe: detalheTexto(r.detalhes),
      })),
    [rows],
  );

  const termo = busca.trim().toLocaleLowerCase("pt-BR");
  const filtradas = termo
    ? linhas.filter((l) =>
        [l.usuario_nome ?? "", l.acaoTexto, l.referencia, l.detalhe, l.ip ?? ""]
          .join(" ")
          .toLocaleLowerCase("pt-BR")
          .includes(termo),
      )
    : linhas;

  return (
    <Panel title="Ações no portal">
      {mascarado && <AvisoMascara />}
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-[360px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por usuário, ação, IP ou detalhe..."
            className="pl-8"
          />
        </div>
        {rows && (
          <p className="text-xs text-muted-foreground">
            {termo ? `${filtradas.length} de ${linhas.length}` : linhas.length} registro(s)
          </p>
        )}
      </div>

      {erro && (
        <div className="mb-3 rounded-lg border border-primary bg-primary-soft px-3 py-2 text-[12.5px] text-primary-dark">
          Não foi possível carregar o histórico: {erro}
        </div>
      )}

      {rows === null ? (
        <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
        </div>
      ) : filtradas.length === 0 ? (
        <p className="py-9 text-center text-[13px] text-dimmer">
          {termo ? "Nenhum registro encontrado para essa busca." : "Nenhum registro ainda."}
        </p>
      ) : (
        <div className="max-h-[620px] overflow-auto rounded-[10px] border">
          <Table>
            <TableHeader className="sticky top-0 z-10">
              <TableRow>
                <TableHead>Data/Hora</TableHead>
                <TableHead>Usuário</TableHead>
                <TableHead>Ação</TableHead>
                <TableHead>Referência</TableHead>
                <TableHead>IP</TableHead>
                <TableHead>Detalhe</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtradas.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="whitespace-nowrap font-mono text-xs">
                    {new Date(l.created_at).toLocaleString("pt-BR")}
                  </TableCell>
                  <TableCell className="text-[12.5px]">{l.usuario_nome ?? "—"}</TableCell>
                  <TableCell className="text-[12.5px] font-semibold">{l.acaoTexto}</TableCell>
                  <TableCell className="text-[12.5px] text-muted-foreground">{l.referencia}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{l.ip ?? "—"}</TableCell>
                  <TableCell className="max-w-[420px] text-[12.5px] text-muted-foreground">{l.detalhe}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Panel>
  );
}

const RESULTADO_LABEL: Record<string, { texto: string; tom?: "info" | "warning" | "success" }> = {
  ok: { texto: "entrou", tom: "success" },
  credencial_invalida: { texto: "senha incorreta", tom: "warning" },
  bloqueado: { texto: "bloqueado", tom: "warning" },
  conta_inativa: { texto: "conta inativa", tom: "warning" },
};

function TentativasLogin() {
  const listar = useServerFn(listarTentativasLogin);
  const [rows, setRows] = useState<TentativaLogin[] | null>(null);
  const [mascarado, setMascarado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const r = await listar();
        setRows(r.linhas);
        setMascarado(r.mascarado);
      } catch (e) {
        setErro(e instanceof Error ? e.message : String(e));
        setRows([]);
      }
    })();
  }, [listar]);

  const termo = busca.trim().toLocaleLowerCase("pt-BR");
  const filtradas = termo
    ? (rows ?? []).filter((r) =>
        [r.email_norm ?? "", r.ip ?? "", r.resultado, r.origem].join(" ").toLocaleLowerCase("pt-BR").includes(termo),
      )
    : (rows ?? []);

  return (
    <Panel
      title="Tentativas de login"
      sub="Entradas, senhas incorretas e bloqueios por excesso de tentativas (por conta e por IP). Últimos 1.000 registros."
    >
      {mascarado && <AvisoMascara />}
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-[360px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por e-mail, IP ou resultado..." className="pl-8" />
        </div>
        {rows && (
          <p className="text-xs text-muted-foreground">
            {termo ? `${filtradas.length} de ${rows.length}` : rows.length} registro(s)
          </p>
        )}
      </div>

      {erro && (
        <div className="mb-3 rounded-lg border border-primary bg-primary-soft px-3 py-2 text-[12.5px] text-primary-dark">
          {erro}
        </div>
      )}

      {rows === null ? (
        <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
        </div>
      ) : filtradas.length === 0 ? (
        <p className="py-9 text-center text-[13px] text-dimmer">Nenhuma tentativa registrada ainda.</p>
      ) : (
        <div className="max-h-[420px] overflow-auto rounded-[10px] border">
          <Table>
            <TableHeader className="sticky top-0 z-10">
              <TableRow>
                <TableHead>Data/Hora</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>IP</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Resultado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtradas.map((r) => {
                const rl = RESULTADO_LABEL[r.resultado] ?? { texto: r.resultado };
                return (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap font-mono text-xs">{new Date(r.created_at).toLocaleString("pt-BR")}</TableCell>
                    <TableCell className="text-[12.5px]">{r.email_norm ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{r.ip ?? "—"}</TableCell>
                    <TableCell className="text-[12.5px] text-muted-foreground">{r.origem === "troca_senha" ? "troca de senha" : "login"}</TableCell>
                    <TableCell>
                      <Selo tom={rl.tom}>{rl.texto}</Selo>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </Panel>
  );
}
