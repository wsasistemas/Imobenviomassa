import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Mail, MessageCircle, Plus, Send, Trash2 } from "lucide-react";
import { PageHead, Selo, SemAcesso } from "@/components/page";
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
import { Aviso, PreviaEmail, PreviaWhatsapp, SeloRegua, Vazio } from "@/components/regua/ui";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  bibliotecaTemplates,
  enviarTesteTemplate,
  excluirTemplateRegua,
  salvarTemplateRegua,
  type TemplateRegua,
} from "@/lib/regua/regua.functions";
import {
  CAMPOS_BOLETO,
  ROTULO_REGUA,
  dadosDaMensagem,
  dataHoraBr,
  montarWhatsapp,
  preencher,
  rotuloStatusZenvia,
  variaveisDe,
  ehCampoBoleto,
  type Canal,
  type ReguaSugerida,
} from "@/lib/regua/comum";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/regua-cobranca/templates")({
  component: TemplatesPage,
});

const EXEMPLO = dadosDaMensagem({
  cliente_nome: "Mariana Costa",
  empreendimento: "Residencial Vista Mar",
  unidade: "Bl A 302",
  numero: "000184522",
  vencimento: "2026-08-20",
  dias_atraso: 59,
  valor: 2847.3,
  linha_digitavel: "34191.09008 01845.221092 00000.000000 1 00000000284730",
  link: "https://link-seguro-do-boleto",
  dica: "A senha são os 5 primeiros dígitos do seu CPF ou CNPJ.",
});

const CORPO_PADRAO = `Prezado(a) {{nome}},

Até hoje não identificamos o pagamento do boleto da unidade {{unidade}} do {{empreendimento}}, vencido em {{vencimento}}, no valor de {{valor}}.

Linha digitável: {{linha_digitavel}}
Baixar o boleto: {{link_boleto}}

O PDF está protegido. {{dica_senha}}
Se já pagou, desconsidere esta mensagem.`;

type Rascunho = {
  id?: string;
  nome: string;
  canal: Canal;
  reguaSugerida: ReguaSugerida | null;
  ativo: boolean;
  whatsappTemplateId: string | null;
  remetenteId: string | null;
  mapaVariaveis: Record<string, string>;
  usaDocumento: boolean;
  assunto: string;
  corpo: string;
  anexoTipo: "pdf_link" | "link";
};

const novo = (canal: Canal, remetentePadrao: string | null): Rascunho => ({
  nome: "",
  canal,
  reguaSugerida: null,
  ativo: true,
  whatsappTemplateId: null,
  remetenteId: remetentePadrao,
  mapaVariaveis: {},
  usaDocumento: true,
  assunto: canal === "email" ? "Boleto em atraso · {{empreendimento}} {{unidade}}" : "",
  corpo: canal === "email" ? CORPO_PADRAO : "",
  anexoTipo: "pdf_link",
});

const deTemplate = (t: TemplateRegua): Rascunho => ({
  id: t.id,
  nome: t.nome,
  canal: t.canal,
  reguaSugerida: t.reguaSugerida,
  ativo: t.ativo,
  whatsappTemplateId: t.whatsappTemplateId,
  remetenteId: t.remetenteId,
  mapaVariaveis: t.mapaVariaveis,
  usaDocumento: t.usaDocumento,
  assunto: t.assunto ?? "",
  corpo: t.corpo ?? "",
  anexoTipo: t.anexoTipo,
});

/** Sugere o campo do boleto pelo nome da variável da Zenvia ({{nome}} → Nome do cliente…). */
function sugerirCampo(v: string): string {
  const n = v.toLowerCase();
  if (ehCampoBoleto(n)) return n;
  if (/nome|cliente/.test(n)) return "nome";
  if (/empreend|obra/.test(n)) return "empreendimento";
  if (/unid|apto/.test(n)) return "unidade";
  if (/venc|data/.test(n)) return "vencimento";
  if (/atraso|dias/.test(n)) return "dias_atraso";
  if (/valor|total/.test(n)) return "valor";
  if (/linha|codigo|barra/.test(n)) return "linha_digitavel";
  if (/senha|dica/.test(n)) return "dica_senha";
  if (/link|url/.test(n)) return "link_boleto";
  if (/boleto|numero/.test(n)) return "numero_boleto";
  return "";
}

