// Relatório do lote (RF-09) em Excel e PDF, gerado no navegador a partir de dadosExportacaoLote (CPF/CNPJ já
// mascarado pelo servidor). Os totais vêm de regua_contadores, os mesmos do detalhe e do painel.

import type { Contadores } from "@/lib/regua/lote.functions";
import {
  ROTULO_REGUA,
  ROTULO_STATUS_LOTE,
  dataHoraBr,
  moeda,
  type ReguaSugerida,
  type StatusLote,
} from "@/lib/regua/comum";

export interface DadosExportacao {
  lote: {
    numero: number;
    titulo: string;
    status: StatusLote;
    usuario: string | null;
    iniciadoEm: string | null;
    finalizadoEm: string | null;
    origem: string;
    tipoRegua: string;
    faixa: string | null;
    tipo: string;
  };
  contadores: Contadores;
  linhas: {
    cliente: string;
    documento: string;
    empreendimento: string;
    unidade: string;
    boleto: string;
    vencimento: string;
    diasAtraso: number | null;
    valor: number | null;
    registro: string;
    whatsapp: string;
    whatsappErro: string;
    email: string;
    emailErro: string;
    resultado: string;
  }[];
}

const regua = (d: DadosExportacao) =>
  ROTULO_REGUA[
    (d.lote.tipoRegua === "a_vencer" ? "a_vencer" : (d.lote.faixa ?? "30")) as ReguaSugerida
  ];
const nomeArquivo = (d: DadosExportacao, ext: string) =>
  `lote-${d.lote.numero}-${d.lote.titulo
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w]+/g, "-")
    .toLowerCase()
    .slice(0, 50)}.${ext}`;

function resumo(d: DadosExportacao): [string, string | number][] {
  const c = d.contadores;
  return [
    ["Lote", `#${d.lote.numero}`],
    ["Título da remessa", d.lote.titulo],
    ["Régua", regua(d)],
    ["Tipo", d.lote.tipo === "extraordinario" ? "Extraordinário" : "Normal"],
    ["Origem", d.lote.origem === "rm" ? "TOTVS RM" : "Planilha"],
    ["Status", ROTULO_STATUS_LOTE[d.lote.status]],
    ["Acionado por", d.lote.usuario ?? "—"],
    ["Início", dataHoraBr(d.lote.iniciadoEm)],
    ["Fim", dataHoraBr(d.lote.finalizadoEm)],
    ["No lote", c.no_lote],
    ["Não registrados", c.nao_registrados],
    ["Sem contato válido", c.sem_contato],
    ["Elegíveis", c.elegiveis],
    ["Sucesso", c.sucesso],
    ["Falhas", c.falhas],
    ["WhatsApp enviados / entregues", `${c.whatsapp.enviados} / ${c.whatsapp.entregues}`],
    ["E-mails enviados / entregues", `${c.email.enviados} / ${c.email.entregues}`],
  ];
}

export async function exportarExcel(d: DadosExportacao) {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([["Resumo do lote", ""], ...resumo(d)]),
    "Resumo",
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      d.linhas.map((l) => ({
        Cliente: l.cliente,
        "CPF/CNPJ": l.documento,
        Empreendimento: l.empreendimento,
        Unidade: l.unidade,
        Boleto: l.boleto,
        Vencimento: l.vencimento,
        "Dias em atraso": l.diasAtraso ?? "",
        Valor: l.valor ?? "",
        "Registro no banco": l.registro,
        WhatsApp: l.whatsapp,
        "Erro WhatsApp": l.whatsappErro,
        "E-mail": l.email,
        "Erro e-mail": l.emailErro,
        Resultado: l.resultado,
      })),
    ),
    "Boletos",
  );
  XLSX.writeFile(wb, nomeArquivo(d, "xlsx"));
}

/** A fonte padrão do PDF (Helvetica, WinAnsi) só tem Latin-1: o que passar disso vira "?". */
const latin1 = (t: string) =>
  [...t].map((ch) => (ch.charCodeAt(0) >= 0x20 && ch.charCodeAt(0) <= 0xff ? ch : "?")).join("");

export async function exportarPdf(d: DadosExportacao) {
  const { PDFDocument, StandardFonts, rgb } = await import("@cantoo/pdf-lib");
  const pdf = await PDFDocument.create();
  const fonte = await pdf.embedFont(StandardFonts.Helvetica);
  const negrito = await pdf.embedFont(StandardFonts.HelveticaBold);
  const W = 841.89;
  const H = 595.28; // A4 paisagem
  const mx = 30;
  let page = pdf.addPage([W, H]);
  let y = H - 36;
  const txt = (t: string, x: number, size = 8, bold = false, cor = rgb(0.12, 0.12, 0.12)) =>
    page.drawText(latin1(t), {
      x,
      y,
      size,
      font: bold ? negrito : fonte,
      color: cor,
    });

  txt(`Relatório do lote #${d.lote.numero}`, mx, 14, true);
  y -= 16;
  txt(d.lote.titulo, mx, 10);
  y -= 18;
  const r = resumo(d).slice(2);
  for (let i = 0; i < r.length; i += 4) {
    r.slice(i, i + 4).forEach(([k, v], j) => {
      txt(`${k}:`, mx + j * 195, 7.5, false, rgb(0.4, 0.4, 0.4));
      page.drawText(latin1(String(v)).slice(0, 34), {
        x: mx + j * 195,
        y: y - 10,
        size: 8.5,
        font: negrito,
      });
    });
    y -= 24;
  }
  y -= 6;
  const cols: [string, number, (l: DadosExportacao["linhas"][number]) => string][] = [
    ["Cliente", 150, (l) => l.cliente],
    ["CPF/CNPJ", 80, (l) => l.documento],
    [
      "Empreendimento / Unid.",
      130,
      (l) => `${l.empreendimento}${l.unidade ? " / " + l.unidade : ""}`,
    ],
    ["Boleto", 60, (l) => l.boleto],
    ["Venc.", 50, (l) => l.vencimento],
    ["Atraso", 35, (l) => (l.diasAtraso != null ? String(l.diasAtraso) : "")],
    ["Valor", 60, (l) => moeda(l.valor)],
    ["WhatsApp", 55, (l) => l.whatsapp],
    ["E-mail", 55, (l) => l.email],
    ["Resultado", 80, (l) => l.resultado],
  ];
  const cabecalho = () => {
    page.drawRectangle({
      x: mx - 2,
      y: y - 3,
      width: W - mx * 2 + 4,
      height: 13,
      color: rgb(0.95, 0.94, 0.93),
    });
    let x = mx;
    for (const [n, w] of cols) {
      txt(n.toUpperCase(), x, 6.5, true, rgb(0.4, 0.4, 0.4));
      x += w;
    }
    y -= 15;
  };
  cabecalho();
  for (const l of d.linhas) {
    if (y < 30) {
      page = pdf.addPage([W, H]);
      y = H - 36;
      cabecalho();
    }
    let x = mx;
    for (const [, w, f] of cols) {
      const v = f(l);
      const max = Math.floor(w / 4.2);
      txt(v.length > max ? v.slice(0, max - 3) + "..." : v, x, 7.5);
      x += w;
    }
    y -= 12;
  }
  const bytes = await pdf.save();
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo(d, "pdf");
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
