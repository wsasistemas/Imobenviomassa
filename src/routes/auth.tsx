import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { conferirAcessoApp } from "@/lib/app-access";
import { useServerFn } from "@tanstack/react-start";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Mail } from "lucide-react";
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

export const Route = createFileRoute("/auth")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/home" });
  },
  component: AuthPage,
});

function AuthPage() {
  return (
    <LoginLayout>
      <FormLogin />
    </LoginLayout>
  );
}

function FormLogin() {
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
