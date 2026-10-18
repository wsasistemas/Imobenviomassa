import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Loader2, Lock, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHead, Panel } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { IconeDoMenu } from "@/components/icones/icone-colorido";
import { supabase } from "@/integrations/supabase/client";
import { getPermission, menuGroups, permissionChildrenOf, permissionEntries, type PermissionEntry } from "@/config/menu-registry";
import { ADMIN_ROLE, SUPER_ADMIN_ROLE } from "@/lib/acesso/policy";
import { cn } from "@/lib/utils";

// Configurações › Perfis e permissões — processo do Portal_Atendimento: perfis criados pela tela e matriz em árvore
// (menu → submenus → ações) com os ids do src/config/menu-registry.ts. Tudo grava pelas RPCs do schema imobenviomassa
// (criar_perfil, editar_perfil, excluir_perfil, salvar_permissoes_perfil), que conferem a permissão no banco.

export const Route = createFileRoute("/_authenticated/administracao/perfis")({
  component: PerfisPage,
});

type Perfil = {
  chave: string;
  nome: string;
  descricao: string | null;
  sistema: boolean;
  travado: boolean;
  total_usuarios: number;
  editavel: boolean;
};

type Linha = { entry: PermissionEntry; depth: number };

const msg = (e: unknown) => (e as { message?: string } | null)?.message ?? "Não foi possível concluir. Tente de novo.";

/** Linhas da matriz de um grupo: item → filhos (submenus, seções e ações), recursivo. Rodapé fica de fora. */
function linhasDoGrupo(grupo: string): Linha[] {
  const out: Linha[] = [];
  const visitar = (e: PermissionEntry, depth: number) => {
    out.push({ entry: e, depth });
    for (const f of permissionChildrenOf(e.id)) visitar(f, depth + 1);
  };
  for (const e of permissionEntries) {
    if (e.parent) continue;
    if (e.kind === "menu" && e.group === grupo) visitar(e, 0);
  }
  return out;
}

