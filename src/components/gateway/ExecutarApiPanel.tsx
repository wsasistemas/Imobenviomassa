import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { AlertTriangle, Copy, Download, Loader2, Play } from "lucide-react";
import { gwProxy, gwSoapById } from "@/lib/gateway";
import { baixarCsv as baixarArquivoCsv, linhasCsv } from "@/lib/csv";

export interface ApiRegistro {
  id?: string;
  name: string;
  base_url?: string;
  endpoint: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  description?: string;
  source?: string;
  auth_type?: "none" | "basic" | "bearer" | "header" | null;
  auth_secret_ref?: string | null;
  soap_service?: string | null;
  soap_action?: string | null;
  soap_envelope_template?: string | null;
  soap_response_path?: string | null;
}

interface Props {
  api: ApiRegistro;
}

function extractPlaceholders(endpoint: string): string[] {
  const set = new Set<string>();
  const re1 = /\{([a-zA-Z0-9_]+)\}/g;
  const re2 = /:([a-zA-Z0-9_]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re1.exec(endpoint))) set.add(m[1]);
  while ((m = re2.exec(endpoint))) set.add(m[1]);
  return Array.from(set);
}

function applyParamsPreview(endpoint: string, params: Record<string, string>) {
  let out = endpoint;
  for (const [k, v] of Object.entries(params)) {
    if (!v) continue;
    out = out.replaceAll(`{${k}}`, v).replaceAll(`:${k}`, v);
  }
  return out;
}

