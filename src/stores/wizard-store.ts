import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type OrigemTipo = "totvs" | "excel";
export type CanalEnvio = "whatsapp" | "email" | "ambos";

export type CompradorRow = {
  id: string;
  nome: string;
  cpf: string | null;
  telefone: string | null;
  email: string | null;
  empreendimento: string | null;
  bloco: string | null;
  unidade: string | null;
  dados_extras?: Record<string, unknown>;
};

export type ModeloDocusign = {
  id: string;
  nome: string;
  descricao: string;
  papeis: string[];
  placeholders: string[];
};

export type ConfigAssinatura = {
  ordem: ("comprador" | "conjuge" | "fiador")[];
  segundo_comprador: "assina" | "cc" | "nenhum";
  lembretes_dias: number;
  expira_dias: number;
  idioma: "pt-BR" | "en-US" | "es";
};

export type WizardState = {
  nome: string;
  origem: OrigemTipo | null;
  filtros_totvs: {
    empreendimento_id?: string;
    empreendimento_nome?: string;
    empreendimento_codigo?: string;
  };

  compradores: CompradorRow[];
  selecionados: string[];
  modelo: ModeloDocusign | null;
  config_assinatura: ConfigAssinatura;
  mensagem_whatsapp: string;
  canais: CanalEnvio;
  setNome: (v: string) => void;
  setOrigem: (v: OrigemTipo) => void;
  setFiltrosTotvs: (v: WizardState["filtros_totvs"]) => void;
  setCompradores: (v: CompradorRow[]) => void;
  setSelecionados: (v: string[]) => void;
  setModelo: (v: ModeloDocusign | null) => void;
  setConfig: (v: Partial<ConfigAssinatura>) => void;
  setMensagem: (v: string) => void;
  setCanais: (v: CanalEnvio) => void;

  reset: () => void;
};


const initial = {
  nome: "",
  origem: null as OrigemTipo | null,
  filtros_totvs: {},
  compradores: [] as CompradorRow[],
  selecionados: [] as string[],
  modelo: null as ModeloDocusign | null,
  config_assinatura: {
    ordem: [] as ConfigAssinatura["ordem"],
    segundo_comprador: "nenhum" as ConfigAssinatura["segundo_comprador"],
    lembretes_dias: 3,
    expira_dias: 15,
    idioma: "pt-BR" as const,
  },
  mensagem_whatsapp:
    "Olá, sua documentação do empreendimento está pronta para assinatura.",
  canais: "ambos" as CanalEnvio,
};


export const useWizardStore = create<WizardState>()(
  persist(
    (set) => ({
      ...initial,
      setNome: (nome) => set({ nome }),
      setOrigem: (origem) => set({ origem }),
      setFiltrosTotvs: (filtros_totvs) => set({ filtros_totvs }),
      setCompradores: (compradores) => set({ compradores, selecionados: [] }),
      setSelecionados: (selecionados) => set({ selecionados }),
      setModelo: (modelo) => set({ modelo }),
      setConfig: (partial) =>
        set((s) => ({ config_assinatura: { ...s.config_assinatura, ...partial } })),
      setMensagem: (mensagem_whatsapp) => set({ mensagem_whatsapp }),
      setCanais: (canais) => set({ canais }),



      reset: () => set({ ...initial }),

    }),
    {
      name: "wa-wizard-draft",
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);

/**
 * Apaga o rascunho do wizard (estado em memória + sessionStorage). O rascunho
 * guarda CPF/telefone/e-mail de compradores, então precisa sumir no logout.
 */
export function limparRascunhoWizard(): void {
  useWizardStore.getState().reset();
  try {
    useWizardStore.persist.clearStorage();
  } catch {
    /* storage indisponível */
  }
}

// ---- Validation helpers ----
export function isTelefoneValido(tel: string | null | undefined): boolean {
  if (!tel) return false;
  const d = tel.replace(/\D/g, "");
  return d.length >= 10 && d.length <= 13;
}

export function isEmailValido(email: string | null | undefined): boolean {
  if (!email) return false;
  const trimmed = email.trim();
  if (trimmed.length < 5 || trimmed.length > 254) return false;
  // Reject legacy DocuSign fallback e-mails
  if (/@no-reply\.docusign$/i.test(trimmed)) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}


export function isCPFValido(cpf: string | null | undefined): boolean {
  if (!cpf) return false;
  const d = cpf.replace(/\D/g, "");
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const calc = (base: number) => {
    let sum = 0;
    for (let i = 0; i < base; i++) sum += parseInt(d[i]) * (base + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === parseInt(d[9]) && calc(10) === parseInt(d[10]);
}

export function formatTelefone(tel: string | null | undefined): string {
  if (!tel) return "—";
  const d = tel.replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return tel;
}

export function formatCPF(cpf: string | null | undefined): string {
  if (!cpf) return "—";
  const d = cpf.replace(/\D/g, "");
  if (d.length !== 11) return cpf;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}
