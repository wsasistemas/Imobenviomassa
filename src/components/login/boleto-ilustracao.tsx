import type { CSSProperties, ReactNode } from "react";
import { FileCheck2, Landmark } from "lucide-react";
import wsaLogo from "@/assets/wsa-logo.png";

// Cena da tela de entrada, em tela cheia como a foto do login do imobdocerias: boleto FICTÍCIO grande apoiado numa
// base laranja, outros dois desfocados nas bordas e moedas (referência enviada pelo Wagner em 24/10/2026,
// redesenhada em HTML/SVG: a imagem original é pequena e sem licença conhecida).
// Banco 000, linha digitável inválida e marca "EXEMPLO": nunca funciona como boleto pagável. Sem nicho de mercado.

// Código de barras e QR "Pix" com semente fixa: o mesmo desenho em toda renderização (sem diferença SSR × cliente).
let semente = 7;
const aleat = () => (semente = (semente * 1103515245 + 12345) % 2147483648) / 2147483648;

const BARRAS: { x: number; w: number }[] = [];
let larguraBarras = 0;
for (let i = 0; i < 70; i++) {
  const w = 1 + Math.floor(aleat() * 3);
  if (i % 2 === 0) BARRAS.push({ x: larguraBarras, w });
  larguraBarras += w;
}

const N = 25;
const QR: [number, number][] = [];
for (let y = 0; y < N; y++)
  for (let x = 0; x < N; x++) {
    const canto = (x < 8 && y < 8) || (x > N - 9 && y < 8) || (x < 8 && y > N - 9);
    if (!canto && aleat() > 0.52) QR.push([x, y]);
  }

function MarcadorQr({ x, y }: { x: number; y: number }) {
  return (
    <>
      <rect x={x} y={y} width={7} height={7} />
      <rect x={x + 1} y={y + 1} width={5} height={5} fill="#fff" />
      <rect x={x + 2} y={y + 2} width={3} height={3} />
    </>
  );
}

/** Moeda laranja (abóbora da marca) com "R$" ou com um símbolo. */
function Moeda({ className, style, children }: { className: string; style?: CSSProperties; children?: ReactNode }) {
  return (
    <span className={`ent-moeda grid place-items-center rounded-full ${className}`} style={style}>
      {children ?? <b className="text-[0.38em] font-extrabold text-[#fff8ee]">R$</b>}
    </span>
  );
}

function Celula({ rotulo, children, className = "" }: { rotulo: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <small>{rotulo}</small>
      {children}
    </div>
  );
}

/** Folha do boleto (330 px de largura; a cena muda o tamanho com scale). */
function BoletoPapel({ className = "", style }: { className?: string; style?: CSSProperties }) {
  return (
    <div className={`ent-boleto w-[330px] ${className}`} style={style}>
      <div className="flex justify-between gap-2 px-2.5 pb-2 pt-[9px]">
        <div className="flex items-center gap-[7px]">
          <img src={wsaLogo} alt="" className="h-[26px] w-[26px] rounded-full" />
          <div>
            <b className="block text-[10.5px]">Empresa Exemplo</b>
            <span className="text-[7px] text-[#6b6760]">CNPJ 00.000.000/0001-00</span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-px text-[7.5px] text-[#6b6760]">
          <b className="text-[9px] uppercase tracking-[0.06em] text-[#1d1d1f]">Recibo do Pagador</b>
          <span>
            Venc. <b className="text-[#1d1d1f]">10/11/2026</b>
          </span>
          <span>
            Valor <b className="text-[#1d1d1f]">R$ 1.250,00</b>
          </span>
        </div>
      </div>
      <div className="mx-1.5 border-t-[1.5px] border-dashed border-[#b9b4aa]" />
      <div className="flex items-center gap-[7px] border-b-2 border-[#1d1d1f] px-2.5 py-[7px]">
        <span className="inline-flex items-center gap-1 whitespace-nowrap text-[10px] font-extrabold">
          <Landmark size={13} strokeWidth={2.2} /> Banco Exemplo
        </span>
        <span className="border-x-2 border-[#1d1d1f] px-1.5 text-[11px] font-extrabold">000-0</span>
        <span className="overflow-hidden whitespace-nowrap font-mono text-[7.4px] font-semibold">
          00090.12345 67890.123456 78901.234567 1 98760000125000
        </span>
      </div>
      <div className="ent-bol-grade grid grid-cols-[1fr_1fr_0.7fr_1.1fr]">
        <Celula rotulo="Local de pagamento" className="col-span-3">
          Pagável em qualquer banco ou pelo Pix
        </Celula>
        <Celula rotulo="Vencimento" className="dir">
          <b className="text-[10px]">10/11/2026</b>
        </Celula>
        <Celula rotulo="Beneficiário" className="col-span-3">
          Empresa Exemplo Ltda
        </Celula>
        <Celula rotulo="Agência / Código" className="dir">
          0000 / 00000-0
        </Celula>
        <Celula rotulo="Data doc.">24/10/2026</Celula>
        <Celula rotulo="Nº documento">2026/11-204</Celula>
        <Celula rotulo="Espécie">DM</Celula>
        <Celula rotulo="Nosso número" className="dir">
          00000000204
        </Celula>
        <Celula rotulo="Pagador" className="col-span-3">
          Ana Souza · CPF ***.456.789-**
        </Celula>
        <Celula rotulo="(=) Valor do documento" className="dir">
          <b className="text-[10px]">R$ 1.250,00</b>
        </Celula>
        <Celula rotulo="Instruções" className="col-span-3">
          Não receber após 30 dias do vencimento
        </Celula>
        <Celula rotulo="(-) Desconto" className="dir">
          {" "}
        </Celula>
      </div>
      <div className="flex items-end justify-between gap-2.5 px-2.5 pb-[9px] pt-2">
        <div className="flex-1">
          <svg viewBox={`0 0 ${larguraBarras} 40`} preserveAspectRatio="none" className="block h-8 w-full fill-[#111]">
            {BARRAS.map((b) => (
              <rect key={b.x} x={b.x} y={0} width={b.w} height={40} />
            ))}
          </svg>
          <small>Ficha de Compensação · Autenticação mecânica</small>
        </div>
        <div className="text-center">
          <svg viewBox={`0 0 ${N} ${N}`} shapeRendering="crispEdges" className="block h-[46px] w-[46px] fill-[#111]">
            {QR.map(([x, y]) => (
              <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} />
            ))}
            <MarcadorQr x={0} y={0} />
            <MarcadorQr x={N - 7} y={0} />
            <MarcadorQr x={0} y={N - 7} />
          </svg>
          <small>Pix</small>
        </div>
      </div>
      <span className="absolute left-[36%] top-[46%] -rotate-[14deg] text-[26px] font-extrabold tracking-[0.25em] text-[oklch(0.55_0.11_250/0.13)]">
        EXEMPLO
      </span>
    </div>
  );
}

