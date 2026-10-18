// Tratamento de erros de terceiros (PostgREST/GoTrue, DocuSign, TOTVS RM) — só no servidor.
// Auditoria de segurança, Fase 3 / N10: o navegador recebe uma mensagem genérica em português
// (+ opcionalmente um código curto); o detalhe (mensagem do banco, corpo da resposta, URL) vai
// só para o log do servidor, truncado e sem dados pessoais óbvios. Nunca persistir corpo de
// resposta de terceiro em erro_msg de destinatário.
//
// Este arquivo é *.server.ts: nos *.functions.ts e em authz.ts (que vão para o bundle do navegador)
// carregue com `await import("@/lib/erros.server")`, como auditoria.server.

const LIMITE_LOG = 300;

/** Chaves que nunca vão para o log (mesmo truncadas). */
const CHAVES_SENSIVEIS = /senha|password|secret|token|authorization|rsa|private|cookie|cpf|telefone|phone/i;

/** Mascara e-mails, CPFs/CNPJs e telefones longos antes de logar. */
function semPii(texto: string): string {
  return texto
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, "<email>")
    .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, "<cpf>")
    .replace(/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g, "<cnpj>")
    .replace(/(?:\+?\d[\s().-]*){10,13}/g, "<telefone>");
}

function mensagemDe(erro: unknown): string {
  if (erro instanceof Error) return `${erro.name !== "Error" ? erro.name + ": " : ""}${erro.message}`;
  if (typeof erro === "string") return erro;
  if (erro && typeof erro === "object") {
    const o = erro as Record<string, unknown>;
    // PostgrestError / AuthError: { message, code, details, hint }
    const partes = [o.code, o.message, o.details, o.hint].filter((v) => typeof v === "string" && v);
    if (partes.length) return partes.join(" | ");
    try {
      return JSON.stringify(erro);
    } catch {
      /* noop */
    }
  }
  return String(erro);
}

function truncar(texto: string, max = LIMITE_LOG): string {
  const limpo = texto.replace(/\s+/g, " ").trim();
  return limpo.length > max ? limpo.slice(0, max) + "…" : limpo;
}

function extraSeguro(extra?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!extra) return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(extra)) {
    if (CHAVES_SENSIVEIS.test(k)) continue;
    out[k] = typeof v === "string" ? truncar(semPii(v)) : v;
  }
  return out;
}

/** Loga o detalhe no servidor: `[origem]` + mensagem truncada a 300 chars, sem chaves sensíveis. */
export function logErro(origem: string, erro: unknown, extra?: Record<string, unknown>): void {
  const msg = truncar(semPii(mensagemDe(erro)));
  const ex = extraSeguro(extra);
  if (ex && Object.keys(ex).length) console.error(`[${origem}]`, msg, ex);
  else console.error(`[${origem}]`, msg);
}

/** Loga o detalhe e devolve um Error com a mensagem genérica para o navegador. */
export function erroGenerico(origem: string, erro: unknown, mensagemUsuario: string): Error {
  logErro(origem, erro);
  return new Error(mensagemUsuario);
}

// ---------- DocuSign ----------

const CODIGOS_DOCUSIGN: Array<[RegExp, string]> = [
  [/^INVALID_EMAIL_ADDRESS_FOR_RECIPIENT$/, "E-mail do destinatário inválido"],
  [/^RECIPIENTS?_/, "Destinatário inválido"],
  [/^TEMPLATE_(ID_INVALID|NOT_FOUND)$/, "Modelo não encontrado"],
  [/^TEMPLATE_ROLE_NAME_NOT_FOUND$/, "Papel do modelo não encontrado"],
  [/^(USER_AUTHENTICATION_FAILED|AUTHORIZATION_INVALID_TOKEN|PARTNER_AUTHENTICATION_FAILED)$/, "Falha de autenticação no DocuSign"],
  [/consent/i, "Falha de autenticação no DocuSign"],
  [/^HOURLY_APIINVOCATION_LIMIT_EXCEEDED$/, "Limite de chamadas do DocuSign atingido"],
  [/^ENVELOPE_(IS_INCOMPLETE|DOES_NOT_EXIST|INVALID_STATUS)$/, "Envelope inválido"],
  [/^USER_LACKS_/, "Conta DocuSign sem permissão para esta operação"],
];

const TEXTO_POR_STATUS: Record<number, string> = {
  400: "Requisição recusada pelo DocuSign",
  401: "Falha de autenticação no DocuSign",
  403: "Sem permissão no DocuSign",
  404: "Recurso não encontrado no DocuSign",
  429: "Limite de chamadas do DocuSign atingido",
};

/**
 * Resumo seguro de um erro HTTP do DocuSign: só o `errorCode` do JSON (nunca o `message` nem
 * trecho do corpo) ou `HTTP <status>`. Formato: "<texto pt> (<CODE>)".
 */
export function resumirErroDocusign(status: number, corpo: string): string {
  let code = "";
  try {
    const parsed = JSON.parse(corpo) as { errorCode?: unknown; error?: unknown };
    const bruto = typeof parsed?.errorCode === "string" ? parsed.errorCode : typeof parsed?.error === "string" ? parsed.error : "";
    // Só o identificador: letras, números e _ (até 80 chars). Nada do corpo passa daqui.
    code = /^[\w-]{1,80}$/.test(bruto) ? bruto : "";
  } catch {
    /* corpo não é JSON */
  }
  const codigo = code || `HTTP ${status}`;
  const texto =
    (code && CODIGOS_DOCUSIGN.find(([re]) => re.test(code))?.[1]) ||
    TEXTO_POR_STATUS[status] ||
    (status >= 500 ? "DocuSign indisponível" : "Erro no DocuSign");
  return `${texto} (${codigo})`;
}
