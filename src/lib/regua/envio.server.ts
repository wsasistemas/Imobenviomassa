// Envio de cada tentativa da régua (PRD etapas 04, 06, 07, 08 e 09) — só servidor.
//   04 PDF com senha (uma vez por boleto) · 06 hospedagem no bucket privado + URL assinada com expiração
//   07 mensagem pelo template do canal · 08 WhatsApp (template Zenvia, PDF no cabeçalho) e e-mail (provedor ativo)
//   09 resultado gravado em regua_tentativa (payload sem o PDF, resposta do provedor, horário)

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { enviarEmail, type MensagemEmail, type TipoProvedor } from "@/lib/integracoes/email.server";
import { lerSegredo } from "@/lib/integracoes/segredos.server";
import { enviarTemplateWhatsapp } from "@/lib/integracoes/zenvia.server";
import {
  dadosDaMensagem,
  montarWhatsapp,
  preencher,
  prontidaoEmail,
  prontidaoWhatsapp,
  senhaDoPdf,
  telefoneE164,
  textoParaHtml,
  type RegraSenha,
} from "./comum";
import { gerarBoletoPdf } from "./pdf.server";

export const BUCKET = "imobenviomassa-regua";

export interface ProvedorEmailPronto {
  provedor: {
    tipo: TipoProvedor;
    smtp_host: string | null;
    smtp_porta: number | null;
    smtp_usuario: string | null;
    smtp_seguro: boolean;
  };
  credencial: string;
  from: string;
  fromEmail: string;
  fromNome: string | null;
  replyTo: string | null;
}

