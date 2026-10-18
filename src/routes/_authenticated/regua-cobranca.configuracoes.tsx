import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Clock, Loader2, Lock } from "lucide-react";
import { PageHead, SemAcesso } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IconeIlustrativo } from "@/components/icones/icone-colorido";
import { Aviso } from "@/components/regua/ui";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  obterConfigRegua,
  removerPdfsVencidos,
  salvarConfigRegua,
} from "@/lib/regua/regua.functions";
import { ROTULO_REGRA_SENHA, dataHoraBr, senhaDoPdf, type RegraSenha } from "@/lib/regua/comum";

export const Route = createFileRoute("/_authenticated/regua-cobranca/configuracoes")({
  component: ConfigReguaPage,
});

function ConfigReguaPage() {
  const { podeAcessar, loading } = useCurrentUser();
  const qc = useQueryClient();
  const carregar = useServerFn(obterConfigRegua);
  const salvar = useServerFn(salvarConfigRegua);
  const limpar = useServerFn(removerPdfsVencidos);
  const {
    data: c,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["regua-config"],
    queryFn: () => carregar(),
    enabled: !loading && podeAcessar("regua_config_editar"),
  });
  const [regra, setRegra] = useState<RegraSenha>("cpf_5_primeiros");
  const [dica, setDica] = useState("");
  const [validade, setValidade] = useState("72");
  const [intervalo, setIntervalo] = useState("2");
  const [ocupado, setOcupado] = useState<string | null>(null);

  useEffect(() => {
    if (!c) return;
    setRegra(c.regraSenha);
    setDica(c.textoDica);
    setValidade(String(c.validadeLinkHoras));
    setIntervalo(String(c.intervaloWhatsappSeg));
  }, [c]);

  if (loading) return null;
  if (!podeAcessar("regua_config_editar"))
    return <SemAcesso texto="Seu perfil não altera as configurações da Régua de Cobrança." />;
  if (error)
    return (
      <Aviso tom="danger">
        {error instanceof Error ? error.message : "Não foi possível carregar."}
      </Aviso>
    );
  if (isLoading || !c) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
      </div>
    );
  }

  const seg = Number(intervalo) || 0;
  const minutos1000 = Math.ceil((1000 * Math.max(seg, 0.5)) / 60);
  const mudou =
    regra !== c.regraSenha ||
    dica !== c.textoDica ||
    validade !== String(c.validadeLinkHoras) ||
    intervalo !== String(c.intervaloWhatsappSeg);

  async function gravar() {
    setOcupado("salvar");
    try {
      await salvar({
        data: {
          regraSenha: regra,
          textoDica: dica,
          validadeLinkHoras: Number(validade),
          intervaloWhatsappSeg: Number(intervalo),
        },
      });
      toast.success("Configurações salvas.");
      await qc.invalidateQueries({ queryKey: ["regua-config"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setOcupado(null);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHead title="Configurações da régua">
        Senha do PDF, validade do link e ritmo de envio. Credenciais ficam em Configurações ›
        Integrações.
      </PageHead>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="flex flex-col gap-3.5 rounded-xl border bg-card px-5 py-4 shadow-card">
          <div className="flex items-center gap-3.5">
            <div className="grid h-[46px] w-[46px] place-items-center rounded-xl bg-secondary">
              <IconeIlustrativo icon={Lock} size={28} />
            </div>
            <div>
              <h2 className="text-[16px] font-bold">Senha do PDF</h2>
              <p className="text-[12.5px] text-muted-foreground">
                Aplicada no servidor ao gerar cada boleto.
              </p>
            </div>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-semibold">Regra da senha</span>
            <select
              className="h-9 rounded-[7px] border border-border-strong bg-card px-2.5 text-[13px]"
              value={regra}
              onChange={(e) => setRegra(e.target.value as RegraSenha)}
            >
              {(Object.keys(ROTULO_REGRA_SENHA) as RegraSenha[]).map((k) => (
                <option key={k} value={k}>
                  {ROTULO_REGRA_SENHA[k]}
                </option>
              ))}
            </select>
            <small className="text-[11.5px] text-muted-foreground">
              Exemplo com o CPF 123.456.789-09: senha {senhaDoPdf(regra, "12345678909")}.
            </small>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-semibold">Texto da dica (vai na mensagem)</span>
            <Input value={dica} onChange={(e) => setDica(e.target.value)} maxLength={200} />
            <small className="text-[11.5px] text-muted-foreground">
              Vira a variável {"{{dica_senha}}"} do WhatsApp e do e-mail. Confira se combina com a
              regra escolhida.
            </small>
          </label>
        </section>
        <section className="flex flex-col gap-3.5 rounded-xl border bg-card px-5 py-4 shadow-card">
          <div className="flex items-center gap-3.5">
            <div className="grid h-[46px] w-[46px] place-items-center rounded-xl bg-secondary">
              <IconeIlustrativo icon={Clock} size={28} />
            </div>
            <div>
              <h2 className="text-[16px] font-bold">Link e ritmo de envio</h2>
              <p className="text-[12.5px] text-muted-foreground">Valem para os próximos lotes.</p>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-[12.5px] font-semibold">Validade do link (horas)</span>
              <Input
                value={validade}
                onChange={(e) => setValidade(e.target.value.replace(/\D/g, ""))}
              />
              <small className="text-[11.5px] text-muted-foreground">
                Mínimo 6 h: a Zenvia baixa o PDF depois do envio.
              </small>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[12.5px] font-semibold">
                Intervalo entre WhatsApp (segundos)
              </span>
              <Input
                value={intervalo}
                onChange={(e) => setIntervalo(e.target.value.replace(/\D/g, ""))}
              />
              <small className="text-[11.5px] text-muted-foreground">
                Lote de 1.000 boletos ≈ {minutos1000} min só de intervalo.
              </small>
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2 rounded-lg bg-secondary px-3 py-2.5 text-[12px] text-muted-foreground">
            <span>
              {c.pdfsAtivos} PDF(s) guardados no bucket privado. Os vencidos são removidos durante o
              envio dos lotes; você também pode remover agora.
            </span>
            <Button
              size="sm"
              variant="outline"
              className="ml-auto"
              disabled={!!ocupado}
              onClick={async () => {
                setOcupado("limpar");
                try {
                  const r = await limpar();
                  toast.success(`${r.removidos} PDF(s) vencidos removidos.`);
                  await qc.invalidateQueries({ queryKey: ["regua-config"] });
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Não foi possível remover.");
                } finally {
                  setOcupado(null);
                }
              }}
            >
              {ocupado === "limpar" && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Remover PDFs vencidos
            </Button>
          </div>
        </section>
      </div>
      <section className="flex flex-wrap items-center gap-2.5 rounded-xl border bg-card px-5 py-3.5 shadow-card">
        <span className="text-[12px] text-muted-foreground">
          Alterações gravadas na Auditoria (antes e depois)
          {c.atualizadoPor
            ? ` · salvo em ${dataHoraBr(c.atualizadoEm)} por ${c.atualizadoPor}`
            : ""}
        </span>
        <div className="ml-auto flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!mudou}
            onClick={() => {
              setRegra(c.regraSenha);
              setDica(c.textoDica);
              setValidade(String(c.validadeLinkHoras));
              setIntervalo(String(c.intervaloWhatsappSeg));
            }}
          >
            Descartar
          </Button>
          <Button size="sm" disabled={!mudou || !!ocupado} onClick={() => void gravar()}>
            {ocupado === "salvar" && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}Salvar
          </Button>
        </div>
      </section>
    </div>
  );
}
