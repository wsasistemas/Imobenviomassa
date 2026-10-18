import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { StepShell } from "@/components/wizard/step-shell";
import {
  useWizardStore,
  isTelefoneValido,
  isEmailValido,
  formatTelefone,
} from "@/stores/wizard-store";

import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AlertCircle, CheckCircle2, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/disparo/novo/compradores")({
  component: EtapaCompradores,
});

function EtapaCompradores() {
  const navigate = useNavigate();
  const compradores = useWizardStore((s) => s.compradores);
  const selecionados = useWizardStore((s) => s.selecionados);
  const setSelecionados = useWizardStore((s) => s.setSelecionados);
  const filtrosTotvs = useWizardStore((s) => s.filtros_totvs);
  const origem = useWizardStore((s) => s.origem);
  const [busca, setBusca] = useState("");
  const [limite, setLimite] = useState(10);


  const enriched = useMemo(
    () =>
      compradores.map((c) => {
        const telOk = isTelefoneValido(c.telefone);
        const emailOk = isEmailValido(c.email);
        const extras = (c.dados_extras ?? {}) as Record<string, unknown>;
        const nomeSegundo =
          typeof extras.nome_conjuge === "string" && extras.nome_conjuge.trim()
            ? extras.nome_conjuge.trim()
            : null;
        const asStr = (v: unknown) =>
          typeof v === "string" ? v.trim().toLowerCase() : "";
        const principalFlag = Object.entries(extras).some(([k, v]) => {
          const key = k.toLowerCase();
          const val = asStr(v);
          if (/principal|titular/.test(key)) {
            return val === ""
              ? false
              : /^(s|sim|true|1|y|yes|principal|titular)$/.test(val);
          }
          if (/tipo.*(cliente|comprador|pessoa)|papel|fun[cç][aã]o/.test(key)) {
            return /principal|titular/.test(val);
          }
          return false;
        });
        const isPrincipal = principalFlag || !!nomeSegundo;
        return {
          ...c,
          valido: telOk && emailOk && !!c.nome,
          telOk,
          emailOk,
          nomeSegundo,
          isPrincipal,
        };
      }),
    [compradores],
  );


  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return enriched;
    return enriched.filter(
      (c) =>
        c.nome.toLowerCase().includes(q) ||
        (c.telefone ?? "").toLowerCase().includes(q) ||
        (c.email ?? "").toLowerCase().includes(q),
    );
  }, [enriched, busca]);


  const validos = enriched.filter((c) => c.valido);
  const selecionadosValidos = selecionados.filter((id) =>
    validos.some((v) => v.id === id),
  );

  const toggleAll = () => {
    const ids = filtrados.filter((c) => c.valido).map((c) => c.id);
    const allSel = ids.every((id) => selecionados.includes(id));
    if (allSel) {
      setSelecionados(selecionados.filter((id) => !ids.includes(id)));
    } else {
      setSelecionados(Array.from(new Set([...selecionados, ...ids])));
    }
  };

  const toggle = (id: string) => {
    if (selecionados.includes(id)) setSelecionados(selecionados.filter((s) => s !== id));
    else setSelecionados([...selecionados, id]);
  };

  return (
    <StepShell
      title="Compradores"
      description="Selecione quem receberá o documento. Linhas inválidas ficam desabilitadas."
      prevPath="/disparo/novo/origem"
      onNext={() => navigate({ to: "/disparo/novo/modelo" })}
      nextDisabled={selecionadosValidos.length === 0}
      nextLabel={`Continuar com ${selecionadosValidos.length} selecionados`}
    >
      {(() => {
        if (origem === "excel") return null;
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

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Buscar por nome, telefone ou e-mail…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <div className="flex gap-2 text-xs">
          <Badge variant="secondary">Total: {enriched.length}</Badge>
          <Badge variant="secondary">Válidos: {validos.length}</Badge>
          <Badge>{selecionadosValidos.length} selecionados</Badge>
        </div>
      </div>


      {compradores.length === 0 ? (
        <div className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
          Nenhum comprador carregado. Volte à etapa 1.
        </div>
      ) : (
        <div className="flex gap-3">
          <div className="flex-1 rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={
                        filtrados.filter((c) => c.valido).length > 0 &&
                        filtrados
                          .filter((c) => c.valido)
                          .every((c) => selecionados.includes(c.id))
                      }
                      onCheckedChange={toggleAll}
                    />
                  </TableHead>
                  <TableHead>Bloco</TableHead>
                  <TableHead>Unidade</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Tipo de comprador</TableHead>
                  <TableHead>Status</TableHead>

                </TableRow>

              </TableHeader>
              <TableBody>
                {filtrados.slice(0, limite).map((c) => (
                  <TableRow key={c.id} className={cn(!c.valido && "opacity-60")}>
                    <TableCell>
                      <Checkbox
                        disabled={!c.valido}
                        checked={selecionados.includes(c.id)}
                        onCheckedChange={() => toggle(c.id)}
                      />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {c.bloco || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {c.unidade || "—"}
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className="flex flex-col gap-1">
                        <span>{c.nome || "—"}</span>
                        {c.nomeSegundo && (
                          <span className="text-xs font-normal text-muted-foreground">
                            2º comprador: {c.nomeSegundo}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className={cn(!c.telOk && "text-destructive")}>
                      {formatTelefone(c.telefone)}
                    </TableCell>
                    <TableCell className={cn(!c.emailOk && "text-destructive", "max-w-[200px] truncate")}>
                      {c.email || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={c.nomeSegundo ? "default" : "secondary"} className="text-[10px]">
                        {c.nomeSegundo ? "Principal + 2º comprador" : "Principal"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {c.valido ? (
                        <span className="flex items-center gap-1 text-xs text-primary">
                          <CheckCircle2 className="h-3 w-3" /> ok
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-destructive">
                          <AlertCircle className="h-3 w-3" />
                          {!c.nome ? "sem nome" : !c.telOk ? "telefone" : !c.emailOk ? "e-mail" : "inválido"}
                        </span>
                      )}
                    </TableCell>


                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {filtrados.length > limite && (
            <div className="flex w-40 flex-col gap-2 border-l pl-3 text-xs text-muted-foreground">
              <span className="mb-1">
                Exibindo {limite} de {filtrados.length}.
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
                onClick={() => setLimite(filtrados.length)}
              >
                Exibir todos
              </Button>
            </div>
          )}
        </div>
      )}
    </StepShell>
  );
}
