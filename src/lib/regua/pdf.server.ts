// PDF do boleto com senha (PRD etapa 04) — só servidor. Gerado a partir dos dados da origem (TOTVS RM ou
// planilha): linha digitável, código de barras (Intercalado 2 de 5, montado da linha digitável), pagador,
// unidade, vencimento e valor. Criptografia AES-256 com a senha da regra configurada (@cantoo/pdf-lib).
//
// Não substitui o PDF emitido pelo banco: é a representação do boleto já registrado. O rodapé diz isso.

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "@cantoo/pdf-lib";
import { dataBr, mascararDocumento, moeda, soDigitos } from "./comum";

export interface DadosBoletoPdf {
  beneficiario: string;
  clienteNome: string;
  cpfCnpj: string | null;
  empreendimento: string | null;
  unidade: string | null;
  numero: string;
  vencimento: string | null;
  diasAtraso: number | null;
  valor: number | null;
  linhaDigitavel: string | null;
}

/** Linha digitável (47 dígitos, bancário; 48, arrecadação) → código de barras de 44 dígitos. */
export function codigoDeBarras(linha: string | null | undefined): string | null {
  const l = soDigitos(linha);
  if (l.length === 47) {
    // Banco(3) moeda(1) | DV geral (pos. 33) | fator+valor (34–47) | campo livre: 5–9, 11–20, 22–31
    return (
      l.slice(0, 4) +
      l.slice(32, 33) +
      l.slice(33, 47) +
      l.slice(4, 9) +
      l.slice(10, 20) +
      l.slice(21, 31)
    );
  }
  if (l.length === 48) {
    // 4 blocos de 11 dígitos + DV de cada bloco
    return l.slice(0, 11) + l.slice(12, 23) + l.slice(24, 35) + l.slice(36, 47);
  }
  return null;
}

/** "34191.09008 01845.221092 …" para exibir. */
export function formatarLinha(linha: string | null | undefined): string {
  const l = soDigitos(linha);
  if (l.length === 47) {
    return `${l.slice(0, 5)}.${l.slice(5, 10)} ${l.slice(10, 15)}.${l.slice(15, 21)} ${l.slice(21, 26)}.${l.slice(26, 32)} ${l.slice(32, 33)} ${l.slice(33)}`;
  }
  if (l.length === 48)
    return `${l.slice(0, 12)} ${l.slice(12, 24)} ${l.slice(24, 36)} ${l.slice(36)}`;
  return linha ?? "";
}

// Intercalado 2 de 5: n = estreita, w = larga.
const PADROES = [
  "nnwwn",
  "wnnnw",
  "nwnnw",
  "wwnnn",
  "nnwnw",
  "wnwnn",
  "nwwnn",
  "nnnww",
  "wnnwn",
  "nwnwn",
];

function desenharItf(
  page: PDFPage,
  codigo: string,
  x: number,
  y: number,
  altura: number,
  estreita = 0.85,
) {
  const larga = estreita * 3;
  let cx = x;
  const barra = (w: number, preta: boolean) => {
    if (preta) page.drawRectangle({ x: cx, y, width: w, height: altura, color: rgb(0, 0, 0) });
    cx += w;
  };
  // início: barra-espaço-barra-espaço estreitos
  barra(estreita, true);
  barra(estreita, false);
  barra(estreita, true);
  barra(estreita, false);
  for (let i = 0; i < codigo.length; i += 2) {
    const b = PADROES[Number(codigo[i])];
    const e = PADROES[Number(codigo[i + 1])];
    for (let k = 0; k < 5; k++) {
      barra(b[k] === "w" ? larga : estreita, true);
      barra(e[k] === "w" ? larga : estreita, false);
    }
  }
  // fim: barra larga, espaço estreito, barra estreita
  barra(larga, true);
  barra(estreita, false);
  barra(estreita, true);
}

