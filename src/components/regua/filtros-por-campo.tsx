import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Filter, Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IconeIlustrativo } from "@/components/icones/icone-colorido";
import { Aviso } from "@/components/regua/ui";
import { camposDaOrigemRm } from "@/lib/regua/lote.functions";
import {
  OPERADORES,
  aplicarFiltrosCampos,
  camposDeLinhas,
  type CampoOrigem,
  type FaixaAtraso,
  type FiltroCampo,
  type TipoRegua,
} from "@/lib/regua/comum";

// Filtros montados pelo usuário sobre os campos (colunas) que a origem traz: a API do TOTVS RM cadastrada no
// Gateway ou a planilha. Somam-se às faixas prontas; todos precisam ser verdadeiros (E). Aplicados no servidor
// ao montar o lote (lote.functions › prepararLote) e gravados em regua_lote.filtros.campos.

const sel = "h-9 rounded-[7px] border border-border-strong bg-card px-2.5 text-[13px]";

export function FiltrosPorCampo({
  origem,
  linhasPlanilha,
  consulta,
  filtros,
  onChange,
}: {
  origem: "rm" | "planilha";
  linhasPlanilha: Record<string, unknown>[] | null;
  consulta: {
    tipoRegua: TipoRegua;
    faixa: FaixaAtraso | null;
    diasMin: number | null;
    diasMax: number | null;
    vencimentoDe: string | null;
    vencimentoAte: string | null;
  };
  filtros: FiltroCampo[];
  onChange: (f: FiltroCampo[]) => void;
}) {
  const lerCampos = useServerFn(camposDaOrigemRm);
  const [camposRm, setCamposRm] = useState<{ campos: CampoOrigem[]; total: number } | null>(null);
  const [carregando, setCarregando] = useState(false);

  const campos = useMemo<CampoOrigem[]>(
    () => (origem === "planilha" ? camposDeLinhas(linhasPlanilha ?? []) : (camposRm?.campos ?? [])),
    [origem, linhasPlanilha, camposRm],
  );
  const total = origem === "planilha" ? (linhasPlanilha?.length ?? 0) : (camposRm?.total ?? null);
  // Na planilha dá para mostrar na hora quantas linhas passam nos filtros.
  const passam = useMemo(
    () =>
      origem === "planilha" && linhasPlanilha
        ? aplicarFiltrosCampos(linhasPlanilha, filtros).length
        : null,
    [origem, linhasPlanilha, filtros],
  );

  async function carregar() {
    setCarregando(true);
    try {
      const r = await lerCampos({ data: consulta });
      setCamposRm(r);
      toast.success(`${r.campos.length} campos lidos de ${r.total} linhas do TOTVS RM.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível ler os campos do TOTVS RM.");
    } finally {
      setCarregando(false);
    }
  }

  const mudar = (i: number, m: Partial<FiltroCampo>) =>
    onChange(filtros.map((f, k) => (k === i ? { ...f, ...m } : f)));

  return (
    <section className="flex flex-col gap-3.5 rounded-xl border bg-card px-5 py-4 shadow-card">
      <div className="flex flex-wrap items-center gap-3.5">
        <div className="grid h-[46px] w-[46px] place-items-center rounded-xl bg-secondary">
          <IconeIlustrativo icon={Filter} size={28} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-[16px] font-bold">Filtros por campo (opcional)</h2>
          <p className="text-[12.5px] text-muted-foreground">
            Além da faixa, monte filtros com os campos que{" "}
            {origem === "rm" ? "a API do TOTVS RM devolve" : "a planilha traz"}. Todos precisam ser
            atendidos ao mesmo tempo.
          </p>
        </div>
        {origem === "rm" && (
          <Button variant="outline" size="sm" disabled={carregando} onClick={() => void carregar()}>
            {carregando ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            )}
            {camposRm ? "Recarregar campos" : "Carregar campos do TOTVS"}
          </Button>
        )}
      </div>

      {origem === "rm" && !camposRm && (
        <Aviso>
          Clique em <b>Carregar campos do TOTVS</b>: o sistema consulta a API com o tipo de régua e
          a faixa escolhidos e lista as colunas disponíveis para filtrar (ex.: obra, situação, tipo
          de parcela, valor).
        </Aviso>
      )}
      {origem === "planilha" && !linhasPlanilha?.length && (
        <Aviso>Envie a planilha no passo 1 para filtrar pelas colunas dela.</Aviso>
      )}

      {campos.length > 0 && (
        <>
          {filtros.length === 0 && (
            <p className="text-[12.5px] text-muted-foreground">
              Nenhum filtro por campo. O lote considera todos os boletos da faixa.
            </p>
          )}
          <div className="flex flex-col gap-2">
            {filtros.map((f, i) => {
              const campo = campos.find((c) => c.nome === f.campo);
              const op = OPERADORES.find((o) => o.id === f.op)!;
              const lista = `regua-ex-${i}`;
              return (
                <div
                  key={i}
                  className="flex flex-wrap items-center gap-2 rounded-lg border bg-secondary/40 p-2"
                >
                  <span className="w-6 text-center text-[11.5px] font-bold text-muted-foreground">
                    {i === 0 ? "SE" : "E"}
                  </span>
                  <select
                    className={`${sel} min-w-[180px]`}
                    value={f.campo}
                    onChange={(e) => mudar(i, { campo: e.target.value })}
                  >
                    <option value="">Escolha o campo…</option>
                    {campos.map((c) => (
                      <option key={c.nome} value={c.nome}>
                        {c.nome}
                        {c.tipo !== "texto" ? ` (${c.tipo === "data" ? "data" : "número"})` : ""}
                      </option>
                    ))}
                  </select>
                  <select
                    className={sel}
                    value={f.op}
                    onChange={(e) => mudar(i, { op: e.target.value as FiltroCampo["op"] })}
                  >
                    {OPERADORES.filter(
                      (o) =>
                        campo?.tipo === "texto" ||
                        !["contem", "nao_contem"].includes(o.id) ||
                        !campo,
                    ).map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.rotulo}
                      </option>
                    ))}
                  </select>
                  {op.valores >= 1 && (
                    <>
                      <Input
                        list={lista}
                        value={f.valor ?? ""}
                        onChange={(e) => mudar(i, { valor: e.target.value })}
                        placeholder={campo?.tipo === "data" ? "dd/mm/aaaa" : "valor"}
                        className="h-9 w-[180px] bg-card"
                      />
                      <datalist id={lista}>
                        {(campo?.exemplos ?? []).map((x) => (
                          <option key={x} value={x} />
                        ))}
                      </datalist>
                    </>
                  )}
                  {op.valores === 2 && (
                    <>
                      <span className="text-[12px] text-muted-foreground">e</span>
                      <Input
                        value={f.valor2 ?? ""}
                        onChange={(e) => mudar(i, { valor2: e.target.value })}
                        placeholder={campo?.tipo === "data" ? "dd/mm/aaaa" : "valor"}
                        className="h-9 w-[140px] bg-card"
                      />
                    </>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto"
                    onClick={() => onChange(filtros.filter((_, k) => k !== i))}
                    aria-label="Remover filtro"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              disabled={filtros.length >= 20}
              onClick={() => onChange([...filtros, { campo: "", op: "igual", valor: "" }])}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Adicionar filtro
            </Button>
            <span className="text-[12px] text-muted-foreground">
              {campos.length} campos disponíveis
              {total != null ? ` · ${total} linhas na origem` : ""}
              {passam != null && filtros.length ? ` · ${passam} passam nos filtros` : ""}
            </span>
          </div>
          <p className="text-[11.5px] text-muted-foreground">
            Campos com dado pessoal (CPF, nome, telefone, e-mail) aparecem para filtrar, mas sem
            exemplos de valor.
          </p>
        </>
      )}
    </section>
  );
}
