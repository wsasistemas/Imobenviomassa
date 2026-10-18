import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { StepShell } from "@/components/wizard/step-shell";
import { useWizardStore, isTelefoneValido, isEmailValido, isCPFValido, formatTelefone } from "@/stores/wizard-store";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { baixarCsv, linhasCsv, mascararDocumento } from "@/lib/csv";

export const Route = createFileRoute("/_authenticated/disparo/novo/verificacao")({
  component: EtapaVerificacao,
});

function EtapaVerificacao() {
  const navigate = useNavigate();
  const compradores = useWizardStore((s) => s.compradores);
  const selecionados = useWizardStore((s) => s.selecionados);
  const modelo = useWizardStore((s) => s.modelo);
  const filtrosTotvs = useWizardStore((s) => s.filtros_totvs);
  const canais = useWizardStore((s) => s.canais);
  const [limite, setLimite] = useState(10);

  const exigeWhatsapp = canais === "whatsapp" || canais === "ambos";
  const exigeEmail = canais === "email" || canais === "ambos";

  const rows = useMemo(() => {
    return compradores
      .filter((c) => selecionados.includes(c.id))
      .map((c) => {
        const problemas = new Set<string>();
        if (!c.nome) problemas.add("nome");
        if (exigeWhatsapp && !isTelefoneValido(c.telefone)) problemas.add("telefone");
        if (exigeEmail && !isEmailValido(c.email)) problemas.add("email");
        if (!c.bloco || String(c.bloco).trim() === "") problemas.add("bloco");
        if (!c.unidade || String(c.unidade).trim() === "") problemas.add("unidade");
        if (c.cpf && !isCPFValido(c.cpf)) problemas.add("cpf");

        const extras = (c.dados_extras ?? {}) as Record<string, unknown>;
        const nomeSegundo =
          typeof extras.nome_conjuge === "string" && extras.nome_conjuge.trim()
            ? extras.nome_conjuge.trim()
            : null;
        return {
          ...c,
          status: problemas.size === 0 ? "pronto" : "erro",
          problemas: [...problemas],
          nomeSegundo,
        };
      });
  }, [compradores, selecionados, exigeWhatsapp, exigeEmail]);


  const prontos = rows.filter((r) => r.status === "pronto");
  const erros = rows.filter((r) => r.status === "erro");

  const LABELS: Record<string, string> = {
    nome: "Nome ausente",
    cpf: "CPF inválido",
    cpf_ausente: "CPF ausente",
    telefone: "Telefone/WhatsApp inválido",
    empreendimento: "Empreendimento ausente",
    bloco: "Bloco ausente",
    unidade: "Unidade ausente",
    email: "E-mail ausente/inválido",
  };
  const rotular = (p: string) => LABELS[p] ?? `${p} ausente`;

  // Colunas que precisam ser adicionadas à origem (planilha ou TOTVS)
  const camposFaltando = useMemo(() => {
    const set = new Set<string>();
    for (const r of erros) for (const p of r.problemas) set.add(p);
    return [...set];
  }, [erros]);

  const baixarErrosCsv = () => {
    // LGPD: CPF mascarado no CSV do navegador; células protegidas contra injeção de fórmula.
    const csv = linhasCsv([
      ["id", "nome", "CPF (mascarado)", "telefone", "email", "erro"],
      ...erros.map((r) => [
        r.id,
        r.nome,
        mascararDocumento(r.cpf),
        r.telefone ?? "",
        r.email ?? "",
        r.problemas.map(rotular).join(" | "),
      ]),
    ]);
    baixarCsv("erros-campanha.csv", csv);
  };

  return (
    <StepShell
      title="Verificação final"
      description="Confirmação dos destinatários prontos para envio."
      prevPath="/disparo/novo/modelo"
      onNext={() => navigate({ to: "/disparo/novo/assinatura" })}
      nextDisabled={prontos.length === 0}
      nextLabel={`Continuar com ${prontos.length} destinatários`}
      extraActions={
        erros.length > 0 ? (
          <Button variant="outline" onClick={baixarErrosCsv}>
            <Download className="mr-2 h-4 w-4" /> Baixar erros ({erros.length})
          </Button>
        ) : null
      }
    >
      {(() => {
        const empNome =
          filtrosTotvs?.empreendimento_nome ??
          compradores.find((c) => c.empreendimento)?.empreendimento ??
          null;
        if (!empNome) return null;
        return (
          <div className="mb-4 rounded-lg border bg-muted/40 px-4 py-2 text-sm">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              Empreendimento
            </span>
            <div className="font-medium">{empNome}</div>
          </div>
        );
      })()}

      <div className="mb-4 flex gap-2">
        <Badge className="bg-primary/20 text-primary hover:bg-primary/30">
          Prontos: {prontos.length}
        </Badge>
        <Badge variant="destructive">Com erro: {erros.length}</Badge>
      </div>
      {erros.length > 0 && camposFaltando.length > 0 && (
        <div className="mb-4 rounded-md border border-amber-300/60 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-100">
          <div className="font-medium">Campos exigidos pelo modelo selecionado e ausentes na origem:</div>
          <div className="mt-1 text-xs">
            {camposFaltando.map(rotular).join(" · ")}
          </div>
          <div className="mt-2 text-xs opacity-80">
            Adicione essas colunas à planilha (ou escolha outro modelo que não use esses campos) e reimporte a origem.
          </div>
        </div>
      )}
      <div className="flex gap-3">
        <div className="flex-1 rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bloco</TableHead>
                <TableHead>Unidade</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Tipo de comprador</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Erro</TableHead>
              </TableRow>

            </TableHeader>
            <TableBody>
              {rows.slice(0, limite).map((r) => (
                <TableRow key={r.id}>
                  <TableCell className={r.bloco ? "text-muted-foreground" : "text-destructive"}>
                    {r.bloco || "—"}
                  </TableCell>
                  <TableCell className={r.unidade ? "text-muted-foreground" : "text-destructive"}>
                    {r.unidade || "—"}
                  </TableCell>
                  <TableCell className="font-medium">
                    <div className="flex flex-col gap-1">
                      <span>{r.nome || "—"}</span>
                      {r.nomeSegundo && (
                        <span className="text-xs font-normal text-muted-foreground">
                          2º comprador: {r.nomeSegundo}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className={isTelefoneValido(r.telefone) ? "text-muted-foreground" : "text-destructive"}>
                    {formatTelefone(r.telefone)}
                  </TableCell>
                  <TableCell className={`${isEmailValido(r.email) ? "text-muted-foreground" : "text-destructive"} max-w-[220px] truncate`}>
                    {r.email || "—"}
                  </TableCell>

                  <TableCell>
                    <Badge variant={r.nomeSegundo ? "default" : "secondary"} className="text-[10px]">
                      {r.nomeSegundo ? "Principal + 2º comprador" : "Principal"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {r.status === "pronto" ? (
                      <Badge className="bg-primary/20 text-primary hover:bg-primary/30">
                        pronto
                      </Badge>
                    ) : (
                      <Badge variant="destructive">erro</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.problemas.length ? r.problemas.map(rotular).join(", ") : "—"}</TableCell>
                </TableRow>
              ))}

            </TableBody>
          </Table>
        </div>
        {rows.length > limite && (
          <div className="flex w-40 flex-col gap-2 border-l pl-3 text-xs text-muted-foreground">
            <span className="mb-1">
              Exibindo {limite} de {rows.length}.
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setLimite((n) => n + 10)}
            >
              Exibir mais 10
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setLimite(rows.length)}
            >
              Exibir todos
            </Button>
          </div>
        )}
      </div>
    </StepShell>
  );
}
