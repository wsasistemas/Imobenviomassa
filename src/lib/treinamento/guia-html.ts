// Gera a versão HTML autocontida do guia (CSS inline + imagens em base64), para salvar nos
// favoritos ou numa pasta de rede e abrir sem o portal. Roda no navegador.
import { ROTULO_ALERTA, urlDoPrint, type Guia } from "./tipos";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Baixa uma imagem e devolve como data URL; `null` se não existir (o print ainda não foi capturado). */
export async function imagemParaDataUrl(url: string): Promise<string | null> {
  try {
    const r = await fetch(url);
    if (!r.ok || !(r.headers.get("content-type") ?? "").startsWith("image/")) return null;
    const blob = await r.blob();
    return await new Promise<string>((ok, erro) => {
      const fr = new FileReader();
      fr.onload = () => ok(String(fr.result));
      fr.onerror = () => erro(fr.error);
      fr.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

const CSS = `
:root{--p:#3d6faf;--pd:#2c5a92;--ps:#e8eff8;--g:#1d2a3d;--m:#5f6f85;--b:#dfe6ef;--bg:#f7f9fc;--ok:#2f7d4f;--oks:#e2f3e8;--w:#a9741e;--ws:#fbf0dc;--i:#2c4a77;--is:#e8eef7}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--g);font:15px/1.55 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
header.topo{background:var(--g);color:#fff;padding:28px 20px}
header.topo .in,main,footer{max-width:960px;margin:0 auto}
header.topo small{letter-spacing:.1em;text-transform:uppercase;color:#9a9ba3;font-weight:600}
header.topo h1{margin:6px 0 8px;font-size:28px}
header.topo p{margin:0;color:#c9cad1;max-width:680px}
header.topo .marca{display:inline-block;background:var(--p);width:44px;height:4px;border-radius:2px;margin-bottom:14px}
main{padding:24px 20px 48px}
nav.sumario{background:#fff;border:1px solid var(--b);border-radius:12px;padding:16px 20px;margin-bottom:24px}
nav.sumario h2{margin:0 0 8px;font-size:13px;text-transform:uppercase;letter-spacing:.08em;color:var(--m)}
nav.sumario ol{margin:0;padding-left:20px;columns:2;column-gap:32px}
nav.sumario a{color:var(--g);text-decoration:none}nav.sumario a:hover{color:var(--p)}
section.passo{background:#fff;border:1px solid var(--b);border-radius:12px;padding:20px 22px;margin-bottom:20px;break-inside:avoid}
.cab{display:flex;gap:14px;align-items:flex-start;margin-bottom:12px}
.num{flex:none;width:36px;height:36px;border-radius:50%;background:var(--p);color:#fff;font-weight:700;display:flex;align-items:center;justify-content:center}
.cab h2{margin:0;font-size:19px}.cab p{margin:2px 0 0;color:var(--m);font-size:14px}
.meta{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0 0}
.tag{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.03em;background:var(--bg);color:var(--m);border-radius:6px;padding:3px 8px}
ol.instr{margin:12px 0;padding-left:22px}ol.instr li{margin:6px 0}
figure{margin:16px 0}figure img{display:block;max-width:100%;border:1px solid var(--b);border-radius:8px}
figure .falta{border:2px dashed var(--b);border-radius:8px;padding:28px;text-align:center;color:var(--m);background:var(--bg)}
figcaption{font-size:12.5px;color:var(--m);margin-top:6px}
.alerta{border-left:4px solid;border-radius:8px;padding:10px 14px;margin:12px 0}
.alerta strong{display:block;font-size:12px;text-transform:uppercase;letter-spacing:.04em}
.alerta.critico{background:var(--ps);border-color:var(--p);color:var(--pd)}
.alerta.atencao{background:var(--ws);border-color:var(--w);color:#6f4a0f}
.alerta.dica{background:var(--is);border-color:var(--i);color:var(--i)}
.alerta p{margin:2px 0 0;color:var(--g)}
.exemplo{background:var(--oks);border:1px solid #bfe0cb;border-radius:10px;padding:12px 16px;margin:14px 0}
.exemplo h3{margin:0 0 6px;font-size:14px;color:var(--ok)}
table{border-collapse:collapse;width:100%;font-size:13.5px;margin:8px 0;background:#fff}
th,td{border:1px solid var(--b);padding:6px 10px;text-align:left;vertical-align:top}th{background:var(--bg)}
.problemas td:first-child{font-weight:600}
footer{padding:0 20px 40px;color:var(--m);font-size:13px}
@media(max-width:640px){nav.sumario ol{columns:1}}
@media print{body{background:#fff}section.passo,nav.sumario{border-color:#ccc}header.topo{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
`;

export interface OpcoesHtml {
  /** Logo em data URL (opcional). */
  logo?: string | null;
  /** Mapa "arquivo do print" → data URL (ou null quando ainda não existe). */
  imagens: Record<string, string | null>;
}

export function gerarGuiaHtml(guia: Guia, { logo, imagens }: OpcoesHtml): string {
  const sumario = guia.passos.map((p) => `<li><a href="#${esc(p.id)}">${esc(p.titulo)}</a></li>`).join("");

  const passos = guia.passos
    .map((p, i) => {
      const meta = [p.onde && `Onde: ${p.onde}`, p.perfil && `Perfil: ${p.perfil}`]
        .filter(Boolean)
        .map((t) => `<span class="tag">${esc(t as string)}</span>`)
        .join("");
      const prints = p.prints
        .map((pr) => {
          const src = imagens[pr.arquivo];
          return `<figure>${
            src
              ? `<img src="${src}" alt="${esc(pr.legenda)}">`
              : `<div class="falta">Print da tela: ${esc(pr.legenda)}</div>`
          }<figcaption>${esc(pr.legenda)}</figcaption></figure>`;
        })
        .join("");
      const alertas = (p.alertas ?? [])
        .map(
          (a) =>
            `<div class="alerta ${a.tipo}"><strong>${ROTULO_ALERTA[a.tipo]} — ${esc(a.titulo)}</strong><p>${esc(a.texto)}</p></div>`,
        )
        .join("");
      const ex = p.exemplo
        ? `<div class="exemplo"><h3>Exemplo prático — ${esc(p.exemplo.titulo)}</h3>${
            p.exemplo.texto ? `<p>${esc(p.exemplo.texto)}</p>` : ""
          }${
            p.exemplo.tabela
              ? `<table><thead><tr>${p.exemplo.tabela.colunas.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead><tbody>${p.exemplo.tabela.linhas
                  .map((l) => `<tr>${l.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`)
                  .join("")}</tbody></table>`
              : ""
          }${p.exemplo.conclusao ? `<p><strong>${esc(p.exemplo.conclusao)}</strong></p>` : ""}</div>`
        : "";
      return `<section class="passo" id="${esc(p.id)}"><div class="cab"><div class="num">${i + 1}</div><div><h2>${esc(
        p.titulo,
      )}</h2><p>${esc(p.resumo)}</p><div class="meta">${meta}</div></div></div><ol class="instr">${p.instrucoes
        .map((t) => `<li>${esc(t)}</li>`)
        .join("")}</ol>${prints}${alertas}${ex}</section>`;
    })
    .join("");

  const problemas = `<section class="passo problemas" id="problemas"><div class="cab"><div class="num">${
    guia.passos.length + 1
  }</div><div><h2>Problemas comuns e quem acionar</h2></div></div><table><thead><tr><th>O que acontece</th><th>Por quê</th><th>O que fazer</th></tr></thead><tbody>${guia.problemas
    .map((x) => `<tr><td>${esc(x.sintoma)}</td><td>${esc(x.causa)}</td><td>${esc(x.solucao)}</td></tr>`)
    .join("")}</tbody></table><p>${esc(guia.suporte)}</p></section>`;

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(
    guia.titulo,
  )}</title><style>${CSS}</style></head><body><header class="topo"><div class="in">${
    logo ? `<img src="${logo}" alt="WSA Sistemas" style="height:48px;width:48px;border-radius:50%;margin-bottom:14px;display:block">` : ""
  }<div class="marca"></div><small>Centro de Treinamento · WSA Sistemas</small><h1>${esc(guia.titulo)}</h1><p>${esc(
    guia.subtitulo,
  )}</p></div></header><main><nav class="sumario"><h2>Neste guia</h2><ol>${sumario}<li><a href="#problemas">Problemas comuns e quem acionar</a></li></ol></nav>${passos}${problemas}</main><footer>${esc(
    guia.publico,
  )} · Atualizado em ${esc(guia.atualizadoEm)}</footer></body></html>`;
}

/** Monta o HTML (baixando as imagens) e dispara o download do arquivo. */
export async function baixarGuiaHtml(guia: Guia, logoUrl?: string): Promise<{ semPrint: number }> {
  const arquivos = [...new Set(guia.passos.flatMap((p) => p.prints.map((x) => x.arquivo)))];
  const [logo, ...dataUrls] = await Promise.all([
    logoUrl ? imagemParaDataUrl(logoUrl) : Promise.resolve(null),
    ...arquivos.map((a) => imagemParaDataUrl(urlDoPrint(guia.slug, a))),
  ]);
  const imagens = Object.fromEntries(arquivos.map((a, i) => [a, dataUrls[i]]));
  const html = gerarGuiaHtml(guia, { logo, imagens });

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${guia.slug}-passo-a-passo.html`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return { semPrint: dataUrls.filter((d) => d === null).length };
}
