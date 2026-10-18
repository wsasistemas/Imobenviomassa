import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Crown, KeyRound, Loader2, LockOpen, Pencil, Plus, RefreshCw, ShieldCheck, User, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHead, Panel, SemAcesso, Selo } from "@/components/page";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  atualizarUsuario,
  criarUsuario,
  definirSenhaUsuario,
  desbloquearUsuario,
  listarPerfisAtribuiveis,
  listarUsuarios,
  type PerfilAtribuivel,
  type UsuarioPortal,
} from "@/lib/admin/users.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/administracao/usuarios")({
  component: UsuariosPage,
});

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

type Form = {
  id?: string;
  nome: string;
  email: string;
  perfil: string;
  ativo: boolean;
  trocar_senha: boolean;
};

/** Senha inicial gerada pelo servidor — aparece uma única vez, nunca é gravada. */
type SenhaGerada = { nome: string; email: string; senha: string };

const NOVO: Form = { nome: "", email: "", perfil: "analista", ativo: true, trocar_senha: true };

function UsuariosPage() {
  const { pode, loading } = useCurrentUser();
  if (loading) return null;
  if (!pode("usuarios")) return <SemAcesso texto="Seu perfil não tem acesso ao cadastro de usuários." />;
  return <Usuarios />;
}

function IconeNivel({ perfil }: { perfil: string | null }) {
  const Icone = perfil === "super_admin" ? Crown : perfil === "admin" ? ShieldCheck : perfil ? User : UserRound;
  return (
    <div
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]",
        perfil === "super_admin" ? "bg-warning-soft text-warning" : "bg-muted text-muted-foreground",
      )}
    >
      <Icone className="h-4 w-4" />
    </div>
  );
}

