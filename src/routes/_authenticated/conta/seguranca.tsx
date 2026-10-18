import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Copy, Loader2, ShieldAlert, ShieldCheck, ShieldOff, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHead, Panel, Selo } from "@/components/page";
import { CampoCodigo, verificarCodigoTotp } from "@/components/mfa-challenge";
import { useCurrentUser } from "@/hooks/use-current-user";
import { supabase } from "@/integrations/supabase/client";

// Minha conta → Segurança: cadastro e remoção do 2º fator (TOTP) — auditoria de segurança, Fase 3.
// Qualquer usuário logado pode ativar; Super Admins precisam dele para credenciais e usuários
// (exigirSuperAdminComMfa em src/lib/authz.ts). Tudo acontece no navegador contra o GoTrue, com a
// sessão do próprio usuário — não há server function envolvida.

export const Route = createFileRoute("/_authenticated/conta/seguranca")({
  component: SegurancaPage,
});

const NOME_FATOR = "Portal Docusign";
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

type Fator = { id: string; friendly_name?: string; status: "verified" | "unverified"; created_at: string };
type Cadastro = { factorId: string; qr: string; secret: string };

function SegurancaPage() {
  const { nivel, loading } = useCurrentUser();
  const [fatores, setFatores] = useState<Fator[] | null>(null);
  const [erroLista, setErroLista] = useState<string | null>(null);
  const [cadastro, setCadastro] = useState<Cadastro | null>(null);
  const [removendo, setRemovendo] = useState<Fator | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const recarregar = useCallback(async () => {
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) {
      setErroLista(error.message);
      setFatores([]);
      return;
    }
    setErroLista(null);
    setFatores(data.all.filter((f) => f.factor_type === "totp") as Fator[]);
  }, []);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  const verificados = (fatores ?? []).filter((f) => f.status === "verified");
  const temFator = verificados.length > 0;

  async function iniciarCadastro() {
    setOcupado(true);
    try {
      // Fatores que ficaram pela metade (QR gerado mas nunca confirmado) bloqueiam um novo enroll com
      // o mesmo nome — limpa antes.
      for (const f of (fatores ?? []).filter((f) => f.status === "unverified")) {
        await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: NOME_FATOR });
      if (error) throw error;
      setCadastro({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
    } catch (e) {
      toast.error("Não foi possível iniciar o cadastro.", { description: msg(e) });
    } finally {
      setOcupado(false);
    }
  }

  async function cancelarCadastro() {
    if (!cadastro) return;
    setOcupado(true);
    await supabase.auth.mfa.unenroll({ factorId: cadastro.factorId });
    setCadastro(null);
    setOcupado(false);
    await recarregar();
  }

  async function confirmarCadastro(codigo: string) {
    if (!cadastro) return;
    setOcupado(true);
    try {
      await verificarCodigoTotp(cadastro.factorId, codigo);
      toast.success("Verificação em duas etapas ativada.", {
        description: "A partir do próximo login o código do aplicativo será pedido.",
      });
      setCadastro(null);
      await recarregar();
    } catch (e) {
      toast.error(msg(e));
      throw e; // o formulário limpa o campo
    } finally {
      setOcupado(false);
    }
  }

  async function desativar(fator: Fator, codigo?: string) {
    setOcupado(true);
    try {
      // Remover o fator exige sessão em aal2: se ainda está em aal1, pede o código antes.
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal?.currentLevel !== "aal2") {
        if (!codigo) {
          setRemovendo(fator);
          return;
        }
        await verificarCodigoTotp(fator.id, codigo);
      }
      const { error } = await supabase.auth.mfa.unenroll({ factorId: fator.id });
      if (error) throw error;
      toast.success("Verificação em duas etapas desativada.");
      setRemovendo(null);
      await recarregar();
    } catch (e) {
      toast.error("Não foi possível desativar.", { description: msg(e) });
      throw e;
    } finally {
      setOcupado(false);
    }
  }

  if (loading || fatores === null) {
    return (
      <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHead title="Segurança da conta">
        Verificação em duas etapas com aplicativo autenticador (Google Authenticator, Microsoft Authenticator, Authy…).
        Além da senha, o portal pede um código de 6 dígitos a cada login.
      </PageHead>

      {nivel === "superadmin" && !temFator && (
        <div className="flex items-start gap-3 rounded-xl border border-warning bg-warning-soft px-4 py-3 text-[13px] text-foreground">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <p>
            <strong>Super Admins precisam do 2º fator para alterar credenciais e usuários.</strong> Ative abaixo e
            entre novamente para liberar essas operações.
          </p>
        </div>
      )}

      {erroLista && (
        <div className="rounded-lg border border-primary bg-primary-soft px-3 py-2 text-[12.5px] text-primary-dark">
          Não foi possível consultar os fatores cadastrados: {erroLista}
        </div>
      )}

      <Panel
        title={
          <>
            <Smartphone className="h-4 w-4 text-muted-foreground" /> Aplicativo autenticador
          </>
        }
        sub={
          temFator
            ? "Sua conta está protegida pela verificação em duas etapas."
            : "Nenhum aplicativo cadastrado. Ative para proteger sua conta."
        }
      >
        {temFator ? (
          <ul className="flex flex-col gap-2">
            {verificados.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-success-soft text-success">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-[13.5px] font-semibold">{f.friendly_name || "Aplicativo autenticador"}</p>
                    <p className="text-[12px] text-muted-foreground">
                      Ativado em {new Date(f.created_at).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <Selo tom="success">Ativo</Selo>
                </div>
                <Button variant="outline" size="sm" disabled={ocupado} onClick={() => void desativar(f).catch(() => {})}>
                  <ShieldOff /> Desativar
                </Button>
              </li>
            ))}
          </ul>
        ) : cadastro ? (
          <FormCadastro cadastro={cadastro} ocupado={ocupado} onConfirmar={confirmarCadastro} onCancelar={cancelarCadastro} />
        ) : (
          <Button onClick={iniciarCadastro} disabled={ocupado}>
            {ocupado ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
            Ativar verificação em duas etapas
          </Button>
        )}
      </Panel>

      {removendo && (
        <Panel
          title="Confirme para desativar"
          sub="Por segurança, digite o código atual do aplicativo autenticador antes de remover a verificação em duas etapas."
        >
          <FormCodigo
            id="mfa-remover"
            rotulo="Desativar"
            destrutivo
            ocupado={ocupado}
            onConfirmar={(codigo) => desativar(removendo, codigo)}
            onCancelar={() => setRemovendo(null)}
          />
        </Panel>
      )}
    </div>
  );
}

