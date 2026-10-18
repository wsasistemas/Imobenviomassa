import { createFileRoute } from "@tanstack/react-router";
import { Check, Crown, Minus, ShieldCheck, User } from "lucide-react";
import { PageHead, Panel, SemAcesso, Selo } from "@/components/page";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  DESCRICAO_NIVEL,
  GRUPOS_PERMISSAO,
  NIVEIS,
  NIVEL_LABEL,
  PERMISSAO_INFO,
  nivelPode,
  type Nivel,
  type Permissao,
} from "@/lib/permissoes";

export const Route = createFileRoute("/_authenticated/administracao/perfis")({
  component: PerfisPage,
});

const ICONE: Record<Nivel, typeof Crown> = { superadmin: Crown, admin: ShieldCheck, analista: User };

function PerfisPage() {
  const { pode, nivel, loading } = useCurrentUser();
  if (loading) return null;
  if (!pode("usuarios")) return <SemAcesso texto="Seu perfil não tem acesso a esta tela." />;

  const permissoes = Object.keys(PERMISSAO_INFO) as Permissao[];

  return (
    <div className="flex flex-col gap-5">
      <PageHead title="Perfis de Acesso">
        O que cada perfil pode fazer no portal. As mesmas regras valem no servidor e no banco de dados, então nada aqui
        pode ser contornado por fora do portal. Para mudar o perfil de alguém, use a tela Usuários.
      </PageHead>

      <Panel title="Os três perfis">
        <ul className="flex flex-col gap-2 text-[13px]">
          {NIVEIS.map((n) => (
            <li key={n} className="flex flex-wrap items-center gap-2">
              {DESCRICAO_NIVEL[n]}
              {n === nivel && <Selo tom="info">seu perfil</Selo>}
            </li>
          ))}
        </ul>
      </Panel>

      {GRUPOS_PERMISSAO.map((grupo) => (
        <Panel key={grupo} title={grupo}>
          <div className="overflow-auto rounded-[10px] border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Função</TableHead>
                  {NIVEIS.map((n) => {
                    const Icone = ICONE[n];
                    return (
                      <TableHead key={n} className="text-center">
                        <span className="inline-flex items-center gap-1">
                          <Icone className="h-[13px] w-[13px]" /> {NIVEL_LABEL[n]}
                        </span>
                      </TableHead>
                    );
                  })}
                </TableRow>
              </TableHeader>
              <TableBody>
                {permissoes
                  .filter((p) => PERMISSAO_INFO[p].grupo === grupo)
                  .map((p) => (
                    <TableRow key={p}>
                      <TableCell className="text-[12.5px]">{PERMISSAO_INFO[p].rotulo}</TableCell>
                      {NIVEIS.map((n) => (
                        <TableCell key={n} className="text-center">
                          {nivelPode(n, p) ? (
                            <Check className="mx-auto h-4 w-4 text-success" aria-label="sim" />
                          ) : (
                            <Minus className="mx-auto h-4 w-4 text-dimmer" aria-label="não" />
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        </Panel>
      ))}

      <p className="text-xs leading-relaxed text-muted-foreground">
        Esta lista é fixa: os perfis e o que cada um pode fazer são definidos no código do portal e nas regras do
        servidor. Para incluir ou mudar uma permissão, fale com a TI.
      </p>
    </div>
  );
}
