// Modelo de dados dos guias do Centro de Treinamento. O conteúdo fica em arquivos de dados
// (ex.: disparo-em-massa.ts); a tela (guia-passo-a-passo.tsx) e a versão HTML autocontida
// (guia-html.ts) são geradas a partir do mesmo objeto, então os dois nunca divergem.

export type TipoAlerta = "critico" | "atencao" | "dica";

export interface Alerta {
  tipo: TipoAlerta;
  titulo: string;
  texto: string;
}

/** Print de tela. `arquivo` é relativo a /guias/<slug>/ (pasta public). */
export interface Print {
  arquivo: string;
  legenda: string;
}

export interface Exemplo {
  titulo: string;
  texto?: string;
  tabela?: { colunas: string[]; linhas: string[][] };
  conclusao?: string;
}

export interface Passo {
  id: string;
  titulo: string;
  /** Uma frase: o que a pessoa vai conseguir fazer ao fim do passo. */
  resumo: string;
  /** Quem executa: perfil mínimo exigido no portal. */
  perfil?: string;
  /** Menu do portal onde a tela fica, ex.: "Disparo em Massa › Novo Disparo". */
  onde?: string;
  /** Frases numeradas: o que fazer. */
  instrucoes: string[];
  prints: Print[];
  alertas?: Alerta[];
  exemplo?: Exemplo;
}

export interface Problema {
  sintoma: string;
  causa: string;
  solucao: string;
}

export interface Guia {
  slug: string;
  titulo: string;
  subtitulo: string;
  publico: string;
  atualizadoEm: string;
  passos: Passo[];
  problemas: Problema[];
  /** Quem acionar quando o guia não resolver. */
  suporte: string;
}

export const ROTULO_ALERTA: Record<TipoAlerta, string> = {
  critico: "Ponto crítico",
  atencao: "Atenção",
  dica: "Dica",
};

/** URL pública de um print do guia. */
export const urlDoPrint = (slug: string, arquivo: string) => `/guias/${slug}/${arquivo}`;
