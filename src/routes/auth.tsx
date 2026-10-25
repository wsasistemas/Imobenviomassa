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
  LinhaLembrar,
  LoginCard,
  LoginLayout,
  NotaEntrada,
  iconeCampo,
  inputCls,
  linkEntradaCls,
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
      titulo="Recuperar senha"
      sub={mensagem ? undefined : "Informe o seu e-mail de acesso. Enviaremos um link de uso único, válido por 30 minutos."}
    >
      {mensagem && <Aviso tom="ok">{mensagem} Confira também a caixa de spam.</Aviso>}
      <Campo id="esqueci-email" label="E-mail" icon={iconeCampo(Mail)}>
        <input
          id="esqueci-email"
          type="email"
          autoComplete="username"
          placeholder="voce@suaempresa.com.br"
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

      {!mensagem && (
        <button type="submit" disabled={enviando || !email} className={submitCls}>
          <span className="inline-flex items-center gap-2">
            {enviando && <Loader2 className="h-4 w-4 animate-spin" />}
            {enviando ? "Enviando…" : "Enviar link"}
          </span>
        </button>
      )}
      <button
        type="button"
        onClick={onVoltar}
        className="flex h-[52px] w-full items-center justify-between border border-foreground px-[18px] text-[17px] font-bold transition-colors hover:bg-foreground/5"
      >
        Voltar para entrar <span aria-hidden="true">←</span>
      </button>
    </LoginCard>
  );
}

// "Lembrar meu e-mail": só o e-mail, no próprio navegador (nunca a senha). Sem armazenamento, segue sem lembrar.
const CHAVE_EMAIL_LEMBRADO = "imobenviomassa:email-lembrado";
function lerEmailLembrado(): string {
  try {
    return localStorage.getItem(CHAVE_EMAIL_LEMBRADO) ?? "";
  } catch {
    return "";
  }
}
function guardarEmailLembrado(email: string) {
  try {
    if (email) localStorage.setItem(CHAVE_EMAIL_LEMBRADO, email);
    else localStorage.removeItem(CHAVE_EMAIL_LEMBRADO);
  } catch {
    /* navegador sem armazenamento: não lembra */
  }
}

function FormLogin({ onEsqueci }: { onEsqueci: (email: string) => void }) {
  const navigate = useNavigate();
  const entrarNoServidor = useServerFn(login);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState(lerEmailLembrado);
  const [lembrar, setLembrar] = useState(() => lerEmailLembrado() !== "");
  const [password, setPassword] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  function concluir(trocarSenha: boolean) {
    guardarEmailLembrado(lembrar ? email.trim() : "");
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
    <LoginCard onSubmit={entrar} titulo="Entrar" sub="Acesse o sistema com o seu e-mail.">
      {erro && <Aviso>{erro}</Aviso>}
      <Campo id="login-email" label="E-mail" icon={iconeCampo(Mail)}>
        <input
          id="login-email"
          type="email"
          autoComplete="username"
          placeholder="voce@suaempresa.com.br"
          autoFocus={!email}
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

      <LinhaLembrar lembrar={lembrar} onLembrar={setLembrar}>
        <button type="button" onClick={() => onEsqueci(email.trim())} className={linkEntradaCls}>
          Esqueceu a senha?
        </button>
      </LinhaLembrar>

      <button type="submit" disabled={loading || !email || !password} className={submitCls}>
        <span className="inline-flex items-center gap-2">
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {loading ? "Entrando…" : "Entrar"}
        </span>
      </button>

      {/* Sem auto-cadastro: contas são criadas por um administrador (Administração → Usuários). */}
      <NotaEntrada>
        O acesso é criado pelo administrador da sua empresa. O mesmo login vale nos outros sistemas da WSA que a
        sua empresa usa.
      </NotaEntrada>
    </LoginCard>
  );
}