function normalizar(t: string) {
  return t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function PerfisPage() {
  const [perfis, setPerfis] = useState<Perfil[] | null>(null);
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [base, setBase] = useState<Record<string, boolean>>({});
  const [draft, setDraft] = useState<Record<string, boolean>>({});
  const [carregandoRegras, setCarregandoRegras] = useState(false);
  const [filtro, setFiltro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [trocarPara, setTrocarPara] = useState<string | null>(null);
  const [form, setForm] = useState<{ chave?: string; nome: string; descricao: string } | null>(null);
  const [excluir, setExcluir] = useState<Perfil | null>(null);

  const carregarPerfis = useCallback(async () => {
    const { data, error } = await supabase.rpc("listar_perfis");
    if (error) {
      toast.error(msg(error));
      setPerfis([]);
      return;
    }
    const lista = (data ?? []).map((p) => ({
      chave: p.chave,
      nome: p.nome,
      descricao: p.descricao,
      sistema: p.sistema,
      travado: p.travado,
      total_usuarios: Number(p.total_usuarios),
      editavel: p.editavel,
    }));
    setPerfis(lista);
    setSelecionado((s) => s ?? lista.find((p) => !p.travado)?.chave ?? lista[0]?.chave ?? null);
  }, []);

  useEffect(() => {
    void carregarPerfis();
  }, [carregarPerfis]);

  const atual = perfis?.find((p) => p.chave === selecionado) ?? null;

  // Regras salvas do perfil selecionado (o Super Admin não tem regras: tem tudo).
  useEffect(() => {
    if (!atual || atual.travado) {
      setBase({});
      setDraft({});
      return;
    }
    let vivo = true;
    setCarregandoRegras(true);
    supabase.rpc("regras_do_perfil", { p_perfil: atual.chave }).then(({ data, error }) => {
      if (!vivo) return;
      setCarregandoRegras(false);
      if (error) {
        toast.error(msg(error));
        return;
      }
      setBase(Object.fromEntries((data ?? []).map((r) => [r.permission_id, r.enabled])));
      setDraft({});
    });
    return () => {
      vivo = false;
    };
  }, [atual?.chave, atual?.travado]); // eslint-disable-line react-hooks/exhaustive-deps

  const efetivo = useMemo(() => ({ ...base, ...draft }), [base, draft]);
  const alteracoes = Object.keys(draft).filter((id) => draft[id] !== (base[id] === true));

  /** Estado e trava de uma linha no rascunho (mesma regra de src/lib/acesso/policy.ts). */
  function situacao(e: PermissionEntry, regras: Record<string, boolean> = efetivo) {
    const perfil = atual?.chave;
    if (atual?.travado) return { on: true, travada: true, motivo: null as string | null };
    if (e.kind === "menu" && e.alwaysVisible) return { on: true, travada: true, motivo: "Sempre visível" };
    if (e.superAdminOnly) return { on: false, travada: true, motivo: "Somente super admin" };
    if (e.adminOnly) return { on: perfil === ADMIN_ROLE, travada: true, motivo: "Somente admin e super admin" };
    if (e.parent) {
      const pai = getPermission(e.parent);
      if (pai && !situacao(pai, regras).on) return { on: false, travada: true, motivo: `Requer ${pai.label}` };
    }
    return { on: regras[e.id] === true, travada: !atual?.editavel, motivo: null };
  }

  function alternar(id: string, valor: boolean) {
    setDraft((d) => {
      const n = { ...d, [id]: valor };
      if (valor === (base[id] === true)) delete n[id];
      return n;
    });
  }

  /** Libera tudo o que é marcável no grupo, pais antes dos filhos (o filho só destrava com o pai ligado). */
  function liberarTodos(linhas: Linha[]) {
    setDraft((d) => {
      const n = { ...d };
      const regras = () => ({ ...base, ...n });
      for (const { entry } of linhas) {
        const s = situacao(entry, regras());
        if (!s.travada && !s.on) {
          n[entry.id] = true;
          if (base[entry.id] === true) delete n[entry.id];
        }
      }
      return n;
    });
  }

  async function salvar() {
    if (!atual || alteracoes.length === 0) return;
    setSalvando(true);
    const lote = alteracoes.map((id) => ({ id, enabled: draft[id] }));
    const { error } = await supabase.rpc("salvar_permissoes_perfil", { p_perfil: atual.chave, p_alteracoes: lote });
    setSalvando(false);
    if (error) {
      toast.error(msg(error));
      return;
    }
    toast.success("Permissões salvas", { description: `${lote.length} alteração(ões) no perfil ${atual.nome}.` });
    setBase((b) => ({ ...b, ...draft }));
    setDraft({});
  }

  function escolher(chave: string) {
    if (chave === selecionado) return;
    if (alteracoes.length) setTrocarPara(chave);
    else setSelecionado(chave);
  }

  async function gravarPerfil(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    const { data, error } = form.chave
      ? await supabase.rpc("editar_perfil", { p_chave: form.chave, p_nome: form.nome, p_descricao: form.descricao })
      : await supabase.rpc("criar_perfil", { p_nome: form.nome, p_descricao: form.descricao });
    if (error) {
      toast.error(msg(error));
      return;
    }
    toast.success(form.chave ? "Perfil atualizado" : "Perfil criado", {
      description: form.chave ? form.nome : `${form.nome} começa sem nenhum menu liberado.`,
    });
    setForm(null);
    await carregarPerfis();
    if (!form.chave && typeof data === "string") setSelecionado(data);
  }

  async function confirmarExclusao() {
    if (!excluir) return;
    const { error } = await supabase.rpc("excluir_perfil", { p_chave: excluir.chave });
    if (error) {
      toast.error(msg(error));
      return;
    }
    toast.success("Perfil excluído", { description: excluir.nome });
    if (selecionado === excluir.chave) setSelecionado(null);
    setExcluir(null);
    await carregarPerfis();
  }

  const podeCriar = !!perfis?.some((p) => p.editavel);
  const termo = normalizar(filtro.trim());

  return (
    <div className="flex flex-col gap-5 pb-20">
      <PageHead title="Perfis e permissões">
        Crie perfis e escolha quais menus cada um pode abrir. As mudanças valem na hora para quem está conectado, e o
        servidor e o banco conferem as mesmas regras.
      </PageHead>

      <div className="grid items-start gap-4 lg:grid-cols-[290px_minmax(0,1fr)]">
        {/* ===== Perfis ===== */}
        <Panel>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-[14px] font-bold">Perfis</h2>
            <Button size="sm" disabled={!podeCriar} onClick={() => setForm({ nome: "", descricao: "" })}>
              <Plus className="mr-1 h-3.5 w-3.5" /> Novo perfil
            </Button>
          </div>
          {!perfis ? (
            <div className="flex items-center gap-2 py-6 text-[13px] text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
            </div>
          ) : (
            <ul className="flex flex-col gap-1">
              {perfis.map((p) => (
                <li key={p.chave}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => escolher(p.chave)}
                    onKeyDown={(ev) => ev.key === "Enter" && escolher(p.chave)}
                    className={cn(
                      "flex cursor-pointer items-center gap-2.5 rounded-[10px] border border-transparent px-3 py-2.5 hover:bg-secondary",
                      selecionado === p.chave && "border-primary bg-primary-soft hover:bg-primary-soft",
                    )}
                  >
                    {p.travado ? (
                      <Lock className="h-4 w-4 shrink-0 text-warning" />
                    ) : (
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-[11px] font-bold text-primary-dark">
                        {p.nome.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <b className="block truncate text-[13.5px]">{p.nome}</b>
                      <small className="text-[11.5px] text-muted-foreground">
                        {p.travado
                          ? "Acesso total, não editável"
                          : `${p.total_usuarios} usuário(s)${p.sistema ? " · do sistema" : ""}`}
                      </small>
                    </div>
                    {!p.sistema && p.editavel && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(ev) => ev.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Ações do perfil">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onClick={(ev) => ev.stopPropagation()}>
                          <DropdownMenuItem onClick={() => setForm({ chave: p.chave, nome: p.nome, descricao: p.descricao ?? "" })}>
                            <Pencil className="mr-2 h-3.5 w-3.5" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => setExcluir(p)}>
                            <Trash2 className="mr-2 h-3.5 w-3.5" /> Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* ===== Matriz ===== */}
        <Panel>
          <div className="mb-2 flex flex-wrap items-center gap-3">
            <Input placeholder="Filtrar menus" value={filtro} onChange={(e) => setFiltro(e.target.value)} className="max-w-[320px]" />
            {atual && (
              <span className="text-[13px] text-muted-foreground">
                Perfil: <b className="text-foreground">{atual.nome}</b>
              </span>
            )}
            {carregandoRegras && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>

          {atual?.travado && (
            <p className="mb-2 rounded-lg bg-warning-soft px-3 py-2 text-[12.5px] text-warning">
              O {atual.nome} tem acesso total à imobiliária e não pode ser editado.
            </p>
          )}

          {atual &&
            menuGroups.map((g) => {
              const linhas = linhasDoGrupo(g.id);
              const visiveis = termo
                ? linhas.filter(({ entry }) => normalizar(entry.label).includes(termo) || entry.id.includes(termo))
                : linhas;
              if (!visiveis.length) return null;
              const liberadas = linhas.filter(({ entry }) => situacao(entry).on).length;
              const temMarcavel = linhas.some(({ entry }) => {
                const s = situacao(entry);
                return !s.travada && !s.on;
              });
              return (
                <section key={g.id} className="mb-2">
                  <div className="mb-0.5 mt-2 flex items-center gap-2.5 rounded-[9px] bg-secondary px-4 py-2.5">
                    <b className="text-[11.5px] uppercase tracking-[0.07em]">{g.label}</b>
                    <span className="text-[12px] text-muted-foreground">
                      {liberadas} de {linhas.length} liberados
                    </span>
                    {atual.editavel && temMarcavel && (
                      <button
                        type="button"
                        onClick={() => liberarTodos(linhas)}
                        className="ml-auto text-[11px] font-bold uppercase tracking-[0.05em] text-primary hover:underline"
                      >
                        Liberar todos
                      </button>
                    )}
                  </div>
                  {visiveis.map(({ entry, depth }) => {
                    const s = situacao(entry);
                    const alterado = entry.id in draft;
                    return (
                      <div
                        key={entry.id}
                        className={cn(
                          "flex items-center gap-2.5 border-b py-2 pr-4",
                          depth === 0 ? "min-h-14" : "min-h-[50px]",
                          alterado && "bg-warning-soft",
                        )}
                        style={{
                          paddingLeft: 16 + depth * 28,
                          backgroundImage:
                            depth > 0
                              ? Array.from({ length: depth }, (_, i) => {
                                  const x = 29 + i * 28;
                                  return `linear-gradient(90deg, transparent ${x}px, var(--border) ${x}px, var(--border) ${x + 2}px, transparent ${x + 2}px)`;
                                }).join(",")
                              : undefined,
                        }}
                      >
                        <IconeDoMenu id={entry.id} icon={entry.icon} tamanho={depth === 0 ? 20 : 18} />
                        <div className="min-w-0">
                          <div className="truncate text-[13.5px] font-semibold">{entry.label}</div>
                          <code className="font-mono text-[11px] text-muted-foreground">{entry.id}</code>
                        </div>
                        <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                          {entry.kind === "acao" && <Badge tom="info">Ação</Badge>}
                          {entry.kind === "menu" && entry.emConstrucao && <Badge tom="muted">Em construção</Badge>}
                          {s.motivo && (
                            <Badge tom={s.motivo === "Sempre visível" ? "success" : s.motivo.startsWith("Requer") ? "muted" : "danger"}>
                              {s.motivo}
                            </Badge>
                          )}
                          {alterado && <Badge tom="warning">Alterado</Badge>}
                          {!s.travada && !s.on && !alterado && !(entry.id in base) && <Badge tom="warning">Negado por padrão</Badge>}
                          <Switch
                            checked={s.on}
                            disabled={s.travada}
                            onCheckedChange={(v) => alternar(entry.id, v)}
                            aria-label={`Liberar ${entry.label}`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </section>
              );
            })}
        </Panel>
      </div>

      {/* ===== Barra de salvar ===== */}
      {alteracoes.length > 0 && (
        <div className="fixed inset-x-4 bottom-4 z-30 mx-auto flex max-w-[960px] flex-wrap items-center gap-3 rounded-xl bg-foreground px-4 py-2.5 text-[13px] text-background shadow-[0_14px_30px_-10px_rgba(0,0,0,0.4)]">
          <b>
            {alteracoes.length} alteração(ões) não salva(s)
          </b>
          <span className="opacity-75">· valem na hora para os usuários do perfil {atual?.nome}</span>
          <div className="ml-auto flex gap-2">
            <Button variant="ghost" size="sm" className="text-background hover:bg-white/10 hover:text-background" onClick={() => setDraft({})}>
              Descartar
            </Button>
            <Button size="sm" onClick={() => void salvar()} disabled={salvando}>
              {salvando ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </div>
      )}

      {/* ===== Criar / editar perfil ===== */}
      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form?.chave ? "Editar perfil" : "Novo perfil"}</DialogTitle>
          </DialogHeader>
          {form && (
            <form id="form-perfil" onSubmit={gravarPerfil} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="p-nome">Nome</Label>
                <Input id="p-nome" value={form.nome} maxLength={40} onChange={(e) => setForm({ ...form, nome: e.target.value })} autoFocus />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="p-desc">Descrição</Label>
                <Input
                  id="p-desc"
                  value={form.descricao}
                  maxLength={160}
                  placeholder="Para que serve este perfil"
                  onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                />
              </div>
              {!form.chave && (
                <p className="text-[12.5px] text-muted-foreground">O perfil novo começa sem nenhum menu liberado.</p>
              )}
            </form>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)}>
              Cancelar
            </Button>
            <Button type="submit" form="form-perfil" disabled={!form || form.nome.trim().length < 2}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Confirmações ===== */}
      <AlertDialog open={!!excluir} onOpenChange={(o) => !o && setExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir o perfil {excluir?.nome}?</AlertDialogTitle>
            <AlertDialogDescription>
              {excluir?.total_usuarios
                ? `Há ${excluir.total_usuarios} usuário(s) com este perfil. Troque o perfil deles em Usuários antes de excluir.`
                : "As permissões deste perfil são apagadas. Não dá para desfazer."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={!!excluir?.total_usuarios}
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => void confirmarExclusao()}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!trocarPara} onOpenChange={(o) => !o && setTrocarPara(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Descartar as alterações?</AlertDialogTitle>
            <AlertDialogDescription>
              Há {alteracoes.length} alteração(ões) não salva(s) no perfil {atual?.nome}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar editando</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setDraft({});
                setSelecionado(trocarPara);
                setTrocarPara(null);
              }}
            >
              Descartar e trocar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Badge({ children, tom }: { children: React.ReactNode; tom: "info" | "success" | "danger" | "warning" | "muted" }) {
  const cls = {
    info: "bg-info-soft text-info",
    success: "bg-success-soft text-success",
    danger: "bg-primary-soft text-primary-dark",
    warning: "bg-warning-soft text-warning",
    muted: "bg-muted text-muted-foreground",
  } as const;
  return <span className={cn("whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold", cls[tom])}>{children}</span>;
}

// Super Admin não tem matriz: o banco recusa salvar regras para ele (salvar_permissoes_perfil).
void SUPER_ADMIN_ROLE;
