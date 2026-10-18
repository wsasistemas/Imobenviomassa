import { useEffect, useRef, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { APP_ACCESS_DENIED_EVENT, APP_ACCESS_DENIED_MESSAGE } from "@/lib/app-access";

/**
 * Pop-up padrão Calper de bloqueio (Permissões por aplicativo): abre quando o login é recusado ou
 * quando quem já estava logado foi bloqueado (a sessão já foi encerrada). Montado uma vez no __root.
 */
export function AppAccessDenied() {
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    const abrir = () => setAberto(true);
    window.addEventListener(APP_ACCESS_DENIED_EVENT, abrir);
    return () => window.removeEventListener(APP_ACCESS_DENIED_EVENT, abrir);
  }, []);

  return aberto ? <Janela onFechar={() => setAberto(false)} /> : null;
}

function Janela({ onFechar }: { onFechar: () => void }) {
  const botao = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    botao.current?.focus();
    const aoTeclar = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [onFechar]);

  return (
    <>
      <div className="fixed inset-0 z-[100] bg-[rgba(23,24,28,0.55)] backdrop-blur-[2px]" onClick={onFechar} />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="acesso-negado-titulo"
        aria-describedby="acesso-negado-texto"
        className="fixed left-1/2 top-1/2 z-[101] w-[min(380px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-card px-6 pb-5 pt-7 text-center shadow-[0_24px_60px_-20px_rgba(23,24,28,0.45)]"
      >
        <div className="relative mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary-soft text-primary" aria-hidden="true">
          <span className="absolute inset-0 animate-ping rounded-full bg-primary/15" />
          <ShieldAlert className="relative h-[30px] w-[30px]" />
        </div>
        <h2 id="acesso-negado-titulo" className="mb-1.5 text-[17px] font-bold">
          Acesso bloqueado
        </h2>
        <p id="acesso-negado-texto" className="mb-5 text-[13px] leading-relaxed text-muted-foreground">
          {APP_ACCESS_DENIED_MESSAGE}
        </p>
        <button
          ref={botao}
          type="button"
          onClick={onFechar}
          className="inline-flex h-9 min-w-[120px] items-center justify-center rounded-lg bg-primary px-4 text-[13px] font-semibold text-primary-foreground hover:bg-primary-dark"
        >
          Entendi
        </button>
      </div>
    </>
  );
}
