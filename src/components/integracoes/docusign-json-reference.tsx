import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Check, Copy, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { carregarConfigDocusign } from "@/lib/integracoes/docusign.functions";
import {
  CATEGORIAS,
  ENDPOINTS,
  ERROS_COMUNS,
  type Endpoint,
} from "./docusign-json-data";

type Ambiente = "demo" | "producao";

const AMB_URLS: Record<Ambiente, { base: string; auth: string }> = {
  demo: {
    base: "https://demo.docusign.net/restapi/v2.1",
    auth: "https://account-d.docusign.com",
  },
  producao: {
    base: "https://www.docusign.net/restapi/v2.1",
    auth: "https://account.docusign.com",
  },
};

function replaceVars(text: string, amb: Ambiente, accountId: string): string {
  const { base, auth } = AMB_URLS[amb];
  let out = text.replaceAll("{{base_url}}", base).replaceAll("{{auth_url}}", auth);
  if (accountId) out = out.replaceAll("{{account_id}}", accountId);
  return out;
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      className="h-7 gap-1 text-xs"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copiado" : "Copiar"}
    </Button>
  );
}

function CodeBlock({
  code,
  language,
}: {
  code: string;
  language?: string;
}) {
  return (
    <div className="relative rounded-md border bg-muted/40">
      <div className="flex items-center justify-between border-b px-3 py-1.5">
        <span className="text-[10px] font-mono uppercase text-muted-foreground">
          {language ?? "text"}
        </span>
        <CopyBtn text={code} />
      </div>
      <pre className="overflow-x-auto p-3 text-xs leading-relaxed">
        <code className="font-mono">{code}</code>
      </pre>
    </div>
  );
}

function metodoColor(m: Endpoint["metodo"]) {
  return m === "GET"
    ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/30"
    : "bg-blue-500/15 text-blue-600 border-blue-500/30";
}

