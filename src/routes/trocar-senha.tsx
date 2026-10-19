import { createFileRoute, redirect, useNavigate, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Aviso, CampoSenha, LoginCard, LoginLayout, submitCls } from "@/components/login-layout";
import { trocarMinhaSenha } from "@/lib/conta.functions";
import { SENHA_REGRAS_TEXTO, validarPoliticaSenha } from "@/lib/senha";
import { sairDoPortal } from "@/lib/sessao";

// Troca de senha obrigatória (primeiro acesso ou senha definida pelo Super Admin) — mesmo modelo do
// Portal DP e do Gestão de Contratos. Enquanto a troca estiver pendente, nenhum menu é liberado.
// A troca é feita pelo servidor (trocarMinhaSenha), que confere a senha atual antes de liberar.

export const Route = createFileRoute("/trocar-senha")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: TrocarSenhaPage,
});

function TrocarSenhaPage() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const router = useRouter();
  const trocar = useServerFn(trocarMinhaSenha);
  const [senhaAtual, setSenhaAtual] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const nome = (user.user_metadata?.full_name as string | undefined) ?? user.email ?? "";

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    const erroPolitica = validarPoliticaSenha(senha);
    if (erroPolitica) return setErro(erroPolitica);
    if (senha !== confirmacao) return setErro("As senhas não conferem.");
    if (senha === senhaAtual) return setErro("A nova senha precisa ser diferente da atual.");
    setEnviando(true);
    try {
      await trocar({ data: { senhaAtual, novaSenha: senha } });
    } catch (err) {
      setEnviando(false);
      return setErro(err instanceof Error ? err.message : String(err));
    }
    setEnviando(false);
    toast.success("Senha alterada");
    await router.invalidate();
    navigate({ to: "/home", replace: true });
  }

  async function sair() {
    await sairDoPortal();
  }

  return (
    <LoginLayout>
      <LoginCard
        onSubmit={salvar}
        titulo="Defina uma nova senha"
        sub={`Olá, ${nome}. Por segurança, troque a sua senha antes de acessar o portal Disparo em Massa.`}
      >
        <CampoSenha
          id="senha-atual"
          label="Senha atual"
          autoComplete="current-password"
          value={senhaAtual}
          onChange={setSenhaAtual}
        />
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

        <p className="text-center text-xs text-muted-foreground">
          {SENHA_REGRAS_TEXTO} A nova senha precisa ser diferente da atual. Ao salvar, as suas
          outras sessões são encerradas.
        </p>

        <button
          type="submit"
          disabled={enviando || !senhaAtual || !senha || !confirmacao}
          className={submitCls}
        >
          {enviando && <Loader2 className="h-4 w-4 animate-spin" />}
          {enviando ? "Salvando…" : "Salvar e entrar"}
        </button>
        <button
          type="button"
          onClick={() => void sair()}
          disabled={enviando}
          className="self-center text-[12.5px] font-semibold text-primary hover:underline"
        >
          Sair
        </button>
      </LoginCard>
    </LoginLayout>
  );
}
