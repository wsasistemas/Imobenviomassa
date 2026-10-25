import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Aviso, CampoSenha, LoginCard, LoginLayout, submitCls } from "@/components/login-layout";
import { conferirLinkRedefinicao, redefinirSenhaComToken } from "@/lib/redefinir-senha.functions";
import { SENHA_REGRAS_TEXTO, validarPoliticaSenha } from "@/lib/senha";

// Link do e-mail "Esqueceu a senha?" (/redefinir-senha?token=…). Fora de _authenticated: quem chega aqui não
// tem sessão. O token só é conferido e consumido no servidor (src/lib/redefinir-senha.functions.ts).

export const Route = createFileRoute("/redefinir-senha")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    token: typeof s.token === "string" ? s.token : "",
  }),
  component: RedefinirSenhaPage,
});

function RedefinirSenhaPage() {
  // Guardado em estado: logo abaixo o token sai da barra de endereço.
  const [token] = useState(Route.useSearch().token);
  const navigate = useNavigate();
  const conferir = useServerFn(conferirLinkRedefinicao);
  const redefinir = useServerFn(redefinirSenhaComToken);
  const [link, setLink] = useState<{ valido: boolean; email: string | null } | null>(null);
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    // O token não fica na barra de endereço nem no histórico depois de lido.
    if (token) window.history.replaceState(null, "", "/redefinir-senha");
    conferir({ data: { token } })
      .then(setLink)
      .catch(() => setLink({ valido: false, email: null }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    const erroPolitica = validarPoliticaSenha(senha);
    if (erroPolitica) return setErro(erroPolitica);
    if (senha !== confirmacao) return setErro("As senhas não conferem.");
    setEnviando(true);
    try {
      await redefinir({ data: { token, novaSenha: senha } });
    } catch (err) {
      setEnviando(false);
      return setErro(err instanceof Error ? err.message : String(err));
    }
    // Sessão antiga neste navegador (se houver) já foi revogada no servidor.
    await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
    setEnviando(false);
    toast.success("Senha redefinida. Entre com a nova senha.");
    navigate({ to: "/auth", replace: true });
  }

  if (!link) {
    return (
      <LoginLayout>
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </LoginLayout>
    );
  }

  if (!link.valido) {
    return (
      <LoginLayout>
        <LoginCard
          onSubmit={(e) => e.preventDefault()}
          titulo="Link inválido"
          sub="Não foi possível usar este link."
        >
          <Aviso>
            Este link é inválido, expirou ou já foi usado. Os links valem por 30 minutos e uma única
            vez.
          </Aviso>
          <Link to="/auth" className={submitCls}>
            Voltar para o login
          </Link>
        </LoginCard>
      </LoginLayout>
    );
  }

  return (
    <LoginLayout>
      <LoginCard
        onSubmit={salvar}
        titulo="Crie uma nova senha"
        sub={`Conta ${link.email}. A nova senha vale também no ImobSystem, Imobsuprimentos e ImobDoces.`}
      >
        <CampoSenha
          id="nova-senha"
          label="Nova senha"
          autoComplete="new-password"
          value={senha}
          onChange={setSenha}
        />
        <CampoSenha
          id="nova-senha-2"
          label="Confirmar senha"
          autoComplete="new-password"
          value={confirmacao}
          onChange={setConfirmacao}
        />

        {erro && <Aviso>{erro}</Aviso>}

        <p className="text-[13px] leading-relaxed text-muted-foreground">
          {SENHA_REGRAS_TEXTO} Ao salvar, todas as sessões abertas da conta são encerradas.
        </p>

        <button type="submit" disabled={enviando || !senha || !confirmacao} className={submitCls}>
          <span className="inline-flex items-center gap-2">
            {enviando && <Loader2 className="h-4 w-4 animate-spin" />}
            {enviando ? "Salvando…" : "Salvar nova senha"}
          </span>
        </button>
        <Link
          to="/auth"
          className="self-end py-2.5 text-[15px] font-semibold text-primary-dark underline underline-offset-4 hover:text-primary"
        >
          Voltar para o login
        </Link>
      </LoginCard>
    </LoginLayout>
  );
}
