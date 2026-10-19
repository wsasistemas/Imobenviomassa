import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Building2, Copy, Globe, Loader2, Mail, MessageCircle, Send, Users } from "lucide-react";
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
import { IconeIlustrativo } from "@/components/icones/icone-colorido";
import { Aviso } from "@/components/regua/ui";
import {
  cadastrarDominioResend,
  enviarEmailTeste,
  salvarConfigEmail,
  salvarCredencialEmail,
  statusEmail,
  testarCredencialEmail,
  verificarDominioResend,
  type TipoProvedorEmail,
} from "@/lib/integracoes/email.functions";
import { dataHoraBr } from "@/lib/regua/comum";
import { cn } from "@/lib/utils";

const PROVEDORES: { id: TipoProvedorEmail; nome: string; texto: string; icon: typeof Mail }[] = [
  {
    id: "zenvia",
    nome: "Zenvia E-mail",
    texto: "Usa o mesmo token da Zenvia. Domínio configurado na conta Zenvia.",
    icon: MessageCircle,
  },
  {
    id: "resend",
    nome: "Resend",
    texto: "API key no Vault. Domínio do cliente cadastrado e verificado por aqui.",
    icon: Send,
  },
  {
    id: "smtp",
    nome: "SMTP próprio",
    texto: "Host, porta, usuário e senha no Vault.",
    icon: Building2,
  },
];

const tomDominio = (s: string | null) =>
  s === "verified" ? "success" : s === "failed" ? "danger" : s ? "warning" : undefined;

function Cabecalho({
  icon,
  titulo,
  sub,
  selo,
}: {
  icon: typeof Mail;
  titulo: string;
  sub: React.ReactNode;
  selo?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3.5">
      <div className="grid h-[46px] w-[46px] shrink-0 place-items-center rounded-xl bg-secondary">
        <IconeIlustrativo icon={icon} size={28} />
      </div>
      <div className="min-w-0">
        <h2 className="text-[16px] font-bold">{titulo}</h2>
        <p className="text-[12.5px] text-muted-foreground">{sub}</p>
      </div>
      {selo && <div className="ml-auto">{selo}</div>}
    </div>
  );
}

