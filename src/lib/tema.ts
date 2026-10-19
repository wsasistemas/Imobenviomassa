import { useEffect, useState } from "react";

// Tema claro/escuro escolhido pelo usuário no botão de sol/lua do cabeçalho. Fica no navegador (localStorage)
// e vale como classe `dark` no <html>; as cores vêm dos tokens de src/styles.css (:root e .dark).
// O SCRIPT_TEMA roda no <head> antes da página pintar, para não piscar o tema errado.

export type Tema = "claro" | "escuro";

const CHAVE = "imobenviomassa:tema";
const EVENTO = "imobenviomassa:tema";

/** Padrão claro; só fica escuro quando o usuário escolheu. */
export const SCRIPT_TEMA = `try{if(localStorage.getItem("${CHAVE}")==="escuro")document.documentElement.classList.add("dark")}catch(e){}`;

function lerTema(): Tema {
  if (typeof document === "undefined") return "claro";
  return document.documentElement.classList.contains("dark") ? "escuro" : "claro";
}

export function aplicarTema(tema: Tema) {
  document.documentElement.classList.toggle("dark", tema === "escuro");
  try {
    localStorage.setItem(CHAVE, tema);
  } catch {
    /* navegação privada: vale só nesta aba */
  }
  window.dispatchEvent(new CustomEvent(EVENTO));
}

export function useTema(): [Tema, (t: Tema) => void] {
  const [tema, setTema] = useState<Tema>("claro");
  useEffect(() => {
    setTema(lerTema());
    const sync = () => setTema(lerTema());
    window.addEventListener(EVENTO, sync);
    return () => window.removeEventListener(EVENTO, sync);
  }, []);
  return [tema, aplicarTema];
}
