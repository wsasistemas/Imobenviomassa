import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Copy,
  KeyRound,
  Link2,
  Loader2,
  MessageCircle,
  RefreshCw,
  Smartphone,
  ListChecks,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Selo } from "@/components/page";
import { IconeIlustrativo } from "@/components/icones/icone-hig";
import { Aviso } from "@/components/regua/ui";
import {
  criarAssinaturasZenvia,
  salvarRemetenteZenvia,
  salvarTokenZenvia,
  sincronizarTemplatesZenvia,
  statusZenvia,
  testarZenvia,
  type RemetenteZenvia,
} from "@/lib/integracoes/zenvia.functions";
import { dataHoraBr, rotuloStatusZenvia } from "@/lib/regua/comum";
import { cn } from "@/lib/utils";

function Bloco({
  icon,
  titulo,
  sub,
  selo,
  children,
}: {
  icon: typeof KeyRound;
  titulo: string;
  sub: string;
  selo?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3.5 rounded-xl border bg-card px-5 py-4 shadow-card">
      <div className="flex items-center gap-3.5">
        <IconeIlustrativo icon={icon} size={46} />
        <div className="min-w-0">
          <h2 className="text-[16px] font-bold">{titulo}</h2>
          <p className="text-[12.5px] text-muted-foreground">{sub}</p>
        </div>
        {selo && <div className="ml-auto">{selo}</div>}
      </div>
      {children}
    </section>
  );
}

const tomStatusZenvia = (s: string) =>
  s === "APPROVED"
    ? "success"
    : s === "REJECTED" || s === "REMOVIDO" || s === "DISABLED"
      ? "danger"
      : s === "PAUSED"
        ? undefined
        : "warning";

