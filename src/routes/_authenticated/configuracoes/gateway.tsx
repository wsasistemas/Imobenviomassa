import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Info,
  Loader2,
  Network,
  Play,
  Plus,
  RefreshCw,
  Trash2,
  Zap,
} from "lucide-react";
import { getApisRegistradas } from "@/lib/gateway";
import { registrarApiGateway, removerApiGateway } from "@/lib/gateway.functions";
import { AbasIntegracoes } from "@/components/integracoes/abas-integracoes";
import { ExecutarApiPanel } from "@/components/gateway/ExecutarApiPanel";
import { PageHead, SemAcesso } from "@/components/page";
import { useCurrentUser } from "@/hooks/use-current-user";

export const Route = createFileRoute("/_authenticated/configuracoes/gateway")({
  component: GatewayPage,
});

interface ApiRegistro {
  id?: string;
  name: string;
  base_url: string;
  endpoint: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  description: string;
  source: string;
  auth_type: "none" | "basic" | "bearer" | "header";
  auth_secret_ref: string;
  soap_service?: string;
  soap_action?: string;
  soap_envelope_template?: string;
  soap_response_path?: string;
}

const sourceOptions = [
  { value: "rest", label: "API REST" },
  { value: "soap", label: "SOAP" },
  { value: "webhook", label: "Webhook" },
  { value: "endpoint", label: "Endpoint Genérico" },
];

const authTypeOptions = [
  { value: "none", label: "Nenhuma" },
  { value: "basic", label: "Basic (user/password)" },
  { value: "bearer", label: "Bearer Token" },
  { value: "header", label: "Header customizado" },
] as const;

const methodOptions = ["GET", "POST", "PUT", "DELETE"] as const;

const soapServiceOptions = [
  { value: "consultaSQL", label: "consultaSQL (RealizarConsultaSQL)" },
  { value: "dataServer", label: "dataServer (SaveRecord)" },
  { value: "process", label: "process (ExecuteWithParams / XmlParams)" },
] as const;

const emptyForm: ApiRegistro = {
  name: "",
  base_url: "",
  endpoint: "",
  method: "GET",
  description: "",
  source: "rest",
  auth_type: "none",
  auth_secret_ref: "",
  soap_service: "",
  soap_action: "",
  soap_envelope_template: "",
  soap_response_path: "",
};

function GatewayPage() {
  const { pode, loading } = useCurrentUser();
  if (loading) return null;
  if (!pode("gateway")) return <SemAcesso texto="Seu perfil não tem acesso ao Gateway de APIs." />;
  return <GatewayConteudo />;
}

