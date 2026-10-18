import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { AppWindow, Info, Plus, RefreshCw, Search, ShieldCheck, TriangleAlert, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHead, Panel, SemAcesso, Selo } from "@/components/page";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  mensagemErroAcesso,
  permissoesApp,
  verificacaoInstalada,
  type AppAcesso,
  type LoginAcesso,
} from "@/lib/permissoes-app";
import { cn } from "@/lib/utils";

// Permissões por aplicativo — a MESMA tela do Gestão Comercial, do Financeiro, do Gestão de
// Contratos e do Portal DP. Todas gravam no schema "acessos" do Supabase compartilhado: o que for
// mudado aqui vale (e aparece) em todos os aplicativos. Só o Super admin da Central acessa.

export const Route = createFileRoute("/_authenticated/administracao/permissoes-aplicativo")({
  component: PermissoesAppPage,
});

const POR_PAGINA = 10;
type Filtro = "todos" | "sim" | "nao";
type Aviso = { tom: "ok" | "erro"; texto: string } | null;

// Siglas fixas de aplicativos cujas iniciais automáticas confundem (Contratos e Pesagem).
const SIGLAS_APP: Record<string, string> = { contratos: "CT", pesagem: "PS" };

const iniciais = (nome: string) =>
  nome
    .split(/[\s_]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

function quando(iso: string | null): string {
  if (!iso) return "Nunca entrou";
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? "ontem" : `há ${d} dias`;
}

function Status({ app }: { app: AppAcesso }) {
  if (!app.configured) return <Selo tom="info">Novo · configurar</Selo>;
  if (!app.controlActive) return <Selo>Controle desligado</Selo>;
  if (!verificacaoInstalada(app)) return <Selo tom="danger">Bloqueio NÃO está valendo</Selo>;
  return <Selo tom="success">Controle ativo</Selo>;
}

function AvisoBox({ aviso, children }: { aviso: { tom: "ok" | "erro" }; children: ReactNode }) {
  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2 text-[12.5px] leading-normal",
        aviso.tom === "erro"
          ? "border-primary bg-primary-soft text-primary-dark"
          : "border-success/40 bg-success-soft text-success",
      )}
    >
      {children}
    </div>
  );
}

function Faixa({ tom, icon, children }: { tom?: "info" | "perigo" | "ok"; icon: ReactNode; children: ReactNode }) {
  return (
    <p
      className={cn(
        "flex items-start gap-2 rounded-lg border px-3 py-2 text-[12.5px] leading-normal",
        tom === "info" && "border-info/30 bg-info-soft text-info",
        tom === "perigo" && "border-primary bg-primary-soft text-primary-dark",
        tom === "ok" && "border-success/40 bg-success-soft text-success",
        !tom && "bg-muted text-muted-foreground",
      )}
    >
      <span className="mt-px shrink-0">{icon}</span>
      <span>{children}</span>
    </p>
  );
}

function Rotulo({ children }: { children: ReactNode }) {
  return <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">{children}</span>;
}

/** Botões segmentados (radiogroup). */
function Segmentos<T extends string>({
  valor,
  opcoes,
  rotulo,
  desabilitado,
  onMudar,
}: {
  valor: T;
  opcoes: readonly (readonly [T, ReactNode])[];
  rotulo: string;
  desabilitado?: boolean;
  onMudar: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border bg-muted p-0.5" role="radiogroup" aria-label={rotulo}>
      {opcoes.map(([v, conteudo]) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={valor === v}
          disabled={desabilitado}
          onClick={() => onMudar(v)}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-semibold transition-colors disabled:opacity-55",
            valor === v ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {conteudo}
        </button>
      ))}
    </div>
  );
}

function PermissoesAppPage() {
  const { souSuperAdminCentral, loading } = useCurrentUser();
  if (loading) return null;
  if (!souSuperAdminCentral) {
    return <SemAcesso texto="Somente o Super admin da Central (Gestão Comercial) gerencia as permissões por aplicativo." />;
  }
  return <PermissoesApp />;
}

