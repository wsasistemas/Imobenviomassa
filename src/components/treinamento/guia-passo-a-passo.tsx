import { useState } from "react";
import { AlertTriangle, Download, ImageOff, Info, Lightbulb, Loader2, MapPin, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { PageHead, Panel, Selo } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { baixarGuiaHtml } from "@/lib/treinamento/guia-html";
import { ROTULO_ALERTA, urlDoPrint, type Alerta, type Exemplo, type Guia, type Passo, type Print } from "@/lib/treinamento/tipos";
import { cn } from "@/lib/utils";
import wsaLogo from "@/assets/wsa-logo.png";

export function GuiaPassoAPasso({ guia }: { guia: Guia }) {
  const [gerando, setGerando] = useState(false);

  async function baixar() {
    setGerando(true);
    try {
      const { semPrint } = await baixarGuiaHtml(guia, wsaLogo);
      if (semPrint > 0) {
        toast.warning("Guia baixado, mas alguns prints ainda não foram adicionados.", {
          description: `${semPrint} imagem(ns) aparecem como espaço reservado no arquivo.`,
        });
      } else {
        toast.success("Guia baixado.", { description: "Arquivo único, abre em qualquer navegador sem o portal." });
      }
    } catch {
      toast.error("Não foi possível gerar o arquivo do guia.");
    } finally {
      setGerando(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHead
        title={guia.titulo}
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link to="/treinamento">Voltar ao Centro de Treinamento</Link>
            </Button>
            <Button size="sm" onClick={baixar} disabled={gerando}>
              {gerando ? <Loader2 className="animate-spin" /> : <Download />}
              Baixar versão HTML
            </Button>
          </>
        }
      >
        {guia.subtitulo}
      </PageHead>

      <div className="grid items-start gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav aria-label="Neste guia" className="rounded-[10px] border bg-card px-3 py-3 lg:sticky lg:top-0">
          <p className="mb-2 px-1 text-[10.5px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Neste guia</p>
          <ol className="flex flex-col gap-0.5">
            {guia.passos.map((p, i) => (
              <li key={p.id}>
                <a
                  href={`#${p.id}`}
                  className="flex items-start gap-2 rounded-md px-1.5 py-1.5 text-[12.5px] leading-snug hover:bg-primary-soft hover:text-primary"
                >
                  <span className="mt-px flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                    {i + 1}
                  </span>
                  {p.titulo}
                </a>
              </li>
            ))}
            <li>
              <a
                href="#problemas"
                className="flex items-start gap-2 rounded-md px-1.5 py-1.5 text-[12.5px] leading-snug hover:bg-primary-soft hover:text-primary"
              >
                <span className="mt-px flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                  {guia.passos.length + 1}
                </span>
                Problemas comuns e quem acionar
              </a>
            </li>
          </ol>
        </nav>

        <div className="flex min-w-0 flex-col gap-4">
          {guia.passos.map((p, i) => (
            <PassoCard key={p.id} passo={p} numero={i + 1} slug={guia.slug} />
          ))}

          <Panel className="scroll-mt-4" title={<span id="problemas">Problemas comuns e quem acionar</span>}>
            <div className="overflow-auto rounded-[10px] border">
              <table className="w-full text-[12.5px]">
                <thead className="bg-muted text-left">
                  <tr>
                    <th className="px-3 py-2">O que acontece</th>
                    <th className="px-3 py-2">Por quê</th>
                    <th className="px-3 py-2">O que fazer</th>
                  </tr>
                </thead>
                <tbody>
                  {guia.problemas.map((x) => (
                    <tr key={x.sintoma} className="border-t align-top">
                      <td className="px-3 py-2 font-semibold">{x.sintoma}</td>
                      <td className="px-3 py-2">{x.causa}</td>
                      <td className="px-3 py-2">{x.solucao}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-[13px] text-muted-foreground">{guia.suporte}</p>
          </Panel>

          <p className="text-[12px] text-muted-foreground">
            {guia.publico} · Atualizado em {guia.atualizadoEm}
          </p>
        </div>
      </div>
    </div>
  );
}

function PassoCard({ passo, numero, slug }: { passo: Passo; numero: number; slug: string }) {
  return (
    <section id={passo.id} className="scroll-mt-4 rounded-[10px] border bg-card px-5 py-4">
      <div className="mb-3 flex items-start gap-3.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-[15px] font-bold text-primary-foreground">
          {numero}
        </div>
        <div className="min-w-0">
          <h2 className="text-[16px] font-bold leading-tight">{passo.titulo}</h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">{passo.resumo}</p>
          {(passo.onde || passo.perfil) && (
            <div className="mt-2 flex flex-wrap gap-2">
              {passo.onde && (
                <Selo tom="info">
                  <MapPin className="mr-1 h-3 w-3" />
                  {passo.onde}
                </Selo>
              )}
              {passo.perfil && (
                <Selo>
                  <UserRound className="mr-1 h-3 w-3" />
                  {passo.perfil}
                </Selo>
              )}
            </div>
          )}
        </div>
      </div>

      <ol className="ml-5 list-decimal space-y-1.5 text-[13.5px] leading-relaxed marker:font-bold marker:text-primary">
        {passo.instrucoes.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ol>

      {passo.prints.map((pr) => (
        <PrintDaTela key={pr.arquivo} print={pr} slug={slug} />
      ))}

      {passo.alertas?.map((a) => <CaixaAlerta key={a.titulo} alerta={a} />)}
      {passo.exemplo && <CaixaExemplo exemplo={passo.exemplo} />}
    </section>
  );
}

function PrintDaTela({ print, slug }: { print: Print; slug: string }) {
  const [falhou, setFalhou] = useState(false);
  const [aberto, setAberto] = useState(false);
  const src = urlDoPrint(slug, print.arquivo);

  return (
    <figure className="my-4">
      {falhou ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border-2 border-dashed bg-muted/50 px-4 py-10 text-center text-[13px] text-muted-foreground">
          <ImageOff className="h-6 w-6" />
          Print da tela: {print.legenda}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAberto(true)}
          className="block w-full cursor-zoom-in overflow-hidden rounded-lg border bg-muted/30"
          aria-label={`Ampliar: ${print.legenda}`}
        >
          <img src={src} alt={print.legenda} loading="lazy" onError={() => setFalhou(true)} className="block w-full" />
        </button>
      )}
      <figcaption className="mt-1.5 text-[12px] text-muted-foreground">{print.legenda}</figcaption>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-h-[92vh] w-[96vw] max-w-[1400px] overflow-auto p-2">
          <DialogTitle className="sr-only">{print.legenda}</DialogTitle>
          <img src={src} alt={print.legenda} className="block w-full rounded-md" />
        </DialogContent>
      </Dialog>
    </figure>
  );
}

const ESTILO_ALERTA: Record<Alerta["tipo"], { cls: string; Icone: typeof Info }> = {
  critico: { cls: "border-primary bg-primary-soft text-primary-dark", Icone: AlertTriangle },
  atencao: { cls: "border-warning bg-warning-soft text-warning", Icone: Info },
  dica: { cls: "border-info bg-info-soft text-info", Icone: Lightbulb },
};

function CaixaAlerta({ alerta }: { alerta: Alerta }) {
  const { cls, Icone } = ESTILO_ALERTA[alerta.tipo];
  return (
    <div role="note" className={cn("my-3 flex gap-2.5 rounded-lg border-l-4 px-3.5 py-2.5", cls)}>
      <Icone className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.04em]">
          {ROTULO_ALERTA[alerta.tipo]} — {alerta.titulo}
        </p>
        <p className="mt-0.5 text-[13px] text-foreground">{alerta.texto}</p>
      </div>
    </div>
  );
}

function CaixaExemplo({ exemplo }: { exemplo: Exemplo }) {
  return (
    <div className="my-3 rounded-lg border border-success/30 bg-success-soft px-4 py-3">
      <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.04em] text-success">
        Exemplo prático — {exemplo.titulo}
      </p>
      {exemplo.texto && <p className="mb-2 text-[13px]">{exemplo.texto}</p>}
      {exemplo.tabela && (
        <div className="mb-2 overflow-auto rounded-md border bg-card">
          <table className="w-full text-[12.5px]">
            <thead className="bg-muted text-left">
              <tr>
                {exemplo.tabela.colunas.map((c) => (
                  <th key={c} className="px-3 py-1.5">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {exemplo.tabela.linhas.map((l) => (
                <tr key={l.join("|")} className="border-t">
                  {l.map((c, i) => (
                    <td key={`${i}-${c}`} className="px-3 py-1.5">
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {exemplo.conclusao && <p className="text-[13px] font-semibold">{exemplo.conclusao}</p>}
    </div>
  );
}
