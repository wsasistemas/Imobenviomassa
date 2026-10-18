// Desafio do 2º fator (TOTP) após o login — auditoria de segurança, Fase 3.
//
// Fluxo: o login (src/routes/auth.tsx) grava a sessão (aal1) e pergunta ao GoTrue o nível de garantia.
// Se o usuário tem fator TOTP verificado (nextLevel = aal2) e a sessão ainda está em aal1, a tela de
// login renderiza <MfaChallenge/> em vez de navegar. O código correto eleva a sessão para aal2 (o JWT
// passa a ter a claim `aal: "aal2"`, exigida no servidor por exigirAal2 em src/lib/authz.ts).
//
// Guard de sessão parcial: `precisaDeDesafioMfa()` responde se a sessão atual está "pela metade"
// (fator cadastrado, mas ainda em aal1) — use no beforeLoad de src/routes/_authenticated/route.tsx:
//   if (await precisaDeDesafioMfa()) { await supabase.auth.signOut({ scope: "local" }); throw redirect({ to: "/auth" }); }
// (sem isso, quem fecha a aba no meio do desafio voltaria logado com aal1).
//
// Limites: 5 erros de código nesta tela → signOut local e volta ao login; o GoTrue ainda aplica o
// próprio rate limit de MFA por conta.

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Aviso, LoginCard, submitCls } from "@/components/login-layout";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

export const MAX_ERROS_MFA = 5;

/** Sessão autenticada só com senha, mas com fator TOTP cadastrado: precisa passar pelo desafio. */
export async function precisaDeDesafioMfa(): Promise<boolean> {
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error || !data) return false;
  return data.nextLevel === "aal2" && data.currentLevel === "aal1";
}

/** Faz challenge + verify no fator informado. Lança Error com mensagem amigável. */
export async function verificarCodigoTotp(factorId: string, code: string): Promise<void> {
  const codigo = code.replace(/\D/g, "");
  if (codigo.length !== 6) throw new Error("Informe os 6 dígitos do aplicativo autenticador.");
  const { data: desafio, error: erroDesafio } = await supabase.auth.mfa.challenge({ factorId });
  if (erroDesafio || !desafio) throw new Error("Não foi possível iniciar a verificação. Tente novamente.");
  const { error } = await supabase.auth.mfa.verify({ factorId, challengeId: desafio.id, code: codigo });
  if (error) {
    const m = error.message.toLowerCase();
    if (m.includes("rate") || m.includes("too many")) throw new Error("Muitas tentativas. Aguarde alguns minutos.");
    throw new Error("Código inválido ou expirado.");
  }
}

/** Primeiro fator TOTP verificado da conta (null se não houver). */
export async function fatorTotpVerificado(): Promise<{ id: string; friendly_name?: string } | null> {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error || !data) return null;
  return data.totp[0] ?? null;
}

/** Campo de 6 dígitos reutilizado na tela de login e em Minha conta → Segurança. */
export function CampoCodigo({
  value,
  onChange,
  disabled,
  autoFocus = true,
  id = "mfa-codigo",
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  id?: string;
}) {
  const slot = "h-11 w-10 text-base font-semibold";
  return (
    <InputOTP
      id={id}
      maxLength={6}
      value={value}
      onChange={onChange}
      disabled={disabled}
      autoFocus={autoFocus}
      inputMode="numeric"
      pattern="^[0-9]*$"
      autoComplete="one-time-code"
      containerClassName="justify-center"
    >
      <InputOTPGroup>
        {[0, 1, 2].map((i) => (
          <InputOTPSlot key={i} index={i} className={slot} />
        ))}
      </InputOTPGroup>
      <span className="text-dimmer">–</span>
      <InputOTPGroup>
        {[3, 4, 5].map((i) => (
          <InputOTPSlot key={i} index={i} className={slot} />
        ))}
      </InputOTPGroup>
    </InputOTP>
  );
}

/** Cartão de desafio na tela de login. `onOk` é chamado com a sessão já em aal2. */
export function MfaChallenge({ onOk, onCancelar }: { onOk: () => void | Promise<void>; onCancelar: () => void }) {
  const [factorId, setFactorId] = useState<string | null>(null);
  const [erroFator, setErroFator] = useState<string | null>(null);
  const [codigo, setCodigo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const erros = useRef(0);

  useEffect(() => {
    let ativo = true;
    fatorTotpVerificado().then((f) => {
      if (!ativo) return;
      if (f) setFactorId(f.id);
      else setErroFator("Nenhum aplicativo autenticador cadastrado nesta conta.");
    });
    return () => {
      ativo = false;
    };
  }, []);

  async function sair() {
    await supabase.auth.signOut({ scope: "local" });
    onCancelar();
  }

  async function confirmar(valor: string) {
    if (!factorId || loading || valor.length !== 6) return;
    setLoading(true);
    setErro(null);
    try {
      await verificarCodigoTotp(factorId, valor);
    } catch (err) {
      erros.current += 1;
      setCodigo("");
      setLoading(false);
      const restam = MAX_ERROS_MFA - erros.current;
      if (restam <= 0) {
        await sair();
        return;
      }
      setErro(`${err instanceof Error ? err.message : "Código inválido."} Restam ${restam} tentativa${restam === 1 ? "" : "s"}.`);
      return;
    }
    await onOk();
  }

  function enviar(e: FormEvent) {
    e.preventDefault();
    void confirmar(codigo);
  }

  return (
    <LoginCard
      onSubmit={enviar}
      titulo="Verificação em duas etapas"
      sub="Digite o código de 6 dígitos do seu aplicativo autenticador"
    >
      <div className="flex items-center justify-center py-1 text-primary">
        <ShieldCheck className="h-8 w-8" />
      </div>

      <CampoCodigo
        value={codigo}
        onChange={(v) => {
          setCodigo(v);
          setErro(null);
          // dispara ao completar o 6º dígito, sem esperar o Enter
          if (v.length === 6) void confirmar(v);
        }}
        disabled={!factorId || loading}
      />

      {(erro || erroFator) && <Aviso>{erro ?? erroFator}</Aviso>}

      <button type="submit" disabled={!factorId || loading || codigo.length !== 6} className={submitCls}>
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {loading ? "Verificando…" : "Confirmar"}
      </button>

      <button
        type="button"
        onClick={sair}
        disabled={loading}
        className="text-center text-xs font-semibold text-muted-foreground hover:text-foreground hover:underline"
      >
        Cancelar e voltar ao login
      </button>
    </LoginCard>
  );
}