export function EmailPainel() {
  const qc = useQueryClient();
  const carregar = useServerFn(statusEmail);
  const salvarCfg = useServerFn(salvarConfigEmail);
  const salvarCred = useServerFn(salvarCredencialEmail);
  const testarCred = useServerFn(testarCredencialEmail);
  const cadastrar = useServerFn(cadastrarDominioResend);
  const verificar = useServerFn(verificarDominioResend);
  const testar = useServerFn(enviarEmailTeste);
  const {
    data: st,
    isLoading,
    error,
  } = useQuery({ queryKey: ["email-status"], queryFn: () => carregar() });

  const [tipo, setTipo] = useState<TipoProvedorEmail>("resend");
  const [ativo, setAtivo] = useState(false);
  const [smtp, setSmtp] = useState({ host: "", porta: "587", usuario: "", seguro: false });
  const [rem, setRem] = useState({ nome: "", email: "", replyTo: "" });
  const [cred, setCred] = useState<string | null>(null);
  const [dominio, setDominio] = useState("");
  const [para, setPara] = useState("");
  const [ocupado, setOcupado] = useState<string | null>(null);

  useEffect(() => {
    if (!st) return;
    setTipo(st.tipo);
    setAtivo(st.ativo);
    setSmtp({
      host: st.smtp.host ?? "",
      porta: String(st.smtp.porta ?? 587),
      usuario: st.smtp.usuario ?? "",
      seguro: st.smtp.seguro,
    });
    setRem({
      nome: st.remetente.nome ?? "",
      email: st.remetente.email ?? "",
      replyTo: st.remetente.replyTo ?? "",
    });
    setDominio(st.dominio ?? "");
  }, [st]);

  const recarregar = () => qc.invalidateQueries({ queryKey: ["email-status"] });
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
        {error instanceof Error ? error.message : "Não foi possível carregar o e-mail."}
      </Aviso>
    );

  const mudouTipo = tipo !== st.tipo;
  const salvar = () =>
    acao(
      "salvar",
      () =>
        salvarCfg({
          data: {
            tipo,
            ativo,
            smtpHost: tipo === "smtp" ? smtp.host || null : (st.smtp.host ?? null),
            smtpPorta: tipo === "smtp" ? Number(smtp.porta) || null : (st.smtp.porta ?? null),
            smtpUsuario: tipo === "smtp" ? smtp.usuario || null : (st.smtp.usuario ?? null),
            smtpSeguro: smtp.seguro,
            remetenteNome: rem.nome || null,
            remetenteEmail: rem.email || null,
            replyTo: rem.replyTo || null,
          },
        }),
      () => "Configuração de e-mail salva.",
    );

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-3.5 rounded-xl border bg-card px-5 py-4 shadow-card">
        <Cabecalho
          icon={Mail}
          titulo="Provedor de e-mail"
          sub="Um provedor ativo por imobiliária."
          selo={
            <label className="flex items-center gap-2 text-[13px] font-semibold">
              <Switch checked={ativo} onCheckedChange={setAtivo} /> {ativo ? "Ativo" : "Desativado"}
            </label>
          }
        />
        <div className="grid gap-3 md:grid-cols-3">
          {PROVEDORES.map((p) => (
            <button
              type="button"
              key={p.id}
              onClick={() => setTipo(p.id)}
              className={cn(
                "flex gap-3 rounded-[13px] border-[1.5px] bg-card p-4 text-left",
                tipo === p.id
                  ? "border-primary bg-primary-soft"
                  : "border-border hover:border-border-strong",
              )}
            >
              <IconeIlustrativo icon={p.icon} size={30} />
              <div>
                <b className="block text-[14px]">{p.nome}</b>
                <p className="text-[12px] text-muted-foreground">{p.texto}</p>
                {st.tipo === p.id && st.ativo && (
                  <span className="mt-1.5 inline-block">
                    <Selo tom="success">Ativo</Selo>
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>

        {tipo === "smtp" && (
          <div className="grid gap-3 md:grid-cols-4">
            <div className="flex flex-col gap-1.5 md:col-span-2">
              <label className="text-[12.5px] font-semibold">Host</label>
              <Input
                value={smtp.host}
                onChange={(e) => setSmtp({ ...smtp, host: e.target.value.trim() })}
                placeholder="smtp.seudominio.com.br"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[12.5px] font-semibold">Porta</label>
              <Input
                value={smtp.porta}
                onChange={(e) => setSmtp({ ...smtp, porta: e.target.value.replace(/\D/g, "") })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[12.5px] font-semibold">Conexão segura (TLS direto)</label>
              <div className="flex h-9 items-center">
                <Switch
                  checked={smtp.seguro}
                  onCheckedChange={(v) => setSmtp({ ...smtp, seguro: v })}
                />
                <span className="ml-2 text-[12px] text-muted-foreground">porta 465</span>
              </div>
            </div>
            <div className="flex flex-col gap-1.5 md:col-span-2">
              <label className="text-[12.5px] font-semibold">Usuário</label>
              <Input
                value={smtp.usuario}
                onChange={(e) => setSmtp({ ...smtp, usuario: e.target.value })}
                autoComplete="off"
              />
            </div>
          </div>
        )}

        {tipo !== "zenvia" ? (
          <div className="grid gap-3 md:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-[12.5px] font-semibold">
                {tipo === "resend" ? "API key do Resend" : "Senha do SMTP"}
              </label>
              {cred === null ? (
                <div className="flex gap-2">
                  <Input
                    value={st.credencialConfigurada && !mudouTipo ? "••••••••••••••••" : ""}
                    placeholder="Não cadastrada"
                    disabled
                    className="font-mono tracking-widest"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!st.podeTrocarCredencial || mudouTipo}
                    onClick={() => setCred("")}
                  >
                    {st.credencialConfigurada ? "Substituir" : "Cadastrar"}
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    type="password"
                    value={cred}
                    onChange={(e) => setCred(e.target.value)}
                    autoComplete="new-password"
                    className="font-mono"
                  />
                  <Button
                    size="sm"
                    disabled={cred.length < 4 || ocupado === "cred"}
                    onClick={() =>
                      acao(
                        "cred",
                        () =>
                          salvarCred({ data: { tipo: tipo as "resend" | "smtp", valor: cred } }),
                        () => {
                          setCred(null);
                          return "Credencial guardada no Vault.";
                        },
                      )
                    }
                  >
                    {ocupado === "cred" && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                    Salvar
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setCred(null)}>
                    Cancelar
                  </Button>
                </div>
              )}
              <small className="text-[11.5px] text-muted-foreground">
                {mudouTipo
                  ? "Salve a troca de provedor antes de cadastrar a credencial."
                  : "Guardada no Vault; nunca volta para o navegador. Só o Super Admin troca."}
              </small>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[12.5px] font-semibold">Status da credencial</label>
              <div className="flex items-center gap-2">
                {st.credencialTestadaEm && !mudouTipo ? (
                  <Selo tom="success">
                    Válida · testada em {dataHoraBr(st.credencialTestadaEm)}
                  </Selo>
                ) : (
                  <Selo>Não testada</Selo>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!st.credencialConfigurada || mudouTipo || !!ocupado}
                  onClick={() =>
                    acao(
                      "testar-cred",
                      () => testarCred(),
                      (r) =>
                        (r as { ok: boolean; erro: string | null }).ok
                          ? "Credencial válida."
                          : `Falhou: ${(r as { erro: string }).erro}`,
                    )
                  }
                >
                  Testar
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <Aviso>
            O Zenvia E-mail usa o token cadastrado na aba Zenvia WhatsApp. O remetente precisa estar
            liberado na conta Zenvia.
          </Aviso>
        )}
        <div className="flex items-center gap-2.5 border-t pt-3.5">
          <span className="text-[12px] text-muted-foreground">
            {st.atualizadoPor
              ? `Salvo em ${dataHoraBr(st.atualizadoEm)} por ${st.atualizadoPor} · alterações gravadas na Auditoria`
              : "Ainda não configurado"}
          </span>
          <Button className="ml-auto" size="sm" disabled={!!ocupado} onClick={salvar}>
            {ocupado === "salvar" && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}Salvar
            provedor e remetente
          </Button>
        </div>
      </section>

      {tipo === "resend" && !mudouTipo && (
        <section className="flex flex-col gap-3.5 rounded-xl border bg-card px-5 py-4 shadow-card">
          <Cabecalho
            icon={Globe}
            titulo="Domínio remetente"
            sub={
              <>
                Sem <b>verified</b>, a régua não envia e-mail por este domínio.
              </>
            }
            selo={
              st.statusDominio ? (
                <Selo tom={tomDominio(st.statusDominio)}>{st.statusDominio}</Selo>
              ) : (
                <Selo>não cadastrado</Selo>
              )
            }
          />
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={dominio}
              onChange={(e) => setDominio(e.target.value.trim().toLowerCase())}
              placeholder="imobsystems.com.br"
              className="max-w-[320px]"
            />
            <Button
              variant="outline"
              size="sm"
              disabled={!dominio || !st.credencialConfigurada || !!ocupado}
              onClick={() =>
                acao(
                  "dominio",
                  () => cadastrar({ data: { dominio } }),
                  (r) => `Domínio cadastrado (${(r as { status: string }).status}).`,
                )
              }
            >
              {ocupado === "dominio" && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Cadastrar domínio
            </Button>
            <Button
              size="sm"
              disabled={!st.dominioId || !!ocupado}
              onClick={() =>
                acao(
                  "verificar",
                  () => verificar(),
                  (r) => {
                    const x = r as { status: string; pediuVerificacao: boolean };
                    return x.status === "verified"
                      ? "Domínio verificado."
                      : x.pediuVerificacao
                        ? `O Resend está conferindo o DNS (${x.status}). Clique de novo em alguns minutos.`
                        : `Status do domínio: ${x.status}.`;
                  },
                )
              }
            >
              {ocupado === "verificar" && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Verificar DNS
            </Button>
            {st.dominioVerificadoEm && (
              <span className="text-[12px] text-muted-foreground">
                Verificado em {dataHoraBr(st.dominioVerificadoEm)}
              </span>
            )}
          </div>
          {st.registrosDns.length > 0 && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Nome (host)</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Prioridade</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {st.registrosDns.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="whitespace-nowrap">
                        <b>{r.type}</b>{" "}
                        {r.record && <span className="text-muted-foreground">({r.record})</span>}
                      </TableCell>
                      <TableCell className="font-mono text-[11.5px]">{r.name}</TableCell>
                      <TableCell className="max-w-[420px] break-all font-mono text-[11.5px]">
                        {r.value}
                      </TableCell>
                      <TableCell>{r.priority ?? "—"}</TableCell>
                      <TableCell>
                        {r.status ? <Selo tom={tomDominio(r.status)}>{r.status}</Selo> : "—"}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            navigator.clipboard
                              .writeText(r.value)
                              .then(() => toast.success("Valor copiado."))
                          }
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <p className="rounded-lg bg-secondary px-2.5 py-2 text-[11.5px] text-muted-foreground">
            Crie os registros no DNS do domínio (para imobsystems.com.br, o DNS fica na Vercel) e
            clique em <b>Verificar DNS</b>. Se aparecer pending, o Resend ainda está conferindo:
            espere alguns minutos e clique de novo. Status possíveis: not_started, pending,
            verified, failed, temporary_failure.
          </p>
        </section>
      )}

      <section className="flex flex-col gap-3.5 rounded-xl border bg-card px-5 py-4 shadow-card">
        <Cabecalho
          icon={Users}
          titulo="Remetente"
          sub="Como o cliente vê o e-mail. Salve com o botão “Salvar provedor e remetente”."
        />
        <div className="grid gap-3 md:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-[12.5px] font-semibold">Nome</label>
            <Input
              value={rem.nome}
              onChange={(e) => setRem({ ...rem, nome: e.target.value })}
              placeholder="Financeiro ImobSystems"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[12.5px] font-semibold">E-mail</label>
            <Input
              value={rem.email}
              onChange={(e) => setRem({ ...rem, email: e.target.value.trim() })}
              placeholder={`cobranca@${st.dominio ?? "seudominio.com.br"}`}
            />
            {tipo === "resend" && (
              <small className="text-[11.5px] text-muted-foreground">
                Precisa ser do domínio verificado.
              </small>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[12.5px] font-semibold">Responder para</label>
            <Input
              value={rem.replyTo}
              onChange={(e) => setRem({ ...rem, replyTo: e.target.value.trim() })}
              placeholder="financeiro@seudominio.com.br"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[12.5px] font-semibold">Enviar teste para</label>
            <div className="flex gap-2">
              <Input
                value={para}
                onChange={(e) => setPara(e.target.value.trim())}
                placeholder="voce@email.com"
              />
              <Button
                variant="outline"
                size="sm"
                disabled={!para || !!ocupado}
                onClick={() =>
                  acao(
                    "teste",
                    () => testar({ data: { para } }),
                    () => "E-mail de teste enviado.",
                  )
                }
              >
                {ocupado === "teste" && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                Enviar e-mail de teste
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