function EndpointCard({
  ep,
  amb,
  accountId,
}: {
  ep: Endpoint;
  amb: Ambiente;
  accountId: string;
}) {
  const path = replaceVars(ep.path, amb, accountId);
  const headersText = Object.entries(ep.headers)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");

  return (
    <Card id={ep.id} className="scroll-mt-24">
      <CardHeader className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={cn("font-mono", metodoColor(ep.metodo))}>
            {ep.metodo}
          </Badge>
          <CardTitle className="text-base">{ep.titulo}</CardTitle>
          {ep.implementadoEm && (
            <Badge
              variant="outline"
              className="ml-auto gap-1 border-primary/40 bg-primary/10 text-[10px] text-primary"
            >
              <Zap className="h-3 w-3" />
              Em uso pelo sistema
            </Badge>
          )}
        </div>
        <code className="block break-all rounded bg-muted px-2 py-1 text-xs font-mono">
          {path}
        </code>
        {ep.implementadoEm && (
          <p className="text-[11px] text-muted-foreground">
            Chamado por{" "}
            <code className="font-mono text-foreground">{ep.implementadoEm}</code>
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label className="text-xs text-muted-foreground">Headers</Label>
          <div className="mt-1">
            <CodeBlock code={headersText} language="http" />
          </div>
        </div>
        {ep.body && (
          <div>
            <Label className="text-xs text-muted-foreground">
              Body ({ep.bodyType === "form" ? "x-www-form-urlencoded" : "json"})
            </Label>
            <div className="mt-1">
              <CodeBlock code={ep.body} language={ep.bodyType === "form" ? "form" : "json"} />
            </div>
          </div>
        )}
        <div>
          <Label className="text-xs text-muted-foreground">Resposta</Label>
          <div className="mt-1">
            <CodeBlock code={ep.response} language="json" />
          </div>
        </div>
        {ep.notas && ep.notas.length > 0 && (
          <ul className="list-disc space-y-1 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 pl-6 text-xs text-black">
            {ep.notas.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function DocusignJsonReference() {
  const [amb, setAmb] = useState<Ambiente>("demo");
  const [accountId, setAccountId] = useState<string>("");
  const [configCarregada, setConfigCarregada] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const cfg = await carregarConfigDocusign();
        if (cfg.ambiente) setAmb(cfg.ambiente);
        if (cfg.account_id) setAccountId(cfg.account_id);
        setConfigCarregada(Boolean(cfg.account_id));
      } catch {
        /* silencioso - usuário pode não ter config ainda */
      }
    })();
  }, []);

  const grupos = useMemo(
    () =>
      CATEGORIAS.map((c) => ({
        ...c,
        items: ENDPOINTS.filter((e) => e.categoria === c.id),
      })),
    [],
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
      <aside className="lg:sticky lg:top-4 lg:self-start">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Navegação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {grupos.map((g) => (
              <div key={g.id}>
                <div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
                  {g.label}
                </div>
                <ul className="space-y-0.5">
                  {g.items.map((ep) => (
                    <li key={ep.id}>
                      <a
                        href={`#${ep.id}`}
                        className="block truncate rounded px-2 py-1 text-xs hover:bg-muted"
                      >
                        <span
                          className={cn(
                            "mr-1 font-mono text-[10px]",
                            ep.metodo === "GET" ? "text-emerald-600" : "text-blue-600",
                          )}
                        >
                          {ep.metodo}
                        </span>
                        {ep.titulo}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <div>
              <div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
                4. Erros
              </div>
              <a
                href="#erros-comuns"
                className="block truncate rounded px-2 py-1 text-xs hover:bg-muted"
              >
                Códigos de erro comuns
              </a>
            </div>
          </CardContent>
        </Card>
      </aside>

      <div className="space-y-4">
        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium">Variáveis do sistema</div>
                <p className="text-xs text-muted-foreground">
                  Os placeholders <code className="font-mono">{`{{base_url}}`}</code>,{" "}
                  <code className="font-mono">{`{{auth_url}}`}</code> e{" "}
                  <code className="font-mono">{`{{account_id}}`}</code> são substituídos pelos
                  valores reais usados pelo backend.
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={amb === "demo" ? "default" : "outline"}
                  onClick={() => setAmb("demo")}
                >
                  Demo
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={amb === "producao" ? "default" : "outline"}
                  onClick={() => setAmb("producao")}
                >
                  Produção
                </Button>
              </div>
            </div>
            <div className="grid gap-2 rounded-md border bg-muted/30 p-3 text-xs sm:grid-cols-3">
              <div>
                <div className="text-[10px] uppercase text-muted-foreground">base_url</div>
                <code className="break-all font-mono">{AMB_URLS[amb].base}</code>
              </div>
              <div>
                <div className="text-[10px] uppercase text-muted-foreground">auth_url</div>
                <code className="break-all font-mono">{AMB_URLS[amb].auth}</code>
              </div>
              <div>
                <div className="text-[10px] uppercase text-muted-foreground">account_id</div>
                <code className="break-all font-mono">
                  {accountId || (configCarregada ? "—" : "(salve a configuração DocuSign)")}
                </code>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              <code className="font-mono">{`{{access_token}}`}</code> é obtido automaticamente via
              JWT (RS256) e cacheado pelo backend — não precisa ser preenchido manualmente.
            </p>
          </CardContent>
        </Card>

        {grupos.map((g) => (
          <section key={g.id} className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {g.label}
            </h3>
            {g.items.map((ep) => (
              <EndpointCard key={ep.id} ep={ep} amb={amb} accountId={accountId} />
            ))}
          </section>
        ))}

        <Card id="erros-comuns" className="scroll-mt-24">
          <CardHeader>
            <CardTitle className="text-base">4. Códigos de erro comuns</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">HTTP</TableHead>
                  <TableHead>Código DocuSign</TableHead>
                  <TableHead>Causa</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ERROS_COMUNS.map((e) => (
                  <TableRow key={`${e.http}-${e.codigo}`}>
                    <TableCell className="font-mono text-xs">{e.http}</TableCell>
                    <TableCell className="font-mono text-xs">{e.codigo}</TableCell>
                    <TableCell className="text-xs">{e.causa}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
