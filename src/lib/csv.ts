// Geração de CSV segura para abrir no Excel (pt-BR).
//
// - celulaCsv: neutraliza injeção de fórmula (CSV/Formula Injection): valores que
//   começam com "=", "+", "-", "@", TAB ou CR são prefixados com apóstrofo, para o
//   Excel/LibreOffice tratá-los como texto e nunca executar.
// - linhasCsv: monta o arquivo com ";" (separador padrão do Excel em pt-BR),
//   quebras "\r\n" e BOM UTF-8 para acentuação correta.
// - mascararDocumento: CPF/CNPJ mascarados para exportações (LGPD).

const SEPARADOR = ";";
const INICIO_PERIGOSO = /^[=+\-@\t\r]/;

export function celulaCsv(valor: unknown): string {
  let texto: string;
  if (valor === null || valor === undefined) texto = "";
  else if (typeof valor === "string") texto = valor;
  else if (typeof valor === "object") {
    try {
      texto = JSON.stringify(valor);
    } catch {
      texto = String(valor);
    }
  } else texto = String(valor);

  if (INICIO_PERIGOSO.test(texto.replace(/^\s+/, ""))) texto = `'${texto}`;
  return `"${texto.replace(/"/g, '""')}"`;
}

export function linhasCsv(linhas: unknown[][]): string {
  const corpo = linhas.map((linha) => linha.map(celulaCsv).join(SEPARADOR)).join("\r\n");
  return `﻿${corpo}\r\n`;
}

/** CSV a partir de objetos: cabeçalho = chaves do primeiro objeto (ou `cabecalho`). */
export function objetosParaCsv(
  objetos: Record<string, unknown>[],
  cabecalho?: string[],
): string {
  if (!objetos.length) return linhasCsv(cabecalho ? [cabecalho] : []);
  const chaves = cabecalho ?? Object.keys(objetos[0]);
  return linhasCsv([chaves, ...objetos.map((o) => chaves.map((k) => o[k]))]);
}

/**
 * Mascara CPF (`***.***.123-45`, só os 5 últimos dígitos) e CNPJ
 * (`**.***.***\/0001-**`, só o número da filial). Valores que não forem
 * CPF/CNPJ têm todos os dígitos trocados por "*", exceto os 2 últimos.
 */
export function mascararDocumento(d: string | null | undefined): string {
  if (!d) return "";
  const digitos = d.replace(/\D/g, "");
  if (!digitos) return "";
  if (digitos.length === 11) return `***.***.${digitos.slice(6, 9)}-${digitos.slice(9, 11)}`;
  if (digitos.length === 14) return `**.***.***/${digitos.slice(8, 12)}-**`;
  return `${"*".repeat(Math.max(0, digitos.length - 2))}${digitos.slice(-2)}`;
}

/**
 * CPF (`000.000.000-00`) ou CNPJ (`00.000.000/0000-00`) formatado, para o CSV completo (admin).
 * Outros valores devolvem só os dígitos. Vazio devolve "".
 */
export function formatarDocumento(d: string | null | undefined): string {
  const digitos = (d ?? "").replace(/\D/g, "");
  if (digitos.length === 11) return digitos.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  if (digitos.length === 14) return digitos.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  return digitos;
}

/**
 * Dispara o download de um CSV já montado (texto pronto): por `linhasCsv`/`objetosParaCsv` no
 * navegador ou devolvido pelo servidor (`exportarRelatorioCsv`, que já inclui o BOM).
 */
export function baixarCsv(nomeArquivo: string, conteudo: string): void {
  const blob = new Blob([conteudo], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
