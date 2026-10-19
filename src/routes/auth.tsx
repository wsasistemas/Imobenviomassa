import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { conferirAcessoApp } from "@/lib/app-access";
import { useServerFn } from "@tanstack/react-start";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Mail } from "lucide-react";
import {
  Aviso,
  Campo,
  CampoSenha,
  LoginCard,
  LoginLayout,
  inputCls,
  submitCls,
} from "@/components/login-layout";
import { login } from "@/lib/auth.functions";
import { solicitarRedefinicaoSenha } from "@/lib/redefinir-senha.functions";

export const Route = createFileRoute("/auth")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/home" });
  },
  component: AuthPage,
});

function AuthPage() {
  const [esqueci, setEsqueci] = useState<string | null>(null);
  return (
    <LoginLayout>
      {esqueci === null ? (
        <FormLogin onEsqueci={setEsqueci} />
      ) : (
        <FormEsqueci emailInicial={esqueci} onVoltar={() => setEsqueci(null)} />
      )}
    </LoginLayout>
  );
}

// "Esqueceu a senha?": o servidor envia um link de uso único (30 min) pelo e-mail da imobiliária. A resposta
// é sempre a mesma, exista ou não a conta (src/lib/redefinir-senha.functions.ts).
function FormEsqueci({ emailInicial, onVoltar }: { emailInicial: string; onVoltar: () => void }) {
  const solicitar = useServerFn(solicitarRedefinicaoSenha);
  const [email, setEmail] = useState(emailInicial);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      const r = await solicitar({ data: { email } });
      setMensagem(r.mensagem);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível enviar o pedido.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <LoginCard
      onSubmit={enviar}
      titulo="Esqueceu a senha?"
      sub="Informe o seu e-mail de acesso. Enviaremos um link para você criar uma nova senha."
    >
      <Campo id="esqueci-email" label="E-mail" icon={<Mail className="h-[15px] w-[15px]" />}>
        <input
          id="esqueci-email"
          type="email"
          autoComplete="username"
          placeholder="seu@empresa.com.br"
          autoFocus
          value={email}
          disabled={!!mensagem}
          onChange={(e) => {
            setEmail(e.target.value);
            setErro(null);
          }}
          className={inputCls}
        />
      </Campo>

      {erro && <Aviso>{erro}</Aviso>}
      {mensagem && (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-[9px] text-[12.5px] leading-normal text-emerald-800">
          {mensagem} Confira também a caixa de spam.
        </div>
      )}

      {!mensagem && (
        <button type="submit" disabled={enviando || !email} className={submitCls}>
          {enviando && <Loader2 className="h-4 w-4 animate-spin" />}
          {enviando ? "Enviando…" : "Enviar link"}
        </button>
      )}
      <button
        type="button"
        onClick={onVoltar}
        className="inline-flex items-center justify-center gap-1.5 self-center text-[12.5px] font-semibold text-primary hover:underline"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Voltar para o login
      </button>
    </LoginCard>
  );
}

function FormLogin({ onEsqueci }: { onEsqueci: (email: string) => void }) {
  const navigate = useNavigate();
  const entrarNoServidor = useServerFn(login);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  function concluir(trocarSenha: boolean) {
    setLoading(false);
    toast.success("Bem-vindo!");
    navigate({ to: trocarSenha ? "/trocar-senha" : "/home" });
  }

  // O login passa pelo servidor (src/lib/auth.functions.ts): limite de tentativas por IP e por
  // conta, bloqueio temporário e registro de acesso. O navegador só recebe a sessão pronta.
  async function entrar(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErro(null);
    let trocarSenha = false;
    try {
      const sessao = await entrarNoServidor({ data: { email, password } });
      trocarSenha = sessao.trocar_senha;
      const { error } = await supabase.auth.setSession({
        access_token: sessao.access_token,
        refresh_token: sessao.refresh_token,
      });
      if (error) throw new Error("Não foi possível iniciar a sessão. Tente novamente.");
      // Central de acessos: sem permissão neste aplicativo, encerra a sessão e abre o pop-up.
      if (!(await conferirAcessoApp())) {
        setLoading(false);
        return;
      }
    } catch (err) {
      setLoading(false);
      setErro(err instanceof Error ? err.message : "Não foi possível entrar.");
      return;
    }
    concluir(trocarSenha);
  }

  return (
    <LoginCard
      onSubmit={entrar}
      titulo="Acessar o sistema"
      sub="Utilize suas credenciais corporativas"
    >
      <Campo id="login-email" label="E-mail" icon={<Mail className="h-[15px] w-[15px]" />}>
        <input
          id="login-email"
          type="email"
          autoComplete="username"
          placeholder="seu@empresa.com.br"
          autoFocus
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setErro(null);
          }}
          className={inputCls}
        />
      </Campo>

      <CampoSenha
        id="login-senha"
        label="Senha"
        autoComplete="current-password"
        value={password}
        onChange={(v) => {
          setPassword(v);
          setErro(null);
        }}
      />

      <button
        type="button"
        onClick={() => onEsqueci(email.trim())}
        className="-mt-1.5 self-end text-[12.5px] font-semibold text-primary hover:underline"
      >
        Esqueceu a senha?
      </button>

      {erro && <Aviso>{erro}</Aviso>}

      <button type="submit" disabled={loading || !email || !password} className={submitCls}>
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {loading ? "Entrando…" : "Entrar"}
      </button>

      {/* Sem auto-cadastro: contas são criadas por um administrador (Administração → Usuários). */}
      <p className="text-center text-xs text-muted-foreground">
        Não tem acesso? Peça a um administrador para criar a sua conta.
      </p>
    </LoginCard>
  );
}