/** Provedor de e-mail pronto para enviar; lança com o motivo quando não está. */
export async function remetenteEmailPronto(
  imob: string,
  opcoes: { exigirAtivo: boolean },
): Promise<ProvedorEmailPronto> {
  const { data: p } = await supabaseAdmin
    .from("email_provedor")
    .select("*")
    .eq("imobiliaria_id", imob)
    .maybeSingle();
  if (!p) throw new Error("Configure o e-mail em Configurações › Integrações › E-mail.");
  if (opcoes.exigirAtivo && !p.ativo)
    throw new Error("O provedor de e-mail está desativado (Integrações › E-mail).");
  const tipo = p.tipo as TipoProvedor;
  if (!p.remetente_email) throw new Error("Informe o e-mail do remetente em Integrações › E-mail.");
  if (tipo === "resend") {
    if (p.status_dominio !== "verified" || !p.dominio) {
      throw new Error(
        "O domínio do Resend ainda não está verified. Verifique o DNS em Integrações › E-mail.",
      );
    }
    if (!p.remetente_email.toLowerCase().endsWith("@" + p.dominio))
      throw new Error(`O remetente precisa ser do domínio ${p.dominio}.`);
  }
  const credencial = await lerSegredo(
    tipo === "resend" ? "resend_apikey" : tipo === "smtp" ? "smtp_senha" : "zenvia_token",
    imob,
  );
  if (!credencial) throw new Error("A credencial do provedor de e-mail não está cadastrada.");
  const nome = p.remetente_nome?.replace(/[<>"]/g, "") ?? null;
  return {
    provedor: {
      tipo,
      smtp_host: p.smtp_host,
      smtp_porta: p.smtp_porta,
      smtp_usuario: p.smtp_usuario,
      smtp_seguro: p.smtp_seguro,
    },
    credencial,
    from: nome ? `${nome} <${p.remetente_email}>` : p.remetente_email,
    fromEmail: p.remetente_email,
    fromNome: nome,
    replyTo: p.reply_to,
  };
}

export interface TemplateWhatsappCompleto {
  id: string;
  nome: string;
  mapa: Record<string, string>;
  usaDocumento: boolean;
  zenviaId: string;
  corpo: string | null;
  variaveis: string[];
  status: string;
  headerTipo: string | null;
  remetente: string | null;
  remetenteAtivo: boolean;
}

export interface TemplateEmailCompleto {
  id: string;
  nome: string;
  assunto: string;
  corpo: string;
  anexo: "pdf_link" | "link";
}

export async function carregarTemplateWhatsapp(
  imob: string,
  id: string,
): Promise<TemplateWhatsappCompleto> {
  const { data: t } = await supabaseAdmin
    .from("regua_template")
    .select("*")
    .eq("id", id)
    .eq("imobiliaria_id", imob)
    .eq("canal", "whatsapp")
    .maybeSingle();
  if (!t) throw new Error("Template de WhatsApp não encontrado.");
  const [{ data: w }, { data: r }] = await Promise.all([
    t.whatsapp_template_id
      ? supabaseAdmin
          .from("whatsapp_template")
          .select("*")
          .eq("id", t.whatsapp_template_id)
          .eq("imobiliaria_id", imob)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    t.remetente_id
      ? supabaseAdmin
          .from("whatsapp_remetente")
          .select("*")
          .eq("id", t.remetente_id)
          .eq("imobiliaria_id", imob)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const mapa = (t.mapa_variaveis ?? {}) as Record<string, string>;
  const variaveis = Array.isArray(w?.variaveis) ? (w!.variaveis as string[]) : [];
  const pr = prontidaoWhatsapp({
    ativo: t.ativo,
    whatsapp: w
      ? { status: String(w.status), variaveis, header_tipo: w.header_tipo ?? null }
      : null,
    mapa_variaveis: mapa,
    usa_documento: t.usa_documento,
    remetente_id: t.remetente_id,
  });
  if (!pr.pronto) throw new Error(`Template "${t.nome}": ${pr.motivo}.`);
  return {
    id: t.id,
    nome: t.nome,
    mapa,
    usaDocumento:
      t.usa_documento && String(w?.header_tipo ?? "").toUpperCase() === "MEDIA_DOCUMENT",
    zenviaId: w!.zenvia_id,
    corpo: w!.corpo ?? null,
    variaveis,
    status: w!.status,
    headerTipo: w!.header_tipo ?? null,
    remetente: r?.numero ?? null,
    remetenteAtivo: r?.status === "ativo",
  };
}

export async function carregarTemplateEmail(
  imob: string,
  id: string,
): Promise<TemplateEmailCompleto> {
  const { data: t } = await supabaseAdmin
    .from("regua_template")
    .select("*")
    .eq("id", id)
    .eq("imobiliaria_id", imob)
    .eq("canal", "email")
    .maybeSingle();
  if (!t) throw new Error("Template de e-mail não encontrado.");
  const pr = prontidaoEmail(t);
  if (!pr.pronto) throw new Error(`Template "${t.nome}": ${pr.motivo}.`);
  return {
    id: t.id,
    nome: t.nome,
    assunto: t.assunto!,
    corpo: t.corpo!,
    anexo: t.anexo_tipo as "pdf_link" | "link",
  };
}

export interface ContextoEnvio {
  imob: string;
  beneficiario: string;
  regraSenha: RegraSenha;
  dica: string;
  validadeHoras: number;
  intervaloSeg: number;
  whatsapp: TemplateWhatsappCompleto | null;
  email: TemplateEmailCompleto | null;
  provedorEmail: ProvedorEmailPronto | null;
  tokenZenvia: string | null;
}

export async function contextoDoLote(
  imob: string,
  lote: { template_whatsapp_id: string | null; template_email_id: string | null; canais: string[] },
): Promise<ContextoEnvio> {
  const [{ data: cfg }, { data: imobiliaria }] = await Promise.all([
    supabaseAdmin.from("regua_config").select("*").eq("imobiliaria_id", imob).maybeSingle(),
    supabaseAdmin.from("imobiliarias").select("nome").eq("id", imob).maybeSingle(),
  ]);
  const usaWhats = lote.canais.includes("whatsapp") && !!lote.template_whatsapp_id;
  const usaEmail = lote.canais.includes("email") && !!lote.template_email_id;
  return {
    imob,
    beneficiario: imobiliaria?.nome ?? "Imobiliária",
    regraSenha: (cfg?.regra_senha as RegraSenha) ?? "cpf_5_primeiros",
    dica: cfg?.texto_dica ?? "A senha são os 5 primeiros dígitos do seu CPF ou CNPJ.",
    validadeHoras: cfg?.validade_link_horas ?? 72,
    intervaloSeg: cfg?.intervalo_whatsapp_seg ?? 2,
    whatsapp: usaWhats ? await carregarTemplateWhatsapp(imob, lote.template_whatsapp_id!) : null,
    email: usaEmail ? await carregarTemplateEmail(imob, lote.template_email_id!) : null,
    provedorEmail: usaEmail ? await remetenteEmailPronto(imob, { exigirAtivo: true }) : null,
    tokenZenvia: usaWhats ? await lerSegredo("zenvia_token", imob) : null,
  };
}

type BoletoLinha = {
  id: string;
  lote_id: string;
  cliente_nome: string;
  cpf_cnpj: string | null;
  empreendimento: string | null;
  unidade: string | null;
  numero: string;
  vencimento: string | null;
  dias_atraso: number | null;
  valor: number | null;
  linha_digitavel: string | null;
};

/** PDF do boleto: reaproveita o do lote se ainda vale; senão gera, guarda e registra. Devolve bytes e URL assinada. */
export async function documentoDoBoleto(
  c: ContextoEnvio,
  b: BoletoLinha,
): Promise<{ bytes: Uint8Array; url: string; nome: string; expiraEm: string }> {
  const nome = `boleto-${b.numero.replace(/[^\w.-]/g, "")}.pdf`;
  const caminho = `${c.imob}/${b.lote_id}/${b.id}.pdf`;
  const { data: doc } = await supabaseAdmin
    .from("regua_documento")
    .select("*")
    .eq("boleto_id", b.id)
    .maybeSingle();
  let bytes: Uint8Array | null = null;
  let expiraEm = new Date(Date.now() + c.validadeHoras * 3_600_000).toISOString();
  // Reaproveita se faltam pelo menos 2 h para expirar (a Zenvia ainda vai baixar o arquivo).
  if (doc && !doc.removido_em && Date.parse(doc.expira_em) - Date.now() > 2 * 3_600_000) {
    const baixado = await supabaseAdmin.storage.from(BUCKET).download(doc.storage_path);
    if (baixado.data) {
      bytes = new Uint8Array(await baixado.data.arrayBuffer());
      expiraEm = doc.expira_em;
    }
  }
  if (!bytes) {
    const senha = senhaDoPdf(c.regraSenha, b.cpf_cnpj);
    if (!senha) throw new Error("Boleto sem CPF/CNPJ: não há como aplicar a senha do PDF.");
    bytes = await gerarBoletoPdf(
      {
        beneficiario: c.beneficiario,
        clienteNome: b.cliente_nome,
        cpfCnpj: b.cpf_cnpj,
        empreendimento: b.empreendimento,
        unidade: b.unidade,
        numero: b.numero,
        vencimento: b.vencimento,
        diasAtraso: b.dias_atraso,
        valor: b.valor,
        linhaDigitavel: b.linha_digitavel,
      },
      senha,
    );
    const up = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(caminho, bytes, { contentType: "application/pdf", upsert: true });
    if (up.error)
      throw new Error("Não foi possível guardar o PDF do boleto (bucket imobenviomassa-regua).");
    await supabaseAdmin.from("regua_documento").upsert(
      {
        imobiliaria_id: c.imob,
        boleto_id: b.id,
        storage_path: caminho,
        protegido: true,
        tamanho_bytes: bytes.byteLength,
        criado_em: new Date().toISOString(),
        expira_em: expiraEm,
        removido_em: null,
      },
      { onConflict: "boleto_id" },
    );
  }
  // O link vence junto com o arquivo (a rotina de expiração remove o PDF em expira_em).
  const segundos = Math.max(60, Math.floor((Date.parse(expiraEm) - Date.now()) / 1000));
  const assinada = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUrl(caminho, segundos, { download: nome });
  if (!assinada.data?.signedUrl)
    throw new Error("Não foi possível gerar o link temporário do PDF.");
  return { bytes, url: assinada.data.signedUrl, nome, expiraEm };
}

export interface ResultadoTentativa {
  status: "enviado" | "falha";
  erro: string | null;
}

/** Envia uma tentativa (já reservada como "processando") e grava o resultado. Nunca lança: falha vira status. */
export async function enviarTentativa(
  c: ContextoEnvio,
  t: { id: string; canal: string; boleto_id: string },
  contato: string | null,
): Promise<ResultadoTentativa> {
  const agora = new Date().toISOString();
  const gravar = async (r: {
    status: "enviado" | "falha";
    erro?: string | null;
    provedor?: string;
    id?: string | null;
    payload?: unknown;
    resposta?: unknown;
    mensagem?: string | null;
  }) => {
    await supabaseAdmin
      .from("regua_tentativa")
      .update({
        status: r.status,
        erro: r.erro ?? null,
        provedor: r.provedor ?? null,
        id_provedor: r.id ?? null,
        payload: (r.payload ?? null) as never,
        resposta: (r.resposta ?? null) as never,
        mensagem_renderizada: r.mensagem ?? null,
        tentado_em: agora,
      })
      .eq("id", t.id);
    await supabaseAdmin.rpc("regua_recalcular_boleto", { p_boleto: t.boleto_id });
    return { status: r.status, erro: r.erro ?? null } as ResultadoTentativa;
  };

  try {
    const { data: b } = await supabaseAdmin
      .from("regua_boleto")
      .select("*")
      .eq("id", t.boleto_id)
      .single();
    if (!b) return gravar({ status: "falha", erro: "Boleto não encontrado." });
    if (!contato) return gravar({ status: "falha", erro: "Sem contato válido neste canal." });

    if (t.canal === "whatsapp") {
      if (!c.whatsapp || !c.tokenZenvia)
        return gravar({ status: "falha", erro: "WhatsApp não configurado (token ou template)." });
      if (!c.whatsapp.remetente || !c.whatsapp.remetenteAtivo)
        return gravar({ status: "falha", erro: "Número remetente inativo." });
      const doc = c.whatsapp.usaDocumento ? await documentoDoBoleto(c, b) : null;
      const dados = dadosDaMensagem({
        ...b,
        valor: b.valor != null ? Number(b.valor) : null,
        link: doc?.url ?? null,
        dica: c.dica,
      });
      const msg = montarWhatsapp(
        { corpo: c.whatsapp.corpo, variaveis: c.whatsapp.variaveis },
        c.whatsapp.mapa,
        dados,
      );
      if (msg.faltando.length)
        return gravar({ status: "falha", erro: `Variável sem campo: ${msg.faltando.join(", ")}` });
      const para = telefoneE164(contato);
      const payload = {
        from: c.whatsapp.remetente,
        to: para,
        templateId: c.whatsapp.zenviaId,
        fields: msg.fields,
        documento: doc ? "(URL assinada do PDF)" : null,
      };
      const r = await enviarTemplateWhatsapp(c.tokenZenvia, {
        from: c.whatsapp.remetente,
        to: para,
        templateId: c.whatsapp.zenviaId,
        fields: msg.fields,
        documentoUrl: doc?.url,
      });
      return gravar({
        status: r.ok && r.id ? "enviado" : "falha",
        erro: r.ok && r.id ? null : (r.erro ?? "A Zenvia não devolveu o id da mensagem."),
        provedor: "zenvia",
        id: r.id,
        payload,
        resposta: r.resposta,
        mensagem: msg.texto,
      });
    }

    if (!c.email || !c.provedorEmail)
      return gravar({ status: "falha", erro: "E-mail não configurado (template ou provedor)." });
    const doc = await documentoDoBoleto(c, b);
    const dados = dadosDaMensagem({
      ...b,
      valor: b.valor != null ? Number(b.valor) : null,
      link: doc.url,
      dica: c.dica,
    });
    const assunto = preencher(c.email.assunto, dados);
    const texto = preencher(c.email.corpo, dados);
    const msg: MensagemEmail = {
      from: c.provedorEmail.from,
      fromEmail: c.provedorEmail.fromEmail,
      fromNome: c.provedorEmail.fromNome,
      to: contato.trim(),
      assunto,
      html: textoParaHtml(texto),
      texto,
      replyTo: c.provedorEmail.replyTo,
      anexo:
        c.email.anexo === "pdf_link" ? { nome: doc.nome, conteudo: doc.bytes, url: doc.url } : null,
    };
    const r = await enviarEmail(c.provedorEmail.provedor, c.provedorEmail.credencial, msg);
    const payload = {
      from: msg.from,
      to: msg.to,
      assunto,
      anexo: msg.anexo ? msg.anexo.nome : null,
      provedor: c.provedorEmail.provedor.tipo,
    };
    return gravar({
      status: r.ok ? "enviado" : "falha",
      erro: r.ok ? null : r.erro,
      provedor: c.provedorEmail.provedor.tipo,
      id: r.id,
      payload,
      resposta: r.resposta,
      mensagem: `${assunto}\n\n${texto}`,
    });
  } catch (e) {
    return gravar({
      status: "falha",
      erro: e instanceof Error ? e.message.slice(0, 300) : "Erro inesperado no envio.",
    });
  }
}

/** Rotina de expiração (RNF): remove do bucket os PDFs vencidos e marca removido_em. Chamada no processamento. */
export async function removerDocumentosVencidos(imob: string, limite = 50): Promise<number> {
  const { data } = await supabaseAdmin
    .from("regua_documento")
    .select("id, storage_path")
    .eq("imobiliaria_id", imob)
    .is("removido_em", null)
    .lt("expira_em", new Date().toISOString())
    .limit(limite);
  if (!data?.length) return 0;
  await supabaseAdmin.storage.from(BUCKET).remove(data.map((d) => d.storage_path));
  await supabaseAdmin
    .from("regua_documento")
    .update({ removido_em: new Date().toISOString() })
    .in(
      "id",
      data.map((d) => d.id),
    );
  return data.length;
}