function TemplatesPage() {
  const { podeAcessar, loading } = useCurrentUser();
  const qc = useQueryClient();
  const carregar = useServerFn(bibliotecaTemplates);
  const salvar = useServerFn(salvarTemplateRegua);
  const excluir = useServerFn(excluirTemplateRegua);
  const testar = useServerFn(enviarTesteTemplate);
  const {
    data: b,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["regua-biblioteca"],
    queryFn: () => carregar(),
    enabled: !loading && podeAcessar("regua_templates"),
  });
  const [aba, setAba] = useState<Canal>("whatsapp");
  const [r, setR] = useState<Rascunho | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [para, setPara] = useState("");
  const [testando, setTestando] = useState(false);

  const remPadrao = b?.remetentes.find((x) => x.padrao)?.id ?? null;
  useEffect(() => {
    if (!b || r) return;
    const primeiro = b.templates.find((t) => t.canal === aba);
    setR(primeiro ? deTemplate(primeiro) : novo(aba, remPadrao));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [b]);

  const wa = useMemo(
    () => b?.whatsapp.find((w) => w.id === r?.whatsappTemplateId) ?? null,
    [b, r?.whatsappTemplateId],
  );

  if (loading) return null;
  if (!podeAcessar("regua_templates"))
    return <SemAcesso texto="Seu perfil não edita os templates da Régua de Cobrança." />;
  if (error)
    return (
      <Aviso tom="danger">
        {error instanceof Error ? error.message : "Não foi possível carregar os templates."}
      </Aviso>
    );
  if (isLoading || !b || !r) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
      </div>
    );
  }

  const set = (m: Partial<Rascunho>) => setR({ ...r, ...m });
  const faltando =
    r.canal === "whatsapp" && wa
      ? wa.variaveis.filter((v) => !ehCampoBoleto(r.mapaVariaveis[v] ?? ""))
      : [];
  const invalidas =
    r.canal === "email"
      ? [...variaveisDe(r.assunto), ...variaveisDe(r.corpo)].filter((v) => !ehCampoBoleto(v))
      : [];
  const previaWa = wa
    ? montarWhatsapp({ corpo: wa.corpo, variaveis: wa.variaveis }, r.mapaVariaveis, EXEMPLO)
    : null;

  async function gravar() {
    if (!r) return;
    setSalvando(true);
    try {
      const res = await salvar({
        data: {
          id: r.id,
          nome: r.nome,
          canal: r.canal,
          reguaSugerida: r.reguaSugerida,
          ativo: r.ativo,
          whatsappTemplateId: r.whatsappTemplateId,
          remetenteId: r.remetenteId,
          mapaVariaveis: r.mapaVariaveis,
          usaDocumento: r.usaDocumento,
          assunto: r.canal === "email" ? r.assunto : null,
          corpo: r.canal === "email" ? r.corpo : null,
          anexoTipo: r.anexoTipo,
        },
      });
      toast.success("Template salvo.");
      await qc.invalidateQueries({ queryKey: ["regua-biblioteca"] });
      setR({ ...r, id: res.id });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }

  async function enviarTeste() {
    if (!r?.id) return toast.error("Salve o template antes de testar.");
    setTestando(true);
    try {
      const res = await testar({ data: { id: r.id, para } });
      toast.success(res.aviso);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "O teste falhou.");
    } finally {
      setTestando(false);
    }
  }

  const lista = b.templates;
  return (
    <div className="flex flex-col gap-5">
      <PageHead title="Templates">
        Biblioteca de mensagens da régua. No Novo lote, o usuário escolhe um template de cada canal
        marcado.
      </PageHead>

      <section className="rounded-xl border bg-card px-5 py-4 shadow-card">
        <div className="mb-3 flex flex-wrap items-center gap-2.5">
          <h2 className="text-[16px] font-bold">Biblioteca de templates</h2>
          <span className="text-[12.5px] text-muted-foreground">
            Só os templates Prontos aparecem no Novo lote.
          </span>
          {b.podeEditar && (
            <div className="ml-auto flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => (setAba("whatsapp"), setR(novo("whatsapp", remPadrao)))}
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" /> WhatsApp
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => (setAba("email"), setR(novo("email", null)))}
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" /> E-mail
              </Button>
            </div>
          )}
        </div>
        {lista.length === 0 ? (
          <Vazio titulo="Nenhum template ainda">
            Crie um template de WhatsApp (precisa de template Aprovado na Zenvia) e um de e-mail.
          </Vazio>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Canal</TableHead>
                  <TableHead>Régua sugerida</TableHead>
                  <TableHead>Template Zenvia / assunto</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Último uso</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lista.map((t) => (
                  <TableRow
                    key={t.id}
                    onClick={() => (setAba(t.canal), setR(deTemplate(t)))}
                    className={cn("cursor-pointer", r.id === t.id && "bg-primary-soft")}
                  >
                    <TableCell className="font-semibold">{t.nome}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1 text-[12px] font-semibold">
                        {t.canal === "whatsapp" ? (
                          <MessageCircle className="h-4 w-4 text-success" />
                        ) : (
                          <Mail className="h-4 w-4 text-info" />
                        )}
                        {t.canal === "whatsapp" ? "WhatsApp" : "E-mail"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <SeloRegua r={t.reguaSugerida} />
                    </TableCell>
                    <TableCell className="max-w-[320px] truncate font-mono text-[12px]">
                      {t.canal === "whatsapp"
                        ? (b.whatsapp.find((w) => w.id === t.whatsappTemplateId)?.nome ?? "—")
                        : t.assunto}
                    </TableCell>
                    <TableCell>
                      {t.prontidao.pronto ? (
                        <Selo tom="success">Pronto</Selo>
                      ) : (
                        <Selo tom="warning">{t.prontidao.motivo}</Selo>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {t.ultimoUso ? `${dataHoraBr(t.ultimoUso.em)} · #${t.ultimoUso.numero}` : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <section className="flex flex-col gap-3.5 rounded-xl border bg-card px-5 py-4 shadow-card">
          <div className="flex items-center gap-3.5">
            <div className="grid h-[46px] w-[46px] place-items-center rounded-xl bg-secondary">
              <IconeIlustrativo icon={r.canal === "whatsapp" ? MessageCircle : Mail} size={28} />
            </div>
            <div>
              <h2 className="text-[16px] font-bold">
                {r.id
                  ? r.nome || "Template"
                  : r.canal === "whatsapp"
                    ? "Novo template de WhatsApp"
                    : "Novo template de e-mail"}
              </h2>
              <p className="text-[12.5px] text-muted-foreground">
                {r.canal === "whatsapp"
                  ? "Vinculado a um template da Zenvia. Só templates Aprovados podem ser usados nos lotes."
                  : "Enviado pelo provedor ativo em Integrações › E-mail."}
              </p>
            </div>
            <label className="ml-auto flex items-center gap-2 text-[12.5px] font-semibold">
              <Switch checked={r.ativo} onCheckedChange={(v) => set({ ativo: v })} /> Ativo
            </label>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-[12.5px] font-semibold">Nome na biblioteca *</span>
              <Input
                value={r.nome}
                onChange={(e) => set({ nome: e.target.value })}
                maxLength={80}
                placeholder="Ex.: Cobrança 60 dias"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[12.5px] font-semibold">Régua sugerida</span>
              <select
                className="h-9 rounded-[7px] border border-border-strong bg-card px-2.5 text-[13px]"
                value={r.reguaSugerida ?? ""}
                onChange={(e) =>
                  set({ reguaSugerida: (e.target.value || null) as ReguaSugerida | null })
                }
              >
                <option value="">Nenhuma</option>
                {(Object.keys(ROTULO_REGUA) as ReguaSugerida[]).map((k) => (
                  <option key={k} value={k}>
                    {ROTULO_REGUA[k]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {r.canal === "whatsapp" ? (
            <>
              {b.whatsapp.length === 0 && (
                <Aviso tom="warning">
                  Nenhum template da Zenvia sincronizado. Vá em{" "}
                  <Link to="/configuracoes/zenvia" className="font-bold underline">
                    Integrações › Zenvia WhatsApp
                  </Link>{" "}
                  e clique em Sincronizar templates.
                </Aviso>
              )}
              <div className="grid gap-3 md:grid-cols-2">
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12.5px] font-semibold">Template Zenvia</span>
                  <select
                    className="h-9 rounded-[7px] border border-border-strong bg-card px-2.5 text-[13px]"
                    value={r.whatsappTemplateId ?? ""}
                    onChange={(e) => {
                      const id = e.target.value || null;
                      const w = b.whatsapp.find((x) => x.id === id);
                      const mapa: Record<string, string> = {};
                      for (const v of w?.variaveis ?? [])
                        mapa[v] = r.mapaVariaveis[v] ?? sugerirCampo(v);
                      set({
                        whatsappTemplateId: id,
                        mapaVariaveis: mapa,
                        usaDocumento: w?.headerTipo === "MEDIA_DOCUMENT",
                      });
                    }}
                  >
                    <option value="">Escolha…</option>
                    {b.whatsapp.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.nome} · {rotuloStatusZenvia(w.status)}
                        {w.categoria ? ` · ${w.categoria}` : ""}
                      </option>
                    ))}
                  </select>
                  {wa && (
                    <small className="text-[11.5px] text-muted-foreground">
                      Cabeçalho:{" "}
                      <b>
                        {wa.headerTipo === "MEDIA_DOCUMENT"
                          ? "Documento"
                          : (wa.headerTipo ?? "nenhum")}
                      </b>{" "}
                      · {wa.variaveis.length} variáveis ·{" "}
                      {wa.status === "APPROVED" ? (
                        <span className="text-success">Aprovado</span>
                      ) : (
                        <span className="text-warning">
                          {rotuloStatusZenvia(wa.status)} (bloqueia novos lotes)
                        </span>
                      )}
                    </small>
                  )}
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12.5px] font-semibold">Número remetente</span>
                  <select
                    className="h-9 rounded-[7px] border border-border-strong bg-card px-2.5 text-[13px]"
                    value={r.remetenteId ?? ""}
                    onChange={(e) => set({ remetenteId: e.target.value || null })}
                  >
                    <option value="">Escolha…</option>
                    {b.remetentes
                      .filter((x) => x.ativo)
                      .map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.numero}
                          {x.nome ? ` · ${x.nome}` : ""}
                          {x.padrao ? " (padrão da régua)" : ""}
                        </option>
                      ))}
                  </select>
                  {wa?.senderId &&
                    r.remetenteId &&
                    b.remetentes.find((x) => x.id === r.remetenteId)?.numero !== wa.senderId && (
                      <small className="text-[11.5px] text-warning">
                        O template na Zenvia é do remetente {wa.senderId}. Use o mesmo número, ou a
                        Zenvia descarta a mensagem.
                      </small>
                    )}
                </label>
              </div>
              {wa && wa.variaveis.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-[12.5px] font-semibold">Mapeamento das variáveis</span>
                  <div className="grid grid-cols-[minmax(80px,auto)_1fr] items-center gap-2">
                    {wa.variaveis.map((v) => {
                      const ok = ehCampoBoleto(r.mapaVariaveis[v] ?? "");
                      return [
                        <span
                          key={`t-${v}`}
                          className={cn(
                            "rounded-md px-2 py-2 text-center font-mono text-[12px] font-semibold",
                            ok ? "bg-secondary" : "bg-primary-soft text-primary-dark",
                          )}
                        >
                          {`{{${v}}}`}
                        </span>,
                        <select
                          key={`s-${v}`}
                          className={cn(
                            "h-9 rounded-[7px] border bg-card px-2.5 text-[13px]",
                            ok ? "border-border-strong" : "border-primary",
                          )}
                          value={r.mapaVariaveis[v] ?? ""}
                          onChange={(e) =>
                            set({ mapaVariaveis: { ...r.mapaVariaveis, [v]: e.target.value } })
                          }
                        >
                          <option value="">— escolha um campo —</option>
                          {CAMPOS_BOLETO.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.rotulo}
                            </option>
                          ))}
                        </select>,
                      ];
                    })}
                  </div>
                  {faltando.length > 0 && (
                    <small className="text-[11.5px] text-primary-dark">
                      Variável sem campo impede salvar: {faltando.map((v) => `{{${v}}}`).join(", ")}
                      .
                    </small>
                  )}
                </div>
              )}
              {wa?.headerTipo === "MEDIA_DOCUMENT" && (
                <Aviso tom="success">
                  O cabeçalho Documento recebe o <b>PDF protegido</b> do boleto (link assinado com
                  validade). Nome do arquivo: <span className="font-mono">boleto-[número].pdf</span>
                  .
                </Aviso>
              )}
            </>
          ) : (
            <>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12.5px] font-semibold">Assunto *</span>
                <Input
                  value={r.assunto}
                  onChange={(e) => set({ assunto: e.target.value })}
                  maxLength={200}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12.5px] font-semibold">Corpo *</span>
                <Textarea
                  value={r.corpo}
                  onChange={(e) => set({ corpo: e.target.value })}
                  rows={10}
                />
                <div className="flex flex-wrap gap-1">
                  {CAMPOS_BOLETO.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => set({ corpo: `${r.corpo}{{${c.id}}}` })}
                      className="rounded-md bg-secondary px-1.5 py-0.5 font-mono text-[11px] hover:bg-accent"
                      title={c.rotulo}
                    >{`{{${c.id}}}`}</button>
                  ))}
                </div>
                {invalidas.length > 0 && (
                  <small className="text-[11.5px] text-primary-dark">
                    Variável desconhecida: {invalidas.map((v) => `{{${v}}}`).join(", ")}.
                  </small>
                )}
              </label>
              <div className="flex flex-col gap-1.5">
                <span className="text-[12.5px] font-semibold">Anexo</span>
                <div className="inline-flex self-start overflow-hidden rounded-[9px] border border-border-strong">
                  {(
                    [
                      ["pdf_link", "PDF protegido + link"],
                      ["link", "Só link"],
                    ] as const
                  ).map(([id, rot]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => set({ anexoTipo: id })}
                      className={cn(
                        "px-3 py-1.5 text-[12.5px] font-semibold",
                        r.anexoTipo === id ? "bg-foreground text-white" : "text-muted-foreground",
                      )}
                    >
                      {rot}
                    </button>
                  ))}
                </div>
              </div>
              {!b.emailPronto.ok && <Aviso tom="warning">{b.emailPronto.motivo}</Aviso>}
            </>
          )}

          <div className="flex flex-wrap items-center gap-2.5 border-t pt-3.5">
            <span className="text-[12px] text-muted-foreground">
              {r.id
                ? `Salvo em ${dataHoraBr(lista.find((t) => t.id === r.id)?.atualizadoEm)} por ${lista.find((t) => t.id === r.id)?.atualizadoPor ?? "—"}`
                : "Ainda não salvo"}
            </span>
            <div className="ml-auto flex gap-2">
              {r.id && b.podeEditar && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    if (
                      !window.confirm(
                        "Excluir este template? Se já foi usado em lotes, ele só é desativado.",
                      )
                    )
                      return;
                    try {
                      const res = await excluir({ data: { id: r.id! } });
                      toast.success(
                        res.desativado
                          ? "Template usado em lotes: foi desativado."
                          : "Template excluído.",
                      );
                      setR(null);
                      await qc.invalidateQueries({ queryKey: ["regua-biblioteca"] });
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Não foi possível excluir.");
                    }
                  }}
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Excluir
                </Button>
              )}
              <Button
                size="sm"
                disabled={
                  !b.podeEditar ||
                  salvando ||
                  !r.nome.trim() ||
                  faltando.length > 0 ||
                  invalidas.length > 0
                }
                onClick={() => void gravar()}
              >
                {salvando && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}Salvar
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 rounded-lg bg-secondary px-3 py-2.5">
            <span className="text-[12.5px] font-semibold">Enviar teste para</span>
            <Input
              value={para}
              onChange={(e) => setPara(e.target.value)}
              placeholder={r.canal === "whatsapp" ? "(21) 99999-0000" : "voce@email.com"}
              className="h-8 max-w-[240px] bg-card"
            />
            <Button
              size="sm"
              variant="outline"
              disabled={!r.id || !para || testando}
              onClick={() => void enviarTeste()}
            >
              {testando ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="mr-1.5 h-3.5 w-3.5" />
              )}
              Enviar teste
            </Button>
            <span className="w-full text-[11.5px] text-muted-foreground">
              Usa dados de exemplo e um PDF de teste com a senha 12345.
            </span>
          </div>
        </section>

        <section className="flex flex-col gap-3 rounded-xl border bg-card px-5 py-4 shadow-card">
          <h2 className="text-[16px] font-bold">Prévia</h2>
          {r.canal === "whatsapp" ? (
            previaWa ? (
              <PreviaWhatsapp
                texto={previaWa.texto}
                documento={wa?.headerTipo === "MEDIA_DOCUMENT" ? "boleto-000184522.pdf" : null}
                destaques={Object.values(previaWa.fields)}
              />
            ) : (
              <Vazio icone={MessageCircle} titulo="Escolha o template Zenvia" />
            )
          ) : (
            <PreviaEmail
              de={b.emailPronto.remetente ?? "(remetente em Integrações › E-mail)"}
              para="mariana.costa@email.com"
              assunto={preencher(r.assunto, EXEMPLO)}
              texto={preencher(r.corpo, EXEMPLO)}
              anexo={r.anexoTipo === "pdf_link" ? "boleto-000184522.pdf" : null}
            />
          )}
          <p className="text-center text-[11.5px] text-muted-foreground">
            Prévia com dados de exemplo. No Novo lote, a prévia usa os dados de cada cliente.
          </p>
        </section>
      </div>
    </div>
  );
}
