import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from "react";
import { Loader2, RefreshCw, Search, Trash2, UserX } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHead, Panel, SemAcesso, Selo } from "@/components/page";
import { useCurrentUser } from "@/hooks/use-current-user";
import { mascararDocumento } from "@/lib/csv";
import { mascararEmail, mascararTelefone } from "@/lib/mascaras";
import { ROTULO_TIPO_OPT_OUT, TIPOS_OPT_OUT, type TipoOptOut } from "@/lib/optout";
import {
  anonimizarCampanha,
  anonimizarTitular,
  consultarTitular,
  listarCampanhasParaAnonimizar,
  listarOptOuts,
  obterRetencao,
  registrarOptOut,
  removerOptOut,
  salvarRetencao,
  type CampanhaParaAnonimizar,
  type OcorrenciaTitular,
  type OptOutLinha,
  type RetencaoConfig,
} from "@/lib/privacidade.functions";

// Administração › Privacidade (auditoria de segurança, Fase 4 / LGPD): direitos do titular,
// lista de descadastro (opt-out), anonimização de campanha e retenção automática.
// Admin: consulta e descadastro. Super Admin (com 2º fator): anonimização e prazos de retenção.

export const Route = createFileRoute("/_authenticated/administracao/privacidade")({
  component: PrivacidadePage,
});

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

const GRID = "grid gap-5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr))]";
const CAIXA_ERRO =
  "rounded-lg border border-primary bg-primary-soft px-3 py-2 text-[12.5px] text-primary-dark";

const STATUS_CAMPANHA: Record<string, string> = {
  rascunho: "Rascunho",
  rascunho_confirmado: "Confirmada",
  em_execucao: "Em execução",
  concluida: "Concluída",
  erro: "Com erro",
  cancelada: "Cancelada",
};

const STATUS_DESTINATARIO: Record<string, string> = {
  pendente: "Pendente",
  enviado: "Enviado",
  entregue: "Entregue",
  assinado: "Assinado",
  erro: "Erro",
  opt_out: "Descadastrado",
};

const PLACEHOLDER_TIPO: Record<TipoOptOut, string> = {
  cpf: "000.000.000-00 ou CNPJ",
  email: "nome@dominio.com",
  telefone: "(21) 99999-0000",
};

const dataBr = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR") : "—";

/** Toast de erro com o motivo devolvido pelo servidor. */
function useAvisoErro() {
  return useCallback((titulo: string, e: unknown) => {
    toast.error(titulo, { description: msg(e) });
  }, []);
}

function PrivacidadePage() {
  const { pode, nivel, loading } = useCurrentUser();
  if (loading) return null;
  if (!pode("privacidade"))
    return <SemAcesso texto="Seu perfil não tem acesso à área de Privacidade." />;
  return <Privacidade superadmin={nivel === "superadmin"} />;
}

function Privacidade({ superadmin }: { superadmin: boolean }) {
  // Os painéis compartilham a lista de descadastro e as campanhas: uma ação num painel recarrega os outros.
  const [versaoOptOut, setVersaoOptOut] = useState(0);
  const [versaoCampanhas, setVersaoCampanhas] = useState(0);

  return (
    <div className="flex flex-col gap-5">
      <PageHead title="Privacidade e LGPD">
        Direitos dos titulares (acesso, eliminação e oposição), lista de descadastro, anonimização
        de dados pessoais e retenção automática. Os dados pessoais aparecem sempre mascarados e toda
        ação fica registrada em Logs Gerais, sem os valores informados.
      </PageHead>

      {!superadmin && (
        <Nota>
          A anonimização (de titular ou de campanha) e a alteração dos prazos de retenção são
          exclusivas do Super Admin.
        </Nota>
      )}

      <div className={GRID}>
        <DireitosTitular
          superadmin={superadmin}
          aoMudarOptOut={() => setVersaoOptOut((v) => v + 1)}
          aoAnonimizar={() => {
            setVersaoOptOut((v) => v + 1);
            setVersaoCampanhas((v) => v + 1);
          }}
        />
        <ListaOptOut versao={versaoOptOut} aoMudar={() => setVersaoOptOut((v) => v + 1)} />
        {superadmin && (
          <AnonimizarCampanha
            versao={versaoCampanhas}
            aoAnonimizar={() => setVersaoCampanhas((v) => v + 1)}
          />
        )}
        <Retencao superadmin={superadmin} />
      </div>
    </div>
  );
}