function GatewayConteudo() {
  // Cadastrar/apagar APIs é de Super Admin (o banco exige): uma API apontando para outro host
  // receberia as credenciais do RM. Admin consulta e executa.
  const { pode } = useCurrentUser();
  const podeCadastrar = pode("credenciais");
  const registrarApi = useServerFn(registrarApiGateway);
  const removerApi = useServerFn(removerApiGateway);
  const [apis, setApis] = useState<ApiRegistro[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<ApiRegistro>({ ...emptyForm });
  const [execApi, setExecApi] = useState<ApiRegistro | null>(null);

  useEffect(() => {
    fetchApis();
  }, []);

  async function fetchApis() {
    setLoading(true);
    try {
      const data = await getApisRegistradas();
      setApis(Array.isArray(data) ? (data as ApiRegistro[]) : []);
      setLoadError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setLoadError(msg);
      toast.error("Erro ao carregar APIs", { id: "apis-load", description: msg });
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!form.name || !form.endpoint) {
      toast.error("Preencha ao menos o nome e o endpoint");
      return;
    }
    setSaving(true);
    const snapshot = { ...form };
    try {
      await registrarApi({ data: form });
      toast.success("API registrada com sucesso!");
      setDialogOpen(false);
      setForm({ ...emptyForm });
      fetchApis();
      setExecApi(snapshot);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error("Erro ao registrar API", { description: msg });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await removerApi({ data: { id } });
      toast.success("API removida com sucesso!");
      fetchApis();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error("Erro ao remover API", { description: msg });
    }
  }

  const sourceLabel = (s: string) =>
    sourceOptions.find((o) => o.value === s)?.label ?? s;

  return (
    <div className="flex flex-col gap-5">
      <AbasIntegracoes />
      <PageHead title="Gateway de APIs">
        Registre, gerencie e consulte os endpoints do TOTVS RM no gateway centralizado. As chamadas ao RM usam as
        credenciais de Integrações TOTVS RM.
      </PageHead>

      <Tabs defaultValue="registro" className="w-full">
        <TabsList>
          <TabsTrigger value="registro" className="gap-1.5">
            <Network className="h-4 w-4" />
            Registro de APIs
          </TabsTrigger>
          <TabsTrigger value="executar" className="gap-1.5">
            <Zap className="h-4 w-4" />
            Executar
          </TabsTrigger>
        </TabsList>

        <TabsContent value="registro">
          <div className="mb-4 flex items-start gap-2 rounded-md border border-primary/20 bg-primary/5 p-3 text-sm">
            <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <p className="text-muted-foreground">
              APIs registradas aqui aparecem automaticamente na aba{" "}
              <strong className="text-foreground">Executar</strong>.
            </p>
          </div>
          <div className="flex justify-end mb-4 gap-2">
            <Button variant="outline" size="sm" onClick={fetchApis} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
            <Button onClick={() => setDialogOpen(true)} disabled={!podeCadastrar} title={podeCadastrar ? undefined : "Só um Super Admin cadastra APIs no gateway"}>
              <Plus className="h-4 w-4 mr-1" />
              Registrar Nova API
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>APIs Registradas</CardTitle>
              <CardDescription>
                Endpoints cadastrados na tabela{" "}
                <code className="text-xs bg-muted px-1 py-0.5 rounded">
                  api_registry
                </code>
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-muted-foreground">Carregando...</span>
                </div>
              ) : loadError ? (
                <div className="flex flex-col items-center gap-3 py-12 text-center">
                  <p className="text-sm text-destructive">{loadError}</p>
                  <Button variant="outline" size="sm" onClick={fetchApis}>
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Tentar novamente
                  </Button>
                </div>
              ) : apis.length === 0 ? (
                <p className="text-center text-muted-foreground py-12">
                  Nenhuma API registrada ainda. Clique em "Registrar Nova API" para começar.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Método</TableHead>
                      <TableHead>URL Base</TableHead>
                      <TableHead>Endpoint</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="w-[80px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {apis.map((api) => (
                      <TableRow key={api.id}>
                        <TableCell className="font-medium">{api.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{sourceLabel(api.source)}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              api.method === "GET"
                                ? "secondary"
                                : api.method === "POST"
                                  ? "default"
                                  : "destructive"
                            }
                          >
                            {api.method}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                          {api.base_url || "—"}
                        </TableCell>
                        <TableCell>
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                            {api.endpoint}
                          </code>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[250px] truncate">
                          {api.description || "—"}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => api.id && handleDelete(api.id)}
                            disabled={!podeCadastrar}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="executar">
          <Card>
            <CardHeader>
              <CardTitle>Executar API registrada</CardTitle>
              <CardDescription>
                Selecione uma API registrada e dispare a chamada. GETs executam direto;
                demais métodos abrem editor de body JSON.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : apis.length === 0 ? (
                <p className="text-center text-muted-foreground py-12">
                  Nenhuma API registrada. Cadastre uma na aba "Registro de APIs".
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Método</TableHead>
                      <TableHead>Endpoint</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="w-[120px]">Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {apis.map((api) => (
                      <TableRow key={api.id}>
                        <TableCell className="font-medium">{api.name}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              api.method === "GET"
                                ? "secondary"
                                : api.method === "POST"
                                  ? "default"
                                  : "destructive"
                            }
                          >
                            {api.method}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                            {api.endpoint}
                          </code>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[300px] truncate">
                          {api.description || "—"}
                        </TableCell>
                        <TableCell>
                          <Button size="sm" onClick={() => setExecApi(api)}>
                            <Play className="h-4 w-4 mr-1" />
                            Executar
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!execApi} onOpenChange={(o) => !o && setExecApi(null)}>
        <DialogContent className="sm:max-w-[720px]">
          <DialogHeader>
            <DialogTitle>Executar: {execApi?.name}</DialogTitle>
            <DialogDescription>Chamada dinâmica via Gateway centralizado.</DialogDescription>
          </DialogHeader>
          {execApi && <ExecutarApiPanel api={execApi} />}
        </DialogContent>
      </Dialog>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[540px]">
          <DialogHeader>
            <DialogTitle>Registrar Nova API</DialogTitle>
            <DialogDescription>
              Preencha os dados do endpoint para registrar no Gateway.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Nome *</Label>
              <Input
                placeholder="Ex: Consulta Fluxo de Caixa"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Tipo</Label>
                <Select
                  value={form.source}
                  onValueChange={(v) => setForm({ ...form, source: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {sourceOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Método</Label>
                <Select
                  value={form.method}
                  onValueChange={(v) =>
                    setForm({ ...form, method: v as ApiRegistro["method"] })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {methodOptions.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label>URL Base</Label>
              <Input
                placeholder="Ex: https://api.exemplo.com"
                value={form.base_url}
                onChange={(e) => setForm({ ...form, base_url: e.target.value })}
              />
            </div>

            <div className="grid gap-2">
              <Label>Endpoint *</Label>
              <Input
                placeholder="Ex: /v1/financeiro/fluxo-caixa"
                value={form.endpoint}
                onChange={(e) => setForm({ ...form, endpoint: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Autenticação</Label>
                <Select
                  value={form.auth_type}
                  onValueChange={(v) =>
                    setForm({ ...form, auth_type: v as ApiRegistro["auth_type"] })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {authTypeOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>
                  Secret de auth{" "}
                  <span className="text-xs text-muted-foreground font-normal">
                    {form.auth_type === "basic" && "(vazio ou começando com \"TOTVS\" = credenciais de Integrações → TOTVS RM; outras APIs: prefixo dos secrets <REF>_USER/<REF>_PASSWORD)"}
                    {form.auth_type === "bearer" && "(nome do secret)"}
                    {form.auth_type === "header" && "(NomeHeader:NOME_SECRET)"}
                  </span>
                </Label>
                <Input
                  placeholder={
                    form.auth_type === "basic"
                      ? "TOTVS"
                      : form.auth_type === "bearer"
                        ? "MOVIDESK_TOKEN"
                        : form.auth_type === "header"
                          ? "X-API-Key:MINHA_API_KEY"
                          : "—"
                  }
                  value={form.auth_secret_ref}
                  onChange={(e) =>
                    setForm({ ...form, auth_secret_ref: e.target.value })
                  }
                  disabled={form.auth_type === "none"}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Descrição</Label>
              <Textarea
                placeholder="Descrição breve do endpoint..."
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                rows={3}
              />
            </div>
            {form.source === "soap" && (
              <div className="grid gap-3 rounded-md border border-primary/20 bg-primary/5 p-3">
                <Label className="text-xs uppercase tracking-wide text-primary">
                  Configuração SOAP
                </Label>
                <div className="grid gap-2">
                  <Label className="text-xs">Serviço</Label>
                  <Select
                    value={form.soap_service ?? ""}
                    onValueChange={(v) => setForm({ ...form, soap_service: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="consultaSQL / dataServer / process" />
                    </SelectTrigger>
                    <SelectContent>
                      {soapServiceOptions.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label className="text-xs">SOAPAction (URL completa)</Label>
                  <Input
                    placeholder="http://www.totvs.com/IwsConsultaSQL/RealizarConsultaSQL"
                    value={form.soap_action ?? ""}
                    onChange={(e) => setForm({ ...form, soap_action: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label className="text-xs">
                    Envelope XML (deixe vazio para usar o template compartilhado do serviço)
                  </Label>
                  <Textarea
                    rows={6}
                    className="font-mono text-xs"
                    placeholder="<soapenv:Envelope ...>{{params}}</soapenv:Envelope>"
                    value={form.soap_envelope_template ?? ""}
                    onChange={(e) =>
                      setForm({ ...form, soap_envelope_template: e.target.value })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label className="text-xs">Response path (jsonpath dot)</Label>
                  <Input
                    placeholder="Envelope.Body.RealizarConsultaSQLResponse.RealizarConsultaSQLResult"
                    value={form.soap_response_path ?? ""}
                    onChange={(e) =>
                      setForm({ ...form, soap_response_path: e.target.value })
                    }
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Registrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