export function ZenviaPainel() {
  const qc = useQueryClient();
  const carregar = useServerFn(statusZenvia);
  const salvarToken = useServerFn(salvarTokenZenvia);
  const testar = useServerFn(testarZenvia);
  const assinar = useServerFn(criarAssinaturasZenvia);
  const sincronizar = useServerFn(sincronizarTemplatesZenvia);
  const salvarRem = useServerFn(salvarRemetenteZenvia);
  const {
    data: st,
    isLoading,
    error,
  } = useQuery({ queryKey: ["zenvia-status"], queryFn: () => carregar() });
  const [token, setToken] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<"todos" | "APPROVED" | "pendentes" | "REJECTED">("todos");

  const recarregar = () => qc.invalidateQueries({ queryKey: ["zenvia-status"] });
  async function acao(nome: string, fn: () => Promise<unknown>, okMsg: (r: unknown) => string) {
    setOcupado(nome);
    try {
      const r = await fn();
      toast.success(okMsg(r));
      await recarregar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível concluir.");
    } finally {
      setOcupado(null);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
      </div>
    );
  }
  if (error || !st)
    return (
      <Aviso tom="danger">
        {error instanceof Error ? error.message : "Não foi possível carregar a Zenvia."}
      </Aviso>
    );

  const templates = st.templates.filter((t) =>
    filtro === "todos"
      ? true
      : filtro === "pendentes"
        ? ["WAITING_REVIEW", "WAITING_APPROVAL"].includes(t.status)
        : t.status === filtro,
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Bloco
          icon={KeyRound}
          titulo="Conta"
          sub="Um token para todos os números da conta Zenvia."
          selo={
            <Selo
              tom={
                st.statusConexao === "conectado"
                  ? "success"
                  : st.statusConexao === "erro"
                    ? "danger"
                    : undefined
              }
            >
              {st.statusConexao === "conectado"
                ? "Conectado"
                : st.statusConexao === "erro"
                  ? "Erro"
                  : "Não configurado"}
            </Selo>
          }
        >
          <div className="flex flex-col gap-1.5">
            <label className="text-[12.5px] font-semibold">Token da API (X-API-TOKEN)</label>
            {token === null ? (
              <div className="flex gap-2">
                <Input
                  value={st.configurado ? "••••••••••••••••••••••" : ""}
                  placeholder="Nenhum token cadastrado"
                  disabled
                  className="font-mono tracking-widest"
                />
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!st.podeTrocarToken}
                  onClick={() => setToken("")}
                >
                  {st.configurado ? "Substituir" : "Cadastrar"}
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Cole o token da Zenvia"
                  autoComplete="off"
                  className="font-mono"
                />
                <Button
                  size="sm"
                  disabled={!token.trim() || ocupado === "token"}
                  onClick={() =>
                    acao(
                      "token",
                      () => salvarToken({ data: { token: token.trim() } }),
                      () => {
                        setToken(null);
                        return "Token guardado no Vault.";
                      },
                    )
                  }
                >
                  {ocupado === "token" && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                  Salvar
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setToken(null)}>
                  Cancelar
                </Button>
              </div>
            )}
            <small className="text-[11.5px] text-muted-foreground">
              Guardado no Vault. Nunca volta para o navegador.{" "}
              {st.podeTrocarToken ? "" : "Só o Super Admin troca o token."}
            </small>
          </div>
          {st.testadoEm &&
            (st.resumo.erro ? (
              <Aviso tom="danger">
                <b>Teste de {dataHoraBr(st.testadoEm)} falhou.</b> {st.resumo.erro}
              </Aviso>
            ) : (
              <Aviso tom="success">
                <b>Testado em {dataHoraBr(st.testadoEm)}.</b> {st.resumo.numeros ?? 0} números e{" "}
                {st.resumo.templates ?? 0} templates na conta deste token.
              </Aviso>
            ))}
          <div className="flex items-center gap-2.5 border-t pt-3.5">
            <span className="text-[12px] text-muted-foreground">
              {st.atualizadoPor
                ? `Salvo em ${dataHoraBr(st.atualizadoEm)} por ${st.atualizadoPor}`
                : "Ainda não configurado"}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="ml-auto"
              disabled={!st.configurado || !!ocupado}
              onClick={() =>
                acao(
                  "testar",
                  () => testar(),
                  (r) =>
                    (r as { ok: boolean; erro?: string }).ok
                      ? "Conexão testada."
                      : `Falhou: ${(r as { erro?: string }).erro}`,
                )
              }
            >
              {ocupado === "testar" && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Testar conexão e números
            </Button>
          </div>
        </Bloco>

        <Bloco
          icon={Link2}
          titulo="Webhooks"
          sub="Uma assinatura para mensagens e uma para status de entrega."
          selo={
            <Selo tom={st.webhook.assinaturas.length >= 2 ? "success" : "warning"}>
              {st.webhook.assinaturas.length >= 2 ? "2 ativas" : "Não criadas"}
            </Selo>
          }
        >
          <div className="flex flex-col gap-1.5">
            <label className="text-[12.5px] font-semibold">Endereço</label>
            <div className="flex items-center gap-2">
              <Input readOnly value={st.webhook.url} className="font-mono text-[11.5px]" />
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  navigator.clipboard
                    .writeText(st.webhook.url)
                    .then(() => toast.success("Endereço copiado."))
                }
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Evento</TableHead>
                <TableHead>ID Zenvia</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(["MESSAGE", "MESSAGE_STATUS"] as const).map((ev) => {
                const a = st.webhook.assinaturas.find((x) => x.evento === ev);
                return (
                  <TableRow key={ev}>
                    <TableCell>
                      {ev === "MESSAGE" ? "MESSAGE (recebidas)" : "MESSAGE_STATUS (entrega)"}
                    </TableCell>
                    <TableCell className="font-mono text-[11.5px]">
                      {a ? `${a.id.slice(0, 8)}…` : "—"}
                    </TableCell>
                    <TableCell>
                      {a ? <Selo tom="success">Ativa</Selo> : <Selo>Não criada</Selo>}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <p className="rounded-lg bg-secondary px-2.5 py-2 text-[11.5px] text-muted-foreground">
            Sem a assinatura de status, a régua não sabe se a mensagem foi entregue ou recusada. A
            chave do webhook fica no Vault e é conferida a cada chamada.
          </p>
          <div className="flex border-t pt-3.5">
            <Button
              variant="outline"
              size="sm"
              className="ml-auto"
              disabled={!st.configurado || !!ocupado}
              onClick={() =>
                acao(
                  "assinar",
                  () => assinar(),
                  () => "Assinaturas criadas na Zenvia.",
                )
              }
            >
              {ocupado === "assinar" && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              {st.webhook.assinaturas.length ? "Recriar assinaturas" : "Criar assinaturas"}
            </Button>
          </div>
        </Bloco>
      </div>

      <Bloco
        icon={Smartphone}
        titulo="Números remetentes"
        sub="Números da conta, encontrados no teste. Marque o padrão da régua."
      >
        {st.remetentes.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">
            Nenhum número ainda. Cadastre o token e clique em “Testar conexão e números”.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Setor</TableHead>
                <TableHead>Na conta do token</TableHead>
                <TableHead>Ativo</TableHead>
                <TableHead>Padrão da régua</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {st.remetentes.map((r) => (
                <LinhaRemetente
                  key={r.id}
                  r={r}
                  onSalvar={(m) =>
                    acao(
                      `rem-${r.id}`,
                      () => salvarRem({ data: { id: r.id, ...m } }),
                      () => "Número atualizado.",
                    )
                  }
                />
              ))}
            </TableBody>
          </Table>
        )}
      </Bloco>

      <Bloco
        icon={ListChecks}
        titulo="Templates de WhatsApp"
        sub="Lidos da conta pela API v2 da Zenvia e gravados para uso na Régua de Cobrança."
        selo={
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex overflow-hidden rounded-[9px] border">
              {(
                [
                  ["todos", "Todos"],
                  ["APPROVED", "Aprovados"],
                  ["pendentes", "Em análise"],
                  ["REJECTED", "Rejeitados"],
                ] as const
              ).map(([id, rot]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setFiltro(id)}
                  className={cn(
                    "px-3 py-1.5 text-[12.5px] font-semibold",
                    filtro === id ? "bg-foreground text-white" : "text-muted-foreground",
                  )}
                >
                  {rot}
                </button>
              ))}
            </div>
            <Button
              size="sm"
              disabled={!st.configurado || !!ocupado}
              onClick={() =>
                acao(
                  "sync",
                  () => sincronizar(),
                  (r) => `${(r as { total: number }).total} templates sincronizados.`,
                )
              }
            >
              {ocupado === "sync" ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              )}
              Sincronizar templates
            </Button>
          </div>
        }
      >
        {templates.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">
            {st.templates.length
              ? "Nenhum template neste filtro."
              : "Nenhum template sincronizado. A régua só envia WhatsApp por template Aprovado na Zenvia."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Idioma</TableHead>
                  <TableHead>Cabeçalho</TableHead>
                  <TableHead>Variáveis</TableHead>
                  <TableHead>Remetente</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Uso</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-semibold">{t.nome}</TableCell>
                    <TableCell>{t.categoria ?? "—"}</TableCell>
                    <TableCell>{t.idioma ?? "—"}</TableCell>
                    <TableCell>
                      {t.headerTipo === "MEDIA_DOCUMENT"
                        ? "Documento"
                        : t.headerTipo === "MEDIA_IMAGE"
                          ? "Imagem"
                          : t.headerTipo
                            ? "Texto"
                            : "—"}
                    </TableCell>
                    <TableCell className="font-mono text-[11.5px]">
                      {t.variaveis.length ? t.variaveis.map((v) => `{{${v}}}`).join(" ") : "—"}
                    </TableCell>
                    <TableCell className="font-mono text-[11.5px]">
                      {t.senderId ? `…${t.senderId.slice(-4)}` : "—"}
                    </TableCell>
                    <TableCell>
                      <Selo
                        tom={
                          tomStatusZenvia(t.status) as "success" | "danger" | "warning" | undefined
                        }
                      >
                        {t.status === "REMOVIDO" ? "Removido" : rotuloStatusZenvia(t.status)}
                      </Selo>
                    </TableCell>
                    <TableCell>
                      {t.uso.length ? <Selo tom="info">{t.uso.join(", ")}</Selo> : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {st.templates.length > 0 && (
          <p className="text-[12px] text-muted-foreground">
            Última sincronização:{" "}
            {dataHoraBr(
              st.templates
                .map((t) => t.sincronizadoEm)
                .sort()
                .at(-1),
            )}{" "}
            · {st.templates.length} templates · {st.templates.filter((t) => t.uso.length).length} em
            uso
          </p>
        )}
      </Bloco>
      <p className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
        <MessageCircle className="h-3.5 w-3.5" /> Envio só por template aprovado (regra do WhatsApp
        oficial). Respostas dos clientes ficam registradas; atendimento pelo WhatsApp é a fase 2.
      </p>
    </div>
  );
}

function LinhaRemetente({
  r,
  onSalvar,
}: {
  r: RemetenteZenvia;
  onSalvar: (m: {
    nome?: string | null;
    setor?: string | null;
    status?: "ativo" | "inativo";
    padraoRegua?: boolean;
  }) => void;
}) {
  const [nome, setNome] = useState(r.nome ?? "");
  const [setor, setSetor] = useState(r.setor ?? "");
  const mudou = nome !== (r.nome ?? "") || setor !== (r.setor ?? "");
  return (
    <TableRow>
      <TableCell className="font-mono text-[12px]">{r.numero}</TableCell>
      <TableCell>
        <Input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Ex.: Financeiro"
          className="h-8 min-w-[140px]"
        />
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1.5">
          <Input
            value={setor}
            onChange={(e) => setSetor(e.target.value)}
            placeholder="Texto livre"
            className="h-8 min-w-[120px]"
          />
          {mudou && (
            <Button
              size="sm"
              variant="outline"
              className="h-8"
              onClick={() => onSalvar({ nome: nome || null, setor: setor || null })}
            >
              Salvar
            </Button>
          )}
        </div>
      </TableCell>
      <TableCell>
        {r.naConta ? <Selo tom="success">Sim</Selo> : <Selo tom="warning">Sem template</Selo>}
      </TableCell>
      <TableCell>
        <Switch
          checked={r.status === "ativo"}
          onCheckedChange={(v) => onSalvar({ status: v ? "ativo" : "inativo" })}
        />
      </TableCell>
      <TableCell>
        <Switch
          checked={r.padraoRegua}
          disabled={r.status !== "ativo"}
          onCheckedChange={(v) => onSalvar({ padraoRegua: v })}
        />
      </TableCell>
    </TableRow>
  );
}
