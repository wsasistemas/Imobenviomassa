import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { StepShell } from "@/components/wizard/step-shell";
import { useWizardStore } from "@/stores/wizard-store";
import { obterModeloDocusign } from "@/lib/integracoes/docusign.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useEffect } from "react";

export const Route = createFileRoute("/_authenticated/disparo/novo/assinatura")({
  component: EtapaAssinatura,
});

const PAPEIS = [
  { key: "comprador", label: "Comprador" },
  { key: "conjuge", label: "2º comprador" },
  { key: "fiador", label: "Fiador" },
] as const;

function EtapaAssinatura() {
  const navigate = useNavigate();
  const config = useWizardStore((s) => s.config_assinatura);
  const setConfig = useWizardStore((s) => s.setConfig);
  const modelo = useWizardStore((s) => s.modelo);
  const setModelo = useWizardStore((s) => s.setModelo);
  const obterModelo = useServerFn(obterModeloDocusign);

  useEffect(() => {
    if (!modelo?.id) return;
    let active = true;
    (async () => {
      try {
        const res = await obterModelo({ data: { id: modelo.id } });
        if (active && res.modelo) setModelo(res.modelo);
      } catch {
        // Mantém os dados já salvos no wizard caso a atualização falhe.
      }
    })();
    return () => {
      active = false;
    };
  }, [modelo?.id]);

  // Detecta automaticamente se o modelo suporta 2 compradores
  // (baseado em placeholders OU em >=2 papéis/signatários no template DocuSign)
  const ph = modelo?.placeholders ?? [];
  const papeis = modelo?.papeis ?? [];
  const modeloText = [modelo?.nome, modelo?.descricao, ...ph, ...papeis].join(" ");
  const suporta2Compradores =
    /comprador[_\s-]*0?2|comprador[_\s-]*dois|2[º°]?\s*comprador|segundo[_\s-]*comprador|dois\s+ou\s+mais\s+compradores|conjuge|cônjuge/i.test(modeloText) ||
    papeis.length >= 2;

  // Se o modelo não suporta, força "nenhum"
  useEffect(() => {
    if (!suporta2Compradores && config.segundo_comprador !== "nenhum") {
      setConfig({ segundo_comprador: "nenhum" });
    }
  }, [suporta2Compradores, config.segundo_comprador, setConfig]);

  const toggle = (key: (typeof PAPEIS)[number]["key"]) => {
    const has = config.ordem.includes(key);
    setConfig({
      ordem: has ? config.ordem.filter((k) => k !== key) : [...config.ordem, key],
    });
  };

  return (
    <StepShell
      title="Configuração da assinatura"
      description="Participação do 2º comprador, lembretes e expiração."
      prevPath="/disparo/novo/verificacao"
      onNext={() => navigate({ to: "/disparo/novo/revisao" })}
    >
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardContent className="space-y-3 pt-6">
              <Label className="text-xs">Segundo comprador</Label>
              <Select
                value={config.segundo_comprador}
                onValueChange={(v) =>
                  setConfig({ segundo_comprador: v as typeof config.segundo_comprador })
                }
                disabled={!suporta2Compradores}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nenhum">Não há segundo comprador</SelectItem>
                  <SelectItem value="assina">Assina o documento</SelectItem>
                  <SelectItem value="cc">Recebe apenas em cópia (CC)</SelectItem>
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-muted-foreground">
                {suporta2Compradores
                  ? "Define se o segundo comprador entra como signatário ou apenas em CC no envelope DocuSign."
                  : "O modelo selecionado não possui variáveis para 2º comprador — opção desabilitada automaticamente."}
              </p>

          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Prazos e idioma</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Lembrete (dias)</Label>
              <Input
                type="number"
                min={1}
                value={config.lembretes_dias}
                onChange={(e) => setConfig({ lembretes_dias: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label>Expiração (dias)</Label>
              <Input
                type="number"
                min={1}
                value={config.expira_dias}
                onChange={(e) => setConfig({ expira_dias: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label>Idioma da cerimônia</Label>
              <Select
                value={config.idioma}
                onValueChange={(v) =>
                  setConfig({ idioma: v as typeof config.idioma })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pt-BR">Português (Brasil)</SelectItem>
                  <SelectItem value="en-US">English (US)</SelectItem>
                  <SelectItem value="es">Español</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>
    </StepShell>
  );
}