export function ExecutarApiPanel({ api }: Props) {
  const isGet = api.method === "GET";
  const placeholders = useMemo(() => extractPlaceholders(api.endpoint), [api.endpoint]);
  const [params, setParams] = useState<Record<string, string>>({});
  const [bodyJson, setBodyJson] = useState<string>(isGet ? "" : "{\n  \n}");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const [statusInfo, setStatusInfo] = useState<{ status: number; ok: boolean; url: string } | null>(null);

  const hasBaseUrl = !!api.base_url && /^https?:\/\//i.test(api.base_url);

  const previewUrl = useMemo(() => {
    if (!hasBaseUrl) return null;
    const ep = applyParamsPreview(api.endpoint, params);
    const base = api.base_url!.replace(/\/$/, "");
    const sep = ep.startsWith("/") ? "" : "/";
    return `${base}${sep}${ep}`;
  }, [api.base_url, api.endpoint, params, hasBaseUrl]);

  // Extrai pares "?parameters=CHAVE1={ph1};CHAVE2={ph2}" para envio via
  // `totvsParameters` no api-proxy (o proxy monta o encoding correto do TOTVS RM).
  function extractTotvsParams(
    endpoint: string,
    values: Record<string, string>,
  ): { totvsParameters: Record<string, string>; consumed: Set<string> } | null {
    const m = endpoint.match(/[?&]parameters=([^&]+)/i);
    if (!m) return null;
    const totvs: Record<string, string> = {};
    const consumed = new Set<string>();
    for (const pair of m[1].split(";")) {
      const [k, rawV] = pair.split("=");
      if (!k) continue;
      const phMatch = rawV?.match(/^\{([a-zA-Z0-9_]+)\}$|^:([a-zA-Z0-9_]+)$/);
      const phName = phMatch?.[1] ?? phMatch?.[2];
      if (phName) {
        const v = values[phName] ?? "";
        totvs[k] = v;
        consumed.add(phName);
      } else if (rawV != null) {
        totvs[k] = rawV;
      }
    }
    return { totvsParameters: totvs, consumed };
  }

  async function executar() {
    const faltando = placeholders.filter((p) => !params[p]?.trim());
    if (faltando.length) {
      toast.error(`Preencha os parâmetros: ${faltando.join(", ")}`);
      return;
    }

    let body: unknown = undefined;
    if (!isGet && bodyJson.trim()) {
      try {
        body = JSON.parse(bodyJson);
      } catch {
        toast.error("JSON do body inválido");
        return;
      }
    }

    if (!api.id) {
      toast.error("API sem id — salve o registro antes de executar.");
      return;
    }

    setLoading(true);
    setError(null);
    setResponse(null);
    setElapsedMs(null);
    setStatusInfo(null);

    const start = performance.now();
    try {
      // SOAP → totvs-soap-proxy
      if ((api.source ?? "").toLowerCase() === "soap") {
        const resp = await gwSoapById(api.id, { ...params, ...(body ? { body } : {}) });
        const ms = Math.round(performance.now() - start);
        setElapsedMs(resp.duration_ms ?? ms);
        setStatusInfo({
          status: resp.status ?? (resp.ok ? 200 : 0),
          ok: !!resp.ok,
          url: previewUrl ?? api.endpoint,
        });
        if (!resp.ok) {
          setError(resp.error ?? "Falha na chamada SOAP");
          setResponse(resp.raw ?? resp.parsed ?? null);
          return;
        }
        setResponse(resp.data ?? resp.parsed ?? null);
        toast.success("Execução concluída");
        return;
      }

      // REST/SQL → api-proxy
      const totvs = extractTotvsParams(api.endpoint, params);
      const restParams: Record<string, string> = {};
      for (const [k, v] of Object.entries(params)) {
        if (!v) continue;
        if (totvs?.consumed.has(k)) continue;
        restParams[k] = v;
      }
      const resp = await gwProxy(api.id, {
        params: restParams,
        totvsParameters: totvs?.totvsParameters,
        body,
      });
      const ms = Math.round(performance.now() - start);
      setElapsedMs(resp.elapsedMs ?? ms);
      setStatusInfo({
        status: resp.status,
        ok: resp.ok,
        url: resp.url ?? previewUrl ?? api.endpoint,
      });
      if (!resp.ok) {
        setError(resp.error ?? `HTTP ${resp.status}`);
        setResponse(resp.data ?? resp.rawBody ?? null);
        return;
      }
      setResponse(resp.data ?? null);
      toast.success("Execução concluída");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      toast.error("Erro ao executar API", { description: msg });
    } finally {
      setLoading(false);
    }
  }


  function copiarJson() {
    if (response == null) return;
    navigator.clipboard.writeText(JSON.stringify(response, null, 2));
    toast.success("JSON copiado");
  }

  function baixarCsv() {
    if (!Array.isArray(response) || response.length === 0) {
      toast.error("Resposta não é um array de objetos");
      return;
    }
    const rows = response as Record<string, unknown>[];
    const headers = Array.from(
      rows.reduce<Set<string>>((acc, r) => {
        if (r && typeof r === "object") Object.keys(r).forEach((k) => acc.add(k));
        return acc;
      }, new Set()),
    );
    // Células protegidas contra injeção de fórmula (dados vêm de API externa).
    const csv = linhasCsv([headers, ...rows.map((r) => headers.map((h) => r[h]))]);
    baixarArquivoCsv(`${api.name.replace(/\s+/g, "_")}.csv`, csv);
  }

  const methodVariant =
    api.method === "GET" ? "secondary" : api.method === "POST" ? "default" : "destructive";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant={methodVariant}>{api.method}</Badge>
        <code className="text-xs bg-muted px-2 py-1 rounded">{api.endpoint}</code>
        {api.auth_type && api.auth_type !== "none" && (
          <Badge variant="outline" className="text-xs">
            auth: {api.auth_type}
          </Badge>
        )}
        {api.description && (
          <span className="text-sm text-muted-foreground">— {api.description}</span>
        )}
      </div>

      {!hasBaseUrl && (
        <div className="flex items-start gap-2 p-3 rounded-md border border-amber-500/50 bg-amber-500/10 text-sm">
          <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-600 shrink-0" />
          <div>
            <p className="font-medium text-amber-700 dark:text-amber-400">
              Sem base_url cadastrada
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Cadastre uma URL completa no campo <code>base_url</code> do registro para executar.
            </p>
          </div>
        </div>
      )}

      {placeholders.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
            Parâmetros do endpoint
          </Label>
          <div className="grid gap-2 sm:grid-cols-2">
            {placeholders.map((p) => (
              <div key={p} className="grid gap-1">
                <Label className="text-xs">{p}</Label>
                <Input
                  value={params[p] ?? ""}
                  onChange={(e) => setParams({ ...params, [p]: e.target.value })}
                  placeholder={`valor para ${p}`}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {previewUrl && (
        <div className="grid gap-1">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">URL final</Label>
          <code className="text-xs bg-muted px-2 py-1.5 rounded break-all">{previewUrl}</code>
        </div>
      )}

      {!isGet && (
        <div className="grid gap-2">
          <Label>Body (JSON)</Label>
          <Textarea
            value={bodyJson}
            onChange={(e) => setBodyJson(e.target.value)}
            rows={6}
            className="font-mono text-xs"
            placeholder='{"chave": "valor"}'
          />
        </div>
      )}

      <div className="flex gap-2">
        <Button onClick={executar} disabled={loading || !hasBaseUrl}>
          {loading ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <Play className="h-4 w-4 mr-1" />
          )}
          Executar
        </Button>
        {response != null && (
          <>
            <Button variant="outline" onClick={copiarJson}>
              <Copy className="h-4 w-4 mr-1" /> Copiar JSON
            </Button>
            {Array.isArray(response) && (
              <Button variant="outline" onClick={baixarCsv}>
                <Download className="h-4 w-4 mr-1" /> Baixar CSV
              </Button>
            )}
          </>
        )}
      </div>

      {(response != null || error) && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
            {error ? <Badge variant="destructive">Erro</Badge> : <Badge variant="secondary">OK</Badge>}
            {statusInfo && <span>HTTP {statusInfo.status}</span>}
            {elapsedMs != null && <span>{elapsedMs} ms</span>}
            {Array.isArray(response) && <span>{response.length} item(ns)</span>}
          </div>
          <pre
            className={`text-xs p-3 rounded-md border max-h-[400px] overflow-auto ${
              error
                ? "bg-destructive/10 border-destructive/50 text-destructive"
                : "bg-muted"
            }`}
          >
            {error ?? JSON.stringify(response, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