/** Cena em tela cheia do painel da esquerda (absolute inset-0 dentro de um pai relative com overflow-hidden). */
export function BoletoIlustracao({ className = "" }: { className?: string }) {
  return (
    <div className={`ent-cena pointer-events-none select-none ${className}`} aria-hidden="true">
      {/* boletos de fundo, desfocados, saindo pelas bordas */}
      <BoletoPapel className="ent-boleto-fundo absolute -left-[110px] -top-[60px] rotate-[16deg] blur-[1.5px] min-[901px]:-left-[70px] min-[901px]:-top-[40px]" />
      <BoletoPapel className="ent-boleto-fundo absolute -right-[170px] top-[4%] -rotate-[22deg] blur-[2px] min-[901px]:-right-[130px] min-[901px]:top-[12%]" />

      {/* base laranja curva (face de cima + lateral) */}
      <span className="ent-base absolute -left-[12%] top-[60%] h-[130px] w-[124%] rounded-[50%] min-[901px]:top-[60%] min-[901px]:h-[170px]" />
      <span className="ent-base-topo absolute -left-[12%] top-[55%] h-[110px] w-[124%] rounded-[50%] min-[901px]:top-[55%] min-[901px]:h-[150px]" />

      {/* boleto principal, apoiado na base */}
      <div className="absolute left-1/2 top-[6%] origin-top -translate-x-[38%] scale-[0.62] min-[901px]:top-[17%] min-[901px]:scale-[1.55]">
        <div className="ent-flutua">
          <BoletoPapel className="relative" style={{ transform: "rotateX(8deg) rotateY(-12deg) rotateZ(-10deg)" }} />
        </div>
      </div>

      {/* moedas e traço laranja */}
      <Moeda className="absolute left-[9%] top-[46%] z-[2] h-[82px] w-[82px] text-[82px] min-[901px]:left-[12%] min-[901px]:top-[57%] min-[901px]:h-[96px] min-[901px]:w-[96px] min-[901px]:text-[96px]">
        <FileCheck2 className="h-[44%] w-[44%] text-[#fff8ee]" strokeWidth={2.2} />
      </Moeda>
      <Moeda
        className="absolute right-[22%] -top-[26px] z-[2] h-[64px] w-[64px] text-[64px] min-[901px]:h-[78px] min-[901px]:w-[78px] min-[901px]:text-[78px]"
        style={{ animationDelay: "-3s" }}
      />
      <Moeda
        className="absolute right-[8%] top-[46%] z-[2] hidden h-[40px] w-[40px] text-[40px] blur-[1.5px] min-[901px]:grid"
        style={{ animationDelay: "-5s" }}
      />
      <span className="absolute right-[7%] top-[10%] h-3 w-14 -rotate-[32deg] rounded-sm bg-[oklch(0.7_0.17_45)] shadow-[0_6px_14px_rgb(0_0_0/0.35)]" />
    </div>
  );
}