// ---------- a) Direitos do titular ----------

type ResultadoConsulta = { ocorrencias: OcorrenciaTitular[]; emOptOut: boolean };

function DireitosTitular({
  superadmin,
  aoMudarOptOut,
  aoAnonimizar,
}: {
  superadmin: boolean;
  aoMudarOptOut: () => void;
  aoAnonimizar: () => void;
}) {
  const consultarFn = useServerFn(consultarTitular);
  const anonimizarFn = useServerFn(anonimizarTitular);
  const registrarFn = useServerFn(registrarOptOut);
  const avisar = useAvisoErro();

  const [cpf, setCpf] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [resultado, setResultado] = useState<ResultadoConsulta | null>(null);
  const [ocupado, setOcupado] = useState<"consultar" | "anonimizar" | "descadastro" | null>(null);
  // Marcado por padrão: o identificador vai para a lista de supressão, que permite reaplicar a
  // eliminação depois de uma restauração de backup (docs/lgpd-privacidade.md, seção 7).
  const [tambemOptOut, setTambemOptOut] = useState(true);

  const temIdentificador = [cpf, email, telefone].some((v) => v.trim());

  // Editar um campo invalida a consulta anterior: os botões sempre agem sobre o que está nos campos.
  const editar = (set: (v: string) => void) => (e: ChangeEvent<HTMLInputElement>) => {
    set(e.target.value);
    setResultado(null);
  };

  /** Identificadores preenchidos, só mascarados, para os textos de confirmação. */
  function resumo(): string {
    const l: string[] = [];
    if (cpf.trim())
      l.push(`${ROTULO_TIPO_OPT_OUT.cpf}: ${mascararDocumento(cpf) || "(valor informado)"}`);
    if (email.trim())
      l.push(`${ROTULO_TIPO_OPT_OUT.email}: ${mascararEmail(email) || "(valor informado)"}`);
    if (telefone.trim())
      l.push(
        `${ROTULO_TIPO_OPT_OUT.telefone}: ${mascararTelefone(telefone) || "(valor informado)"}`,
      );
    return l.join("\n");
  }

  async function consultar(e: FormEvent) {
    e.preventDefault();
    if (!temIdentificador) return;
    setOcupado("consultar");
    try {
      setResultado(await consultarFn({ data: { cpf, email, telefone } }));
    } catch (err) {
      setResultado(null);
      avisar("Não foi possível consultar o titular", err);
    } finally {
      setOcupado(null);
    }
  }

  async function anonimizar() {
    const aviso =
      `Anonimizar este titular?\n\n${resumo()}\n\n` +
      "Nome, CPF, telefone, e-mail, bloco, unidade, dados extras e o JSON do DocuSign dessa pessoa serão apagados de TODAS as campanhas " +
      "(como comprador, a linha inteira; como cônjuge, só os dados do cônjuge). Status, datas e empreendimento são mantidos.\n\n" +
      "Esta ação é IRREVERSÍVEL." +
      (tambemOptOut
        ? "\n\nOs identificadores também serão registrados na lista de descadastro."
        : "");
    if (!window.confirm(aviso)) return;
    setOcupado("anonimizar");
    try {
      const r = await anonimizarFn({
        data: { cpf, email, telefone, registrarOptOut: tambemOptOut },
      });
      toast.success("Titular anonimizado", {
        description: `${r.anonimizados} registro(s) anonimizado(s)${tambemOptOut && !r.optoutFalhou ? "; descadastro registrado" : ""}.`,
      });
      if (r.optoutFalhou) {
        toast.warning("Descadastro não registrado", {
          description:
            "A anonimização foi feita, mas não foi possível registrar o descadastro. Registre-o manualmente.",
          duration: 12000,
        });
      }
      setCpf("");
      setEmail("");
      setTelefone("");
      setResultado(null);
      aoAnonimizar();
    } catch (err) {
      avisar("Não foi possível anonimizar o titular", err);
    } finally {
      setOcupado(null);
    }
  }

  async function descadastrar() {
    const itens: { tipo: TipoOptOut; valor: string }[] = (
      [
        { tipo: "cpf", valor: cpf },
        { tipo: "email", valor: email },
        { tipo: "telefone", valor: telefone },
      ] as { tipo: TipoOptOut; valor: string }[]
    ).filter((i) => i.valor.trim());
    if (
      !window.confirm(
        `Registrar descadastro deste titular?\n\n${resumo()}\n\nNovas campanhas não enviarão documentos para esses identificadores.`,
      )
    )
      return;
    setOcupado("descadastro");
    let criados = 0;
    try {
      for (const i of itens) {
        const r = await registrarFn({
          data: { tipo: i.tipo, valor: i.valor, motivo: "Pedido do titular" },
        });
        if (r.criado) criados++;
      }
      toast.success("Descadastro registrado", {
        description:
          criados === itens.length
            ? `${criados} identificador(es) incluído(s).`
            : `${criados} novo(s); os demais já estavam na lista.`,
      });
      setResultado((r) => (r ? { ...r, emOptOut: true } : r));
    } catch (err) {
      avisar("Não foi possível registrar o descadastro", err);
    } finally {
      setOcupado(null);
      aoMudarOptOut();
    }
  }

  return (
    <Panel
      title="Direitos do titular"
      sub="Informe ao menos um identificador para ver onde a pessoa aparece nas campanhas (acesso), eliminar os dados dela (anonimização) ou impedir novos envios (descadastro)."
    >
      <form onSubmit={consultar} className="flex flex-col gap-3" noValidate>
        <Campo id="t-cpf" label="CPF/CNPJ">
          <Input
            id="t-cpf"
            inputMode="numeric"
            placeholder="000.000.000-00"
            value={cpf}
            maxLength={30}
            onChange={editar(setCpf)}
          />
        </Campo>
        <Campo id="t-email" label="E-mail">
          <Input
            id="t-email"
            type="email"
            placeholder="nome@dominio.com"
            value={email}
            maxLength={254}
            onChange={editar(setEmail)}
          />
        </Campo>
        <Campo id="t-tel" label="Telefone">
          <Input
            id="t-tel"
            inputMode="tel"
            placeholder="(21) 99999-0000"
            value={telefone}
            maxLength={30}
            onChange={editar(setTelefone)}
          />
        </Campo>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="sm" disabled={!temIdentificador || ocupado !== null}>
            {ocupado === "consultar" ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Search className="mr-1.5 h-3.5 w-3.5" />
            )}
            Consultar
          </Button>
        </div>
      </form>

      {resultado && (
        <div className="mt-4 flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <strong className="text-[13px]">{resultado.ocorrencias.length} ocorrência(s)</strong>
            {resultado.emOptOut ? (
              <Selo tom="warning">na lista de descadastro</Selo>
            ) : (
              <Selo>fora da lista de descadastro</Selo>
            )}
          </div>
          {resultado.ocorrencias.length === 0 ? (
            <p className="py-4 text-center text-[13px] text-dimmer">
              Nenhum dado pessoal desta pessoa foi encontrado nas campanhas.
            </p>
          ) : (
            <div className="max-h-[320px] overflow-auto rounded-[10px] border">
              <Table>
                <TableHeader className="sticky top-0 z-10">
                  <TableRow>
                    <TableHead>Campanha</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Empreendimento</TableHead>
                    <TableHead>Papel</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resultado.ocorrencias.map((o) => (
                    <TableRow key={o.destinatario_id}>
                      <TableCell className="text-[12.5px] font-semibold">
                        {o.campanha_nome}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs">
                        {dataBr(o.enviado_em ?? o.campanha_criada_em)}
                      </TableCell>
                      <TableCell className="text-[12.5px]">
                        {STATUS_DESTINATARIO[o.status] ?? o.status}
                      </TableCell>
                      <TableCell className="text-[12.5px] text-muted-foreground">
                        {o.empreendimento ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Selo tom={o.papel === "conjuge" ? "info" : undefined}>
                          {o.papel === "conjuge" ? "cônjuge" : "comprador"}
                        </Selo>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {resultado.ocorrencias.length >= 200 && (
            <Nota>Mostrando as 200 ocorrências mais recentes.</Nota>
          )}
        </div>
      )}

      {temIdentificador && (
        <div className="mt-4 flex flex-col gap-3 border-t pt-4">
          <div className="flex flex-wrap gap-2">
            {superadmin && (
              <Button
                type="button"
                size="sm"
                variant="destructive"
                onClick={() => void anonimizar()}
                disabled={ocupado !== null}
              >
                {ocupado === "anonimizar" && (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                )}
                Anonimizar este titular
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void descadastrar()}
              disabled={ocupado !== null}
            >
              {ocupado === "descadastro" ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <UserX className="mr-1.5 h-3.5 w-3.5" />
              )}
              Registrar descadastro
            </Button>
          </div>
          {superadmin && (
            <>
              <label className="flex cursor-pointer items-start gap-2 text-[13px] text-muted-foreground">
                <input
                  type="checkbox"
                  className="mt-0.5 accent-primary"
                  checked={tambemOptOut}
                  onChange={(e) => setTambemOptOut(e.target.checked)}
                />
                <span>
                  Registrar também em descadastro ao anonimizar (guarda o CPF, e-mail ou telefone
                  informado só para que a pessoa não receba novos disparos).
                </span>
              </label>
              <Nota>
                Anonimizar é <strong>irreversível</strong>.
              </Nota>
            </>
          )}
        </div>
      )}
    </Panel>
  );
}

// ---------- b) Lista de descadastro ----------

function ListaOptOut({ versao, aoMudar }: { versao: number; aoMudar: () => void }) {
  const listar = useServerFn(listarOptOuts);
  const registrar = useServerFn(registrarOptOut);
  const remover = useServerFn(removerOptOut);
  const avisar = useAvisoErro();

  const [linhas, setLinhas] = useState<OptOutLinha[] | null>(null);
  const [erroLista, setErroLista] = useState<string | null>(null);
  const [tipo, setTipo] = useState<TipoOptOut>("cpf");
  const [valor, setValor] = useState("");
  const [motivo, setMotivo] = useState("");
  const [salvando, setSalvando] = useState(false);

  const recarregar = useCallback(async () => {
    try {
      setLinhas(await listar());
      setErroLista(null);
    } catch (e) {
      setErroLista(msg(e));
      setLinhas([]);
    }
  }, [listar]);

  // `versao` muda quando outro painel altera a lista (descadastro pelo titular, anonimização).
  useEffect(() => {
    void recarregar();
  }, [recarregar, versao]);

  async function incluir(e: FormEvent) {
    e.preventDefault();
    if (!valor.trim()) return;
    setSalvando(true);
    try {
      const r = await registrar({ data: { tipo, valor, motivo: motivo.trim() || null } });
      if (r.criado)
        toast.success("Descadastro registrado", {
          description: "Novas campanhas não enviarão para esse identificador.",
        });
      else
        toast.info("Já estava na lista", {
          description: "Esse identificador já constava no descadastro.",
        });
      setValor("");
      setMotivo("");
      aoMudar();
    } catch (err) {
      avisar("Não foi possível registrar o descadastro", err);
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(l: OptOutLinha) {
    if (
      !window.confirm(
        `Remover este descadastro?\n\n${ROTULO_TIPO_OPT_OUT[l.tipo]}: ${l.valorMascarado}\n\n` +
          "Só remova com pedido do titular (novo consentimento). Sem isso, a pessoa volta a receber documentos nas próximas campanhas.",
      )
    )
      return;
    try {
      await remover({ data: { id: l.id } });
      toast.success("Descadastro removido");
      aoMudar();
    } catch (err) {
      avisar("Não foi possível remover o descadastro", err);
    }
  }

  return (
    <Panel
      title="Lista de descadastro (opt-out)"
      sub={
        linhas === null
          ? "Carregando…"
          : `${linhas.length} identificador(es)${linhas.length >= 500 ? " (mostrando os 500 mais recentes)" : ""}. Quem está aqui não recebe novos disparos: o destinatário entra na campanha como descadastrado.`
      }
    >
      <form onSubmit={incluir} className="mb-4 flex flex-col gap-3" noValidate>
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(160px,1fr))]">
          <Campo id="o-tipo" label="Tipo">
            <select
              id="o-tipo"
              value={tipo}
              onChange={(e) => setTipo(e.target.value as TipoOptOut)}
              className="h-9 w-full rounded-lg border border-input bg-card px-2.5 text-[13px]"
            >
              {TIPOS_OPT_OUT.map((t) => (
                <option key={t} value={t}>
                  {ROTULO_TIPO_OPT_OUT[t]}
                </option>
              ))}
            </select>
          </Campo>
          <Campo id="o-valor" label="Valor">
            <Input
              id="o-valor"
              value={valor}
              maxLength={254}
              placeholder={PLACEHOLDER_TIPO[tipo]}
              onChange={(e) => setValor(e.target.value)}
            />
          </Campo>
        </div>
        <Campo id="o-motivo" label="Motivo (opcional)">
          <Input
            id="o-motivo"
            value={motivo}
            maxLength={300}
            placeholder="Ex.: pedido por e-mail do titular"
            onChange={(e) => setMotivo(e.target.value)}
          />
        </Campo>
        <div>
          <Button type="submit" size="sm" disabled={salvando || !valor.trim()}>
            {salvando ? "Registrando…" : "Registrar descadastro"}
          </Button>
        </div>
      </form>

      {erroLista && (
        <div className={`mb-3 ${CAIXA_ERRO}`}>Não foi possível carregar a lista: {erroLista}</div>
      )}

      {linhas === null ? (
        <Carregando />
      ) : linhas.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-dimmer">
          Nenhum identificador descadastrado.
        </p>
      ) : (
        <div className="max-h-[420px] overflow-auto rounded-[10px] border">
          <Table>
            <TableHeader className="sticky top-0 z-10">
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhas.map((l) => (
                <TableRow key={l.id}>
                  <TableCell>
                    <Selo tom="info">{ROTULO_TIPO_OPT_OUT[l.tipo] ?? l.tipo}</Selo>
                  </TableCell>
                  <TableCell className="whitespace-nowrap font-mono text-xs">
                    {l.valorMascarado}
                  </TableCell>
                  <TableCell
                    className="max-w-[220px] truncate text-[12.5px] text-muted-foreground"
                    title={l.motivo ?? undefined}
                  >
                    {l.motivo ?? "—"}
                  </TableCell>
                  <TableCell className="text-[12.5px] text-muted-foreground">{l.origem}</TableCell>
                  <TableCell className="whitespace-nowrap text-xs">
                    {dataBr(l.created_at)}
                  </TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => void excluir(l)}
                      title="Remover da lista (só com pedido do titular)"
                      aria-label={`Remover ${ROTULO_TIPO_OPT_OUT[l.tipo]} ${l.valorMascarado} da lista`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <Nota className="mt-3">
        Remova um identificador apenas quando o próprio titular pedir para voltar a receber (novo
        consentimento).
      </Nota>
    </Panel>
  );
}

// ---------- c) Anonimizar campanha (Super Admin) ----------

function AnonimizarCampanha({
  versao,
  aoAnonimizar,
}: {
  versao: number;
  aoAnonimizar: () => void;
}) {
  const listar = useServerFn(listarCampanhasParaAnonimizar);
  const anonimizar = useServerFn(anonimizarCampanha);
  const avisar = useAvisoErro();

  const [campanhas, setCampanhas] = useState<CampanhaParaAnonimizar[] | null>(null);
  const [erroLista, setErroLista] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [emAndamento, setEmAndamento] = useState<string | null>(null);

  const recarregar = useCallback(async () => {
    setCampanhas(null);
    try {
      setCampanhas(await listar());
      setErroLista(null);
    } catch (e) {
      setErroLista(msg(e));
      setCampanhas([]);
    }
  }, [listar]);

  useEffect(() => {
    void recarregar();
  }, [recarregar, versao]);

  const termo = busca.trim().toLocaleLowerCase("pt-BR");
  const filtradas = useMemo(
    () =>
      (campanhas ?? []).filter(
        (c) =>
          !termo ||
          `${c.nome} ${c.criado_por_nome ?? ""}`.toLocaleLowerCase("pt-BR").includes(termo),
      ),
    [campanhas, termo],
  );

  async function executar(c: CampanhaParaAnonimizar) {
    if (
      !window.confirm(
        `Anonimizar a campanha "${c.nome}"?\n\n` +
          `${c.destinatarios_pendentes_anonimizacao} destinatário(s) terão nome, CPF, telefone, e-mail, bloco, unidade, dados extras e o JSON do DocuSign apagados. ` +
          "Status, datas e empreendimento são mantidos.\n\nEsta ação é IRREVERSÍVEL.",
      )
    )
      return;
    setEmAndamento(c.id);
    try {
      const r = await anonimizar({ data: { campanhaId: c.id } });
      toast.success("Campanha anonimizada", {
        description: `${r.anonimizados} destinatário(s) anonimizado(s).`,
      });
      aoAnonimizar();
    } catch (err) {
      avisar("Não foi possível anonimizar a campanha", err);
    } finally {
      setEmAndamento(null);
    }
  }

  return (
    <Panel
      title="Anonimizar campanha"
      className="[grid-column:1/-1]"
      sub="Apaga os dados pessoais de todos os destinatários da campanha de uma só vez, de forma irreversível. As 200 campanhas mais recentes."
    >
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-[360px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por campanha ou criador..."
            className="pl-8"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void recarregar()}
          disabled={campanhas === null}
        >
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Atualizar
        </Button>
        {campanhas && (
          <p className="text-xs text-muted-foreground">
            {termo ? `${filtradas.length} de ${campanhas.length}` : campanhas.length} campanha(s)
          </p>
        )}
      </div>

      {erroLista && (
        <div className={`mb-3 ${CAIXA_ERRO}`}>
          Não foi possível carregar as campanhas: {erroLista}
        </div>
      )}

      {campanhas === null ? (
        <Carregando />
      ) : filtradas.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-dimmer">
          {termo ? "Nenhuma campanha encontrada para essa busca." : "Nenhuma campanha."}
        </p>
      ) : (
        <div className="max-h-[480px] overflow-auto rounded-[10px] border">
          <Table>
            <TableHeader className="sticky top-0 z-10">
              <TableRow>
                <TableHead>Campanha</TableHead>
                <TableHead>Criada por</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Destinatários</TableHead>
                <TableHead className="text-right">A anonimizar</TableHead>
                <TableHead className="w-28" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtradas.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="text-[12.5px] font-semibold">{c.nome}</TableCell>
                  <TableCell className="text-[12.5px] text-muted-foreground">
                    {c.criado_por_nome ?? "—"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs">
                    {dataBr(c.created_at)}
                  </TableCell>
                  <TableCell className="text-[12.5px]">
                    {STATUS_CAMPANHA[c.status] ?? c.status}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {c.destinatarios_total}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {c.destinatarios_pendentes_anonimizacao === 0 ? (
                      <Selo tom="success">anonimizada</Selo>
                    ) : (
                      c.destinatarios_pendentes_anonimizacao
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void executar(c)}
                      disabled={
                        emAndamento !== null || c.destinatarios_pendentes_anonimizacao === 0
                      }
                    >
                      {emAndamento === c.id && (
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      )}
                      Anonimizar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Panel>
  );
}

// ---------- d) Retenção automática ----------

function Retencao({ superadmin }: { superadmin: boolean }) {
  const obter = useServerFn(obterRetencao);
  const salvar = useServerFn(salvarRetencao);
  const avisar = useAvisoErro();

  const [cfg, setCfg] = useState<RetencaoConfig | null>(null);
  const [erroLista, setErroLista] = useState<string | null>(null);
  const [destinatarios, setDestinatarios] = useState("12");
  const [abertas, setAbertas] = useState("18");
  const [salvando, setSalvando] = useState(false);

  const aplicar = useCallback((c: RetencaoConfig) => {
    setCfg(c);
    setDestinatarios(String(c.destinatarios_meses));
    setAbertas(String(c.campanhas_abertas_meses));
  }, []);

  useEffect(() => {
    (async () => {
      try {
        aplicar(await obter());
        setErroLista(null);
      } catch (e) {
        setErroLista(msg(e));
      }
    })();
  }, [obter, aplicar]);

  async function gravar(e: FormEvent) {
    e.preventDefault();
    if (!cfg) return;
    const d = Number(destinatarios);
    const a = Number(abertas);
    const valido = (n: number) => Number.isInteger(n) && n >= 1 && n <= 120;
    if (!valido(d) || !valido(a)) {
      toast.error("Prazos inválidos", {
        description: "Informe números inteiros de meses entre 1 e 120.",
      });
      return;
    }
    if (d < cfg.destinatarios_meses || a < cfg.campanhas_abertas_meses) {
      if (
        !window.confirm(
          "Reduzir um prazo faz a próxima execução diária anonimizar, de forma irreversível, dados que hoje ainda estão dentro do prazo.\n\nContinuar?",
        )
      )
        return;
    }
    setSalvando(true);
    try {
      aplicar(await salvar({ data: { destinatarios_meses: d, campanhas_abertas_meses: a } }));
      toast.success("Retenção atualizada", {
        description: "Os novos prazos valem a partir da próxima execução (03:15 UTC).",
      });
    } catch (err) {
      avisar("Não foi possível salvar a retenção", err);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Panel
      title="Retenção automática"
      sub="Todo dia às 03:15 UTC o banco (pg_cron) anonimiza sozinho os dados pessoais de compradores que passaram do prazo, sem intervenção manual."
    >
      {erroLista && (
        <div className={`mb-3 ${CAIXA_ERRO}`}>
          Não foi possível carregar a retenção: {erroLista}
        </div>
      )}

      {cfg === null && !erroLista ? (
        <Carregando />
      ) : cfg ? (
        <div className="flex flex-col gap-3">
          <ul className="flex list-disc flex-col gap-1.5 pl-5 text-[13px] text-muted-foreground">
            <li>
              Destinatários de campanhas <strong>encerradas</strong> (concluída, com erro ou
              cancelada) há mais de <strong>{cfg.destinatarios_meses} meses</strong>.
            </li>
            <li>
              Destinatários de campanhas <strong>que nunca foram encerradas</strong>, criadas há
              mais de <strong>{cfg.campanhas_abertas_meses} meses</strong>.
            </li>
            <li>
              JSON bruto do DocuSign (nomes, e-mails e telefones dos signatários) com mais de{" "}
              <strong>{cfg.destinatarios_meses} meses</strong>.
            </li>
          </ul>
          <Nota>
            Anonimizar apaga nome, CPF, telefone, e-mail, bloco, unidade, dados extras e o JSON do
            DocuSign. Status, datas e empreendimento são mantidos, então relatórios e estatísticas
            continuam valendo. Também são limpos automaticamente: logs do Gateway (30 dias),
            tentativas e histórico de login (180 dias) e trilha de auditoria (2 anos).
          </Nota>

          {superadmin ? (
            <form onSubmit={gravar} className="flex flex-col gap-3 border-t pt-3" noValidate>
              <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(160px,1fr))]">
                <Campo id="r-dest" label="Destinatários (meses)">
                  <Input
                    id="r-dest"
                    type="number"
                    min={1}
                    max={120}
                    step={1}
                    value={destinatarios}
                    onChange={(e) => setDestinatarios(e.target.value)}
                  />
                </Campo>
                <Campo id="r-abertas" label="Campanhas abertas (meses)">
                  <Input
                    id="r-abertas"
                    type="number"
                    min={1}
                    max={120}
                    step={1}
                    value={abertas}
                    onChange={(e) => setAbertas(e.target.value)}
                  />
                </Campo>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" size="sm" disabled={salvando}>
                  {salvando ? "Salvando…" : "Salvar prazos"}
                </Button>
                <p className="text-xs text-muted-foreground">Entre 1 e 120 meses.</p>
              </div>
            </form>
          ) : (
            <Nota>Só o Super Admin pode alterar os prazos.</Nota>
          )}
        </div>
      ) : null}
    </Panel>
  );
}

// ---------- auxiliares ----------

function Campo({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label
        htmlFor={id}
        className="text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground"
      >
        {label}
      </Label>
      {children}
    </div>
  );
}

function Nota({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={`text-xs leading-relaxed text-muted-foreground ${className ?? ""}`}>{children}</p>
  );
}

function Carregando() {
  return (
    <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
    </div>
  );
}