function PermissoesApp() {
  const [apps, setApps] = useState<AppAcesso[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [adicionando, setAdicionando] = useState(false);
  const [aviso, setAviso] = useState<Aviso>(null);

  const recarregar = useCallback(async () => {
    setCarregando(true);
    try {
      setApps(await permissoesApp.listarAplicativos());
      setErro(null);
    } catch (e) {
      setErro(mensagemErroAcesso(e));
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void recarregar();
    // atualiza sozinha: o selo vira "Controle ativo" quando o site do aplicativo faz a primeira verificação
    const t = window.setInterval(() => void recarregar(), 60_000);
    return () => window.clearInterval(t);
  }, [recarregar]);

  useEffect(() => {
    if (!aviso) return;
    const t = window.setTimeout(() => setAviso(null), 5000);
    return () => window.clearTimeout(t);
  }, [aviso]);

  const lista = apps ?? [];
  const atual = lista.find((a) => a.schema === selecionado) ?? lista[0] ?? null;

  return (
    <div className="flex flex-col gap-4">
      <PageHead title="Permissões por aplicativo" actions={<Selo tom="danger">Somente Super admin</Selo>}>
        Quem pode entrar em cada aplicativo da Calper. O login e a senha são os mesmos em todos; o perfil dentro de
        cada aplicativo continua sendo definido nele. Alterações aqui valem em todos os aplicativos.
      </PageHead>

      {aviso && <AvisoBox aviso={aviso}>{aviso.texto}</AvisoBox>}

      {erro ? (
        <AvisoBox aviso={{ tom: "erro" }}>
          {erro}{" "}
          <Button variant="outline" size="sm" className="ml-2 h-7" onClick={() => void recarregar()}>
            Tentar de novo
          </Button>
        </AvisoBox>
      ) : !apps ? (
        <p className="py-8 text-center text-[13px] text-muted-foreground">Carregando…</p>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(260px,320px)_minmax(0,1fr)]">
          <Panel>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-[14px] font-bold">Aplicativos</h2>
              <div className="flex gap-1.5">
                <Button variant="outline" size="sm" className="h-7 px-2" onClick={() => setAdicionando(true)}>
                  <Plus className="mr-1 h-3.5 w-3.5" /> Adicionar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2"
                  disabled={carregando}
                  onClick={() => void recarregar().then(() => setAviso({ tom: "ok", texto: "Lista de aplicativos atualizada." }))}
                >
                  <RefreshCw className={cn("mr-1 h-3.5 w-3.5", carregando && "animate-spin")} /> Atualizar
                </Button>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              {lista.map((app) => (
                <button
                  key={app.schema}
                  type="button"
                  onClick={() => setSelecionado(app.schema)}
                  className={cn(
                    "flex items-center gap-2.5 rounded-[10px] border p-2.5 text-left transition-colors hover:border-border-strong",
                    app.schema === atual?.schema && "border-primary bg-primary-soft/50",
                  )}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sidebar text-xs font-bold text-white">
                    {SIGLAS_APP[app.schema] ?? iniciais(app.name)}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <strong className="truncate text-[13px]">{app.name}</strong>
                    <code className="truncate text-[11px] text-muted-foreground">
                      {app.manual ? `${app.schema} · dados em ${app.dataSchema}` : app.schema}
                    </code>
                    <span>
                      <Status app={app} />
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end font-mono text-[15px] font-semibold leading-tight">
                    {app.allowedCount}
                    <small className="text-[10.5px] font-normal text-muted-foreground">de {app.totalLogins}</small>
                  </span>
                </button>
              ))}
            </div>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              A lista mostra os schemas que a API do Supabase expõe de fato e os aplicativos adicionados à mão. Um
              schema novo aparece sozinho como <strong>Novo</strong>, com o controle desligado.
            </p>
          </Panel>

          {atual && <Detalhe key={atual.schema} app={atual} aoMudar={recarregar} avisar={setAviso} />}
        </div>
      )}

      {adicionando && (
        <AdicionarApp
          onFechar={() => setAdicionando(false)}
          onAdicionado={(chave) => {
            setSelecionado(chave);
            void recarregar();
            setAviso({ tom: "ok", texto: "Aplicativo adicionado · controle desligado até você ligar." });
          }}
        />
      )}
    </div>
  );
}

function Detalhe({ app, aoMudar, avisar }: { app: AppAcesso; aoMudar: () => Promise<void>; avisar: (a: Aviso) => void }) {
  const [logins, setLogins] = useState<LoginAcesso[] | null>(null);
  const [nome, setNome] = useState(app.name);
  const [url, setUrl] = useState(app.url ?? "");
  const [perfil, setPerfil] = useState(app.releaseProfile ?? "");
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [pagina, setPagina] = useState(1);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [ocupado, setOcupado] = useState(false);
  const [confirmando, setConfirmando] = useState(false);

  const carregarLogins = useCallback(async () => {
    try {
      setLogins(await permissoesApp.listarLogins(app.schema));
    } catch (e) {
      avisar({ tom: "erro", texto: mensagemErroAcesso(e) });
    }
  }, [app.schema, avisar]);

  useEffect(() => {
    permissoesApp.listarLogins(app.schema).then(setLogins, (e) => avisar({ tom: "erro", texto: mensagemErroAcesso(e) }));
  }, [app.schema, avisar]);

  const linhas = useMemo(() => logins ?? [], [logins]);
  const contagem = useMemo(
    () => ({ todos: linhas.length, sim: linhas.filter((l) => l.canEnter).length, nao: linhas.filter((l) => !l.canEnter).length }),
    [linhas],
  );
  const filtradas = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return linhas.filter(
      (l) =>
        (!t || l.name.toLowerCase().includes(t) || l.email.toLowerCase().includes(t)) &&
        (filtro === "todos" || (filtro === "sim") === l.canEnter),
    );
  }, [linhas, busca, filtro]);
  const paginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA));
  const visiveis = filtradas.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);

  /** Executa, recarrega a lista e os logins, e mostra o resultado. */
  const executar = async (acao: () => Promise<string | null>) => {
    setOcupado(true);
    try {
      const msg = await acao();
      await Promise.all([aoMudar(), carregarLogins()]);
      if (msg) avisar({ tom: "ok", texto: msg });
    } catch (e) {
      avisar({ tom: "erro", texto: mensagemErroAcesso(e) });
    } finally {
      setOcupado(false);
    }
  };

  const salvar = (padraoNovos: string = app.newLoginsDefault) =>
    void executar(async () => {
      await permissoesApp.salvarAplicativo(app.schema, nome, url, padraoNovos, perfil);
      return `Aplicativo ${nome} salvo.`;
    });

  const alternarControle = () => {
    const ligar = !app.controlActive;
    setConfirmando(false);
    void executar(async () => {
      await permissoesApp.definirControle(app.schema, ligar);
      return ligar ? `Controle de acesso ligado no ${app.name}.` : `Controle de acesso desligado no ${app.name}.`;
    });
  };

  const aplicar = (ids: string[], pode: boolean, quem?: string) =>
    void executar(async () => {
      const r = await permissoesApp.definirPermissao(app.schema, ids, pode);
      setMarcados(new Set());
      if (r.changed === 0 && r.created === 0) return "Nenhuma permissão mudou.";
      const cab = quem ?? (r.changed === 1 ? "1 login" : `${r.changed} logins`);
      const verbo = pode ? (quem ? "pode entrar" : "liberado(s)") : quem ? "foi bloqueado" : "bloqueado(s)";
      const extras = [
        r.created > 0 && `${r.created} cadastrado(s) como ${r.profile}`,
        r.skippedSuffix > 0 && `${r.skippedSuffix} conta(s) com sufixo sem cadastro automático`,
      ].filter(Boolean);
      return `${cab} ${verbo} no ${app.name}${extras.length ? ` · ${extras.join(" · ")}` : ""} · registrado na Auditoria.`;
    });

  const selecionaveis = visiveis.filter((l) => !l.owner);
  const todosMarcados = selecionaveis.length > 0 && selecionaveis.every((l) => marcados.has(l.id));
  const alternarMarca = (id: string) =>
    setMarcados((ant) => {
      const prox = new Set(ant);
      if (prox.has(id)) prox.delete(id);
      else prox.add(id);
      return prox;
    });
  const perfis = app.profiles ?? [];

  return (
    <Panel className="flex min-w-0 flex-col gap-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[15px] font-bold">{app.name}</h2>
        <Status app={app} />
      </div>

      <div className="grid items-end gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1.3fr_1fr_auto]">
        <label className="flex flex-col gap-1.5">
          <Rotulo>Nome do aplicativo</Rotulo>
          <Input value={nome} onChange={(e) => setNome(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1.5">
          <Rotulo>{app.manual ? "Chave · schema de dados" : "Schema"}</Rotulo>
          <Input className="font-mono text-xs" readOnly value={app.manual ? `${app.schema} · ${app.dataSchema}` : app.schema} />
        </label>
        <label className="flex flex-col gap-1.5">
          <Rotulo>Endereço (URL)</Rotulo>
          <Input
            className="font-mono text-xs"
            placeholder="ex.: disparo.calperservicos.com.br"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <Rotulo>Perfil ao liberar</Rotulo>
          <select
            className="h-9 w-full rounded-lg border border-input bg-card px-2.5 text-[13px] disabled:opacity-60"
            value={perfil}
            disabled={!perfis.length}
            onChange={(e) => setPerfil(e.target.value)}
          >
            {!perfis.length ? (
              <option value="">Sem cadastro próprio</option>
            ) : (
              perfis.map((p, i) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                  {i === perfis.length - 1 ? " (mais simples)" : ""}
                </option>
              ))
            )}
          </select>
        </label>
        <Button disabled={ocupado} onClick={() => salvar()}>
          {ocupado ? "Salvando…" : "Salvar"}
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className={cn("flex items-start gap-3 rounded-[10px] border p-3", app.controlActive && "border-primary/50 bg-primary-soft/40")}>
          <Switch
            checked={app.controlActive}
            disabled={ocupado}
            onCheckedChange={() => setConfirmando(true)}
            aria-label="Controle de acesso"
            className="mt-0.5"
          />
          <div className="flex flex-col gap-0.5">
            <strong className="text-[13px]">Controle de acesso</strong>
            <span className="text-xs leading-relaxed text-muted-foreground">
              {app.controlActive
                ? "Ligado: só entra quem está marcado como “Pode entrar” abaixo."
                : "Desligado: o aplicativo funciona como hoje e todo login da Calper entra."}
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-1.5 rounded-[10px] border p-3">
          <strong className="text-[13px]">Logins novos da Calper</strong>
          <span className="text-xs leading-relaxed text-muted-foreground">
            Quem ganha login depois de o controle ser ligado, neste aplicativo fica:
          </span>
          <div>
            <Segmentos
              valor={app.newLoginsDefault}
              rotulo="Logins novos"
              desabilitado={ocupado}
              opcoes={[
                ["bloqueado", "Bloqueado"],
                ["liberado", "Liberado"],
              ]}
              onMudar={(v) => app.newLoginsDefault !== v && salvar(v)}
            />
          </div>
        </div>
      </div>

      <Faixa tom="info" icon={<UserPlus className="h-4 w-4" />}>
        {app.defaultProfile
          ? `Ao liberar, quem ainda não tem cadastro no ${app.name} é cadastrado como ${app.defaultProfile}. Só logins @calper.com.br sem sufixo.`
          : `O ${app.name} não tem cadastro próprio: liberar só abre a porta.`}
      </Faixa>
      {app.controlActive && !verificacaoInstalada(app) && (
        <Faixa tom="perigo" icon={<TriangleAlert className="h-4 w-4" />}>
          <strong>O bloqueio NÃO está valendo no {app.name}.</strong> O site dele ainda não consulta esta tela depois do
          login (chave <code>{app.schema}</code>): quem está bloqueado continua entrando até a verificação ser instalada.
        </Faixa>
      )}
      {app.controlActive && app.protected && (
        <Faixa tom="ok" icon={<ShieldCheck className="h-4 w-4" />}>
          Proteção no banco ligada: quem está bloqueado não lê nem grava as tabelas do schema {app.dataSchema ?? app.schema}.
        </Faixa>
      )}
      {!app.controlActive && (
        <Faixa icon={<Info className="h-4 w-4" />}>
          Com o controle desligado ninguém é bloqueado. Ao ligar, quem tem cadastro no aplicativo entra; os demais
          ficam no padrão de logins novos.
        </Faixa>
      )}

      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Buscar por nome ou e-mail"
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value);
              setPagina(1);
            }}
          />
        </div>
        <Segmentos
          valor={filtro}
          rotulo="Filtro"
          opcoes={[
            ["todos", <>Todos <span className="ml-0.5 opacity-70">{contagem.todos}</span></>],
            ["sim", <>Podem entrar <span className="ml-0.5 opacity-70">{contagem.sim}</span></>],
            ["nao", <>Bloqueados <span className="ml-0.5 opacity-70">{contagem.nao}</span></>],
          ]}
          onMudar={(v) => {
            setFiltro(v);
            setPagina(1);
          }}
        />
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {marcados.size} selecionado(s)
          <Button
            size="sm"
            variant="outline"
            className="h-7 border-success/50 text-success hover:bg-success-soft"
            disabled={!marcados.size || !app.controlActive || ocupado}
            onClick={() => aplicar([...marcados], true)}
          >
            Liberar
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 border-primary/50 text-primary hover:bg-primary-soft"
            disabled={!marcados.size || !app.controlActive || ocupado}
            onClick={() => aplicar([...marcados], false)}
          >
            Bloquear
          </Button>
        </div>
      </div>

      <div className="overflow-auto rounded-[10px] border">
        <table className="w-full table-fixed border-collapse text-[12.5px] max-md:min-w-[620px] max-md:table-auto">
          <thead>
            <tr className="bg-muted text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              <th className="w-9 px-2.5 py-2">
                <input
                  type="checkbox"
                  className="accent-primary"
                  aria-label="Selecionar todos desta página"
                  checked={todosMarcados}
                  disabled={!app.controlActive || !selecionaveis.length}
                  onChange={() =>
                    setMarcados(todosMarcados ? new Set() : new Set([...marcados, ...selecionaveis.map((l) => l.id)]))
                  }
                />
              </th>
              <th className="px-2.5 py-2">Usuário</th>
              <th className="w-[16%] px-2.5 py-2">Último login na Calper</th>
              <th className="w-[19%] px-2.5 py-2">Cadastro no aplicativo</th>
              <th className="w-[190px] px-2.5 py-2">Pode entrar</th>
            </tr>
          </thead>
          <tbody>
            {!logins ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-muted-foreground">
                  Carregando…
                </td>
              </tr>
            ) : !visiveis.length ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-muted-foreground">
                  Nenhum login encontrado.
                </td>
              </tr>
            ) : (
              visiveis.map((l) => (
                <tr key={l.id} className="border-t">
                  <td className="px-2.5 py-2">
                    <input
                      type="checkbox"
                      className="accent-primary"
                      aria-label={`Selecionar ${l.name}`}
                      checked={marcados.has(l.id)}
                      disabled={l.owner || !app.controlActive}
                      onChange={() => alternarMarca(l.id)}
                    />
                  </td>
                  <td className="px-2.5 py-2">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-bold text-muted-foreground">
                        {iniciais(l.name)}
                      </span>
                      <div className="flex min-w-0 flex-col">
                        <strong className="truncate" title={l.name}>{l.name}</strong>
                        <small className="truncate text-muted-foreground" title={l.email}>{l.email}</small>
                      </div>
                    </div>
                  </td>
                  <td className="px-2.5 py-2 text-muted-foreground">{quando(l.lastSignInAt)}</td>
                  <td className="px-2.5 py-2 text-muted-foreground">
                    {l.registered
                      ? l.registeredByCentral
                        ? "Cadastrado pela permissão"
                        : "Cadastrado (origem)"
                      : l.suffix
                        ? "Conta com sufixo"
                        : "Sem cadastro"}
                  </td>
                  <td className="px-2.5 py-2">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                      <Switch
                        checked={l.canEnter}
                        disabled={l.owner || !app.controlActive || ocupado}
                        onCheckedChange={() => aplicar([l.id], !l.canEnter, l.name)}
                        aria-label={`${l.name} pode entrar`}
                      />
                      {l.owner ? (
                        <Selo tom="success">Proprietário</Selo>
                      ) : !app.controlActive ? (
                        <Selo>Livre (controle desligado)</Selo>
                      ) : l.canEnter ? (
                        <Selo tom="success">Pode entrar</Selo>
                      ) : (
                        <Selo tom="danger">Bloqueado</Selo>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          Mostrando {filtradas.length ? (pagina - 1) * POR_PAGINA + 1 : 0}–{Math.min(pagina * POR_PAGINA, filtradas.length)} de{" "}
          {filtradas.length} logins
        </span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={pagina <= 1} onClick={() => setPagina(pagina - 1)}>
            ‹
          </Button>
          Página {pagina} de {paginas}
          <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={pagina >= paginas} onClick={() => setPagina(pagina + 1)}>
            ›
          </Button>
        </div>
      </div>

      <Dialog open={confirmando} onOpenChange={setConfirmando}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {app.controlActive ? `Desligar o controle no ${app.name}?` : `Ligar o controle no ${app.name}?`}
            </DialogTitle>
            <DialogDescription>
              {app.controlActive
                ? "Todo login da Calper volta a entrar neste aplicativo. As permissões ficam guardadas."
                : "Quem tem cadastro no aplicativo entra; os demais seguem o padrão de logins novos. Decisões manuais valem sempre."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmando(false)}>
              Cancelar
            </Button>
            <Button disabled={ocupado} onClick={alternarControle}>
              {app.controlActive ? "Desligar controle" : "Ligar controle"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Panel>
  );
}

function AdicionarApp({ onFechar, onAdicionado }: { onFechar: () => void; onAdicionado: (chave: string) => void }) {
  const [chave, setChave] = useState("");
  const [nome, setNome] = useState("");
  const [url, setUrl] = useState("");
  const [schemaDados, setSchemaDados] = useState("public");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const enviar = async () => {
    setEnviando(true);
    setErro(null);
    try {
      await permissoesApp.adicionarAplicativo(chave, nome, url, schemaDados);
      onAdicionado(chave.trim().toLowerCase());
      onFechar();
    } catch (e) {
      setErro(mensagemErroAcesso(e));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && onFechar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AppWindow className="h-[18px] w-[18px]" /> Adicionar aplicativo
          </DialogTitle>
          <DialogDescription>
            Para sistemas que dividem um schema com outros (ex.: o Disparo em Massa e o Financeiro usam o{" "}
            <code>public</code>). Schemas próprios aparecem sozinhos na lista.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <Rotulo>Chave</Rotulo>
            <Input className="font-mono text-xs" placeholder="ex.: disparo_massa" value={chave} onChange={(e) => setChave(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1.5">
            <Rotulo>Nome</Rotulo>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1.5">
            <Rotulo>Endereço (URL)</Rotulo>
            <Input className="font-mono text-xs" value={url} onChange={(e) => setUrl(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1.5">
            <Rotulo>Schema de dados</Rotulo>
            <Input className="font-mono text-xs" value={schemaDados} onChange={(e) => setSchemaDados(e.target.value)} />
          </label>
          {erro && <p className="text-[12.5px] text-primary sm:col-span-2">{erro}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={enviando} onClick={onFechar}>
            Cancelar
          </Button>
          <Button disabled={enviando} onClick={() => void enviar()}>
            {enviando ? "Adicionando…" : "Adicionar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