function Usuarios() {
  const { user } = useCurrentUser();
  const listar = useServerFn(listarUsuarios);
  const criar = useServerFn(criarUsuario);
  const atualizar = useServerFn(atualizarUsuario);
  const definirSenha = useServerFn(definirSenhaUsuario);
  const desbloquear = useServerFn(desbloquearUsuario);
  const listarPerfis = useServerFn(listarPerfisAtribuiveis);

  const [usuarios, setUsuarios] = useState<UsuarioPortal[] | null>(null);
  const [erroLista, setErroLista] = useState<string | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [senhaGerada, setSenhaGerada] = useState<SenhaGerada | null>(null);
  const [perfis, setPerfis] = useState<PerfilAtribuivel[]>([]);
  const nomeDoPerfil = (chave: string) => perfis.find((p) => p.chave === chave)?.nome ?? chave;

  const recarregar = useCallback(async () => {
    setUsuarios(null);
    try {
      setUsuarios(await listar());
      setErroLista(null);
    } catch (e) {
      setErroLista(msg(e));
      setUsuarios([]);
    }
  }, [listar]);

  useEffect(() => {
    void recarregar();
    listarPerfis()
      .then(setPerfis)
      .catch(() => setPerfis([]));
  }, [recarregar, listarPerfis]);

  const editando = !!form?.id;
  const proprio = !!form?.id && form.id === user?.id;
  const ativos = (usuarios ?? []).filter((u) => u.ativo).length;

  function abrirNovo() {
    setForm({ ...NOVO });
    setErro(null);
    setSenhaGerada(null);
  }

  function abrirEdicao(u: UsuarioPortal) {
    setForm({
      id: u.id,
      nome: u.nome,
      email: u.email,
      perfil: u.perfil,
      ativo: u.ativo,
      trocar_senha: u.trocar_senha,
    });
    setErro(null);
    setSenhaGerada(null);
  }

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    setErro(null);
    setSalvando(true);
    try {
      if (editando) {
        await atualizar({
          data: { userId: form.id!, nome: form.nome, perfil: form.perfil, ativo: form.ativo, trocar_senha: form.trocar_senha },
        });
        toast.success("Usuário atualizado", { description: `${form.nome} (${nomeDoPerfil(form.perfil)}${form.ativo ? "" : ", inativo"}).` });
        setForm(null);
      } else {
        const email = form.email.trim().toLowerCase();
        const r = await criar({ data: { nome: form.nome, email, perfil: form.perfil, ativo: form.ativo } });
        if (r?.aviso) {
          toast.warning("Usuário vinculado", { description: r.aviso, duration: 12000 });
          setForm(null);
        } else {
          toast.success("Usuário criado", { description: `${form.nome} (${nomeDoPerfil(form.perfil)}).` });
          setForm(null);
          if (r?.senhaInicial) setSenhaGerada({ nome: form.nome, email, senha: r.senhaInicial });
        }
      }
      await recarregar();
    } catch (e2) {
      setErro(msg(e2));
    } finally {
      setSalvando(false);
    }
  }

  async function gerarNovaSenha() {
    if (!form?.id) return;
    setErro(null);
    if (!window.confirm(`Gerar uma nova senha de acesso para ${form.nome}?\n\nA senha anterior deixa de valer, todas as sessões da pessoa são encerradas (inclusive nos outros sistemas Calper) e ela troca por uma própria no próximo acesso.`)) return;
    setSalvando(true);
    try {
      const r = await definirSenha({ data: { userId: form.id } });
      toast.success("Nova senha gerada", { description: `${form.nome}: entregue a senha por um canal seguro. No próximo acesso a troca é obrigatória.` });
      setSenhaGerada({ nome: form.nome, email: form.email, senha: r.senhaInicial });
      setForm(null);
      await recarregar();
    } catch (e) {
      setErro(msg(e));
    } finally {
      setSalvando(false);
    }
  }

  async function liberarBloqueio(u: UsuarioPortal) {
    if (!window.confirm(`Desbloquear o acesso de ${u.nome || u.email}?\n\nO bloqueio foi causado por excesso de tentativas de login com senha errada.`)) return;
    try {
      await desbloquear({ data: { userId: u.id } });
      toast.success("Conta desbloqueada", { description: `${u.nome || u.email} já pode tentar entrar de novo.` });
      await recarregar();
    } catch (e) {
      toast.error("Não foi possível desbloquear", { description: msg(e) });
    }
  }

  const bloqueadoAte = (u: UsuarioPortal) =>
    u.bloqueado_ate && new Date(u.bloqueado_ate).getTime() > Date.now()
      ? new Date(u.bloqueado_ate).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
      : null;

  return (
    <div className="flex flex-col gap-5">
      <PageHead
        title="Usuários"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => void recarregar()} disabled={usuarios === null}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Atualizar
            </Button>
            <Button size="sm" onClick={abrirNovo}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Novo usuário
            </Button>
          </>
        }
      >
        Quem tem acesso ao portal Disparo em Massa e com qual perfil. O login é o e-mail da própria pessoa: a senha inicial
        é gerada pelo sistema (aqui ou em "Gerar nova senha"), mostrada uma única vez, e a pessoa troca no próximo acesso.
      </PageHead>

      {senhaGerada && <PainelSenhaGerada dados={senhaGerada} onFechar={() => setSenhaGerada(null)} />}

      <div className="grid gap-5 [grid-template-columns:repeat(auto-fit,minmax(320px,1fr))]">
        <Panel
          title="Usuários cadastrados"
          sub={usuarios === null ? "Carregando…" : `${usuarios.length} usuário(s), ${ativos} ativo(s).`}
        >
          {erroLista && (
            <div className="mb-3 rounded-lg border border-primary bg-primary-soft px-3 py-2 text-[12.5px] text-primary-dark">
              Não foi possível carregar os usuários: {erroLista}
            </div>
          )}
          {usuarios === null ? (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
            </div>
          ) : usuarios.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-dimmer">Nenhum usuário cadastrado.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {usuarios.map((u) => (
                <li
                  key={u.id}
                  className={cn(
                    "flex items-center gap-3 rounded-[10px] border bg-card p-3",
                    form?.id === u.id && "border-l-[3px] border-l-primary",
                  )}
                >
                  <IconeNivel perfil={u.perfil} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <strong className="truncate text-[13px]">{u.nome || u.email}</strong>
                      {u.id === user?.id && <Selo tom="info">você</Selo>}
                      {!u.ativo && <Selo>inativo</Selo>}
                      {u.trocar_senha && <Selo tom="warning">troca de senha pendente</Selo>}
                      {bloqueadoAte(u) && <Selo tom="warning">bloqueado até {bloqueadoAte(u)}</Selo>}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {u.perfil_nome} · {u.email}
                    </p>
                  </div>
                  {bloqueadoAte(u) && (
                    <Button variant="outline" size="sm" onClick={() => void liberarBloqueio(u)} title="Liberar o bloqueio por tentativas de login">
                      <LockOpen className="mr-1 h-3.5 w-3.5" /> desbloquear
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => abrirEdicao(u)}>
                    <Pencil className="mr-1 h-3.5 w-3.5" /> editar
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {form && (
          <Panel title={editando ? "Editar usuário" : "Novo usuário"}>
            <form onSubmit={salvar} className="flex flex-col gap-3" noValidate>
              <Campo id="u-nome" label="Nome">
                <Input id="u-nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} autoFocus />
              </Campo>
              <Campo id="u-email" label="E-mail (login)">
                <Input
                  id="u-email"
                  type="email"
                  placeholder="nome@imobiliaria.com.br"
                  value={form.email}
                  disabled={editando}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </Campo>

              {!editando && (
                <Nota>
                  A senha inicial é gerada pelo sistema ao salvar e aparece uma única vez. Entregue-a por um canal seguro:
                  no primeiro acesso a pessoa é obrigada a trocá-la.
                </Nota>
              )}

              <Campo id="u-nivel" label="Perfil de acesso">
                <select
                  id="u-nivel"
                  value={form.perfil}
                  disabled={proprio}
                  onChange={(e) => setForm({ ...form, perfil: e.target.value })}
                  className="h-9 w-full rounded-lg border border-input bg-card px-2.5 text-[13px]"
                >
                  {!perfis.some((p) => p.chave === form.perfil) && <option value={form.perfil}>{nomeDoPerfil(form.perfil)}</option>}
                  {perfis.map((p) => (
                    <option key={p.chave} value={p.chave}>
                      {p.nome}
                    </option>
                  ))}
                </select>
              </Campo>
              <Nota>
                {perfis.find((p) => p.chave === form.perfil)?.descricao ??
                  "As permissões de cada perfil ficam em Configurações › Perfis e permissões."}
              </Nota>

              <label className="flex cursor-pointer items-center gap-2 text-[13px] text-muted-foreground">
                <input
                  type="checkbox"
                  className="accent-primary"
                  checked={form.ativo}
                  disabled={proprio}
                  onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
                />
                Acesso ativo
              </label>

              {editando ? (
                <>
                  <label className="flex cursor-pointer items-center gap-2 text-[13px] text-muted-foreground">
                    <input
                      type="checkbox"
                      className="accent-primary"
                      checked={form.trocar_senha}
                      disabled={proprio}
                      onChange={(e) => setForm({ ...form, trocar_senha: e.target.checked })}
                    />
                    Exigir troca de senha no próximo acesso
                  </label>
                  <Nota>
                    Enquanto a troca estiver pendente, a pessoa só consegue definir uma senha nova — nenhum menu é
                    liberado. A exigência desliga sozinha quando a senha é trocada.
                  </Nota>
                </>
              ) : (
                <Nota>Todo usuário novo precisa definir a própria senha no primeiro acesso.</Nota>
              )}

              {erro && (
                <div className="rounded-lg border border-primary bg-primary-soft px-3 py-2 text-[12.5px] text-primary-dark">
                  ⚠ {erro}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <Button type="submit" size="sm" disabled={salvando}>
                  {salvando ? "Salvando…" : "Salvar usuário"}
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setForm(null)}>
                  Cancelar
                </Button>
                {editando && !proprio && (
                  <Button type="button" size="sm" variant="outline" onClick={() => void gerarNovaSenha()} disabled={salvando}>
                    <KeyRound className="mr-1.5 h-3.5 w-3.5" /> Gerar nova senha
                  </Button>
                )}
              </div>
              <Nota>O que cada perfil pode fazer está em Administração › Perfis.</Nota>
            </form>
          </Panel>
        )}
      </div>
    </div>
  );
}

function Campo({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

/** Senha inicial gerada pelo servidor: mostrada uma única vez, com botão de copiar. */
function PainelSenhaGerada({ dados, onFechar }: { dados: SenhaGerada; onFechar: () => void }) {
  const [copiada, setCopiada] = useState(false);
  async function copiar() {
    try {
      await navigator.clipboard.writeText(dados.senha);
      setCopiada(true);
      setTimeout(() => setCopiada(false), 3000);
    } catch {
      toast.error("Não foi possível copiar. Selecione e copie manualmente.");
    }
  }
  return (
    <Panel title="Senha inicial gerada">
      <div className="flex flex-col gap-3">
        <p className="text-[13px] text-muted-foreground">
          Senha de <strong>{dados.nome}</strong> ({dados.email}). Ela aparece <strong>só agora</strong>: copie e entregue
          por um canal seguro. No primeiro acesso a pessoa é obrigada a trocá-la.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <code className="select-all rounded-lg border bg-muted px-3 py-2 font-mono text-[15px] tracking-wide">{dados.senha}</code>
          <Button type="button" size="sm" variant="outline" onClick={() => void copiar()}>
            {copiada ? "Copiada" : "Copiar"}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={onFechar}>
            Fechar
          </Button>
        </div>
      </div>
    </Panel>
  );
}

function Nota({ children }: { children: React.ReactNode }) {
  return <p className="text-xs leading-relaxed text-muted-foreground">{children}</p>;
}