function FormCadastro({
  cadastro,
  ocupado,
  onConfirmar,
  onCancelar,
}: {
  cadastro: Cadastro;
  ocupado: boolean;
  onConfirmar: (codigo: string) => Promise<void>;
  onCancelar: () => void;
}) {
  const [mostrarSecret, setMostrarSecret] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(cadastro.secret);
      toast.success("Chave copiada.");
    } catch {
      toast.error("Não foi possível copiar. Selecione e copie manualmente.");
    }
  }

  return (
    <div className="grid gap-6 md:grid-cols-[auto_1fr]">
      <div className="flex flex-col items-center gap-2">
        <div className="rounded-lg border bg-white p-2">
          <img src={cadastro.qr} alt="QR code para o aplicativo autenticador" className="h-[180px] w-[180px]" />
        </div>
        <button
          type="button"
          onClick={() => setMostrarSecret((v) => !v)}
          className="text-[12px] font-semibold text-primary hover:underline"
        >
          {mostrarSecret ? "Ocultar chave" : "Não consegue ler o QR? Digite a chave"}
        </button>
        {mostrarSecret && (
          <div className="flex items-center gap-1">
            <code className="select-all rounded bg-muted px-2 py-1 font-mono text-[12px] tracking-wider">
              {cadastro.secret}
            </code>
            <Button variant="ghost" size="icon" type="button" onClick={copiar} aria-label="Copiar chave">
              <Copy />
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <ol className="list-decimal space-y-1 pl-5 text-[13px] text-muted-foreground">
          <li>Abra o aplicativo autenticador no celular.</li>
          <li>
            Leia o QR code ou informe a chave manualmente (conta <strong>{NOME_FATOR}</strong>).
          </li>
          <li>Digite abaixo o código de 6 dígitos exibido no aplicativo.</li>
        </ol>
        <FormCodigo id="mfa-cadastro" rotulo="Confirmar e ativar" ocupado={ocupado} onConfirmar={onConfirmar} onCancelar={onCancelar} />
      </div>
    </div>
  );
}

/** Campo de código + botões confirmar/cancelar. `onConfirmar` deve lançar para o campo ser limpo. */
function FormCodigo({
  id,
  rotulo,
  destrutivo,
  ocupado,
  onConfirmar,
  onCancelar,
}: {
  id: string;
  rotulo: string;
  destrutivo?: boolean;
  ocupado: boolean;
  onConfirmar: (codigo: string) => Promise<void>;
  onCancelar: () => void;
}) {
  const [codigo, setCodigo] = useState("");

  async function confirmar(valor: string) {
    if (valor.length !== 6 || ocupado) return;
    try {
      await onConfirmar(valor);
    } catch {
      setCodigo("");
    }
  }

  function enviar(e: FormEvent) {
    e.preventDefault();
    void confirmar(codigo);
  }

  return (
    <form onSubmit={enviar} className="flex flex-col items-start gap-3">
      <CampoCodigo
        id={id}
        value={codigo}
        onChange={(v) => {
          setCodigo(v);
          if (v.length === 6) void confirmar(v);
        }}
        disabled={ocupado}
      />
      <div className="flex gap-2">
        <Button type="submit" variant={destrutivo ? "destructive" : "default"} disabled={ocupado || codigo.length !== 6}>
          {ocupado && <Loader2 className="animate-spin" />}
          {rotulo}
        </Button>
        <Button type="button" variant="ghost" disabled={ocupado} onClick={onCancelar}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