function campo(
  page: PDFPage,
  fonte: PDFFont,
  negrito: PDFFont,
  rotulo: string,
  valor: string,
  x: number,
  y: number,
  w: number,
) {
  page.drawRectangle({
    x,
    y: y - 30,
    width: w,
    height: 30,
    borderColor: rgb(0.75, 0.75, 0.75),
    borderWidth: 0.6,
  });
  page.drawText(rotulo, {
    x: x + 4,
    y: y - 10,
    size: 6.5,
    font: fonte,
    color: rgb(0.35, 0.35, 0.35),
  });
  page.drawText(valor.slice(0, 80), {
    x: x + 4,
    y: y - 23,
    size: 9.5,
    font: negrito,
    color: rgb(0.1, 0.1, 0.1),
  });
}

export async function gerarBoletoPdf(d: DadosBoletoPdf, senha: string): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Boleto ${d.numero}`);
  pdf.setAuthor(d.beneficiario);
  pdf.setProducer("Disparo em Massa · Régua de Cobrança");
  const page = pdf.addPage([595.28, 841.89]); // A4
  const fonte = await pdf.embedFont(StandardFonts.Helvetica);
  const negrito = await pdf.embedFont(StandardFonts.HelveticaBold);
  const mx = 36;
  const largura = 595.28 - mx * 2;
  let y = 800;

  page.drawText(d.beneficiario.slice(0, 70), { x: mx, y, size: 14, font: negrito });
  y -= 18;
  page.drawText(
    d.diasAtraso && d.diasAtraso > 0
      ? `Boleto em atraso há ${d.diasAtraso} dias`
      : "Boleto de cobrança",
    {
      x: mx,
      y,
      size: 10,
      font: fonte,
      color: rgb(0.4, 0.4, 0.4),
    },
  );
  y -= 26;

  const linha = formatarLinha(d.linhaDigitavel);
  page.drawText("Linha digitável", {
    x: mx,
    y,
    size: 7,
    font: fonte,
    color: rgb(0.35, 0.35, 0.35),
  });
  y -= 14;
  page.drawText(linha || "—", { x: mx, y, size: 12, font: negrito });
  y -= 14;

  const meio = largura / 2;
  campo(page, fonte, negrito, "Beneficiário", d.beneficiario, mx, y, largura);
  y -= 30;
  campo(page, fonte, negrito, "Pagador", d.clienteNome, mx, y, meio * 1.3);
  campo(
    page,
    fonte,
    negrito,
    "CPF/CNPJ",
    mascararDocumento(d.cpfCnpj),
    mx + meio * 1.3,
    y,
    largura - meio * 1.3,
  );
  y -= 30;
  campo(page, fonte, negrito, "Empreendimento", d.empreendimento ?? "—", mx, y, meio);
  campo(page, fonte, negrito, "Unidade", d.unidade ?? "—", mx + meio, y, meio);
  y -= 30;
  campo(page, fonte, negrito, "Número do documento", d.numero, mx, y, largura / 3);
  campo(page, fonte, negrito, "Vencimento", dataBr(d.vencimento), mx + largura / 3, y, largura / 3);
  campo(
    page,
    fonte,
    negrito,
    "Valor do documento",
    moeda(d.valor),
    mx + (largura * 2) / 3,
    y,
    largura / 3,
  );
  y -= 50;

  const codigo = codigoDeBarras(d.linhaDigitavel);
  if (codigo) {
    desenharItf(page, codigo, mx, y - 50, 50);
    y -= 70;
  } else {
    page.drawText(
      "Linha digitável não informada ou inválida: pague pela linha acima ou fale com o financeiro.",
      {
        x: mx,
        y: y - 12,
        size: 8,
        font: fonte,
        color: rgb(0.6, 0.1, 0.1),
      },
    );
    y -= 30;
  }

  page.drawText(
    "Documento gerado a partir dos dados do boleto registrado (TOTVS RM). Se já pagou, desconsidere. Dúvidas: fale com o financeiro.",
    { x: mx, y: 40, size: 7, font: fonte, color: rgb(0.45, 0.45, 0.45), maxWidth: largura },
  );

  pdf.encrypt({
    userPassword: senha,
    ownerPassword: (await import("node:crypto")).randomBytes(24).toString("hex"),
    permissions: {
      printing: "highResolution",
      modifying: false,
      copying: false,
      annotating: false,
    },
  });
  return pdf.save({ useObjectStreams: false });
}
