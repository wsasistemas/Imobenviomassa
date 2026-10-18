# Plano — design system novo, menus, perfis e permissões, integrações

Mockup aprovado em 17/10/2026: [`docs/mockups/design-system-imobdocerias.html`](mockups/design-system-imobdocerias.html).

**Origens**
- **Cores:** `:root` do imobdocerias (tema claro). Tokens de estado recriados na mesma paleta.
- **Fonte:** Portal_Atendimento, Inter 400–800 + IBM Plex Mono, base 16px. Vem do `@fontsource`, porque a CSP (`font-src 'self'`) bloqueia o Google Fonts.
- **Logo:** WSA Sistemas IA.
- **Ícones:** coloridos do Portal_Atendimento (fluent-color + flat-color-icons), embutidos com `addIcon`, sem chamada à API do Iconify.
- **Menus, Perfis e permissões, Permissões por aplicativo e Integrações:** processo do Portal_Atendimento.

**Regras**
- Migration só aditiva.
- Checklist binário: feito ou não feito, nada de "parcialmente".

## Mapa de ids (permissões)

| Grupo | id | Tela | Regra |
|---|---|---|---|
| Menu principal | `home` | /home | sempre visível |
| | `disparos` | grupo "Disparo em Massa" | pai |
| | `docusign` | submenu "DocuSign" | pai (filho de `disparos`) |
| | `ver_dashboard` | /dashboard | filho de `docusign` |
| | `criar_disparo` | /disparo/novo | filho de `docusign` |
| | `ver_historico` | /campanhas | filho de `docusign` |
| | `ver_relatorios` | /relatorios | filho de `docusign` |
| | `regua_cobranca` | /regua-cobranca (vazia) | filho de `disparos` |
| | `treinamento` | /treinamento | sempre visível |
| Configurações | `manage_users` | /administracao/usuarios | |
| | `manage_permissions` | /administracao/perfis | |
| | `manage_app_access` | /administracao/permissoes-aplicativo | só o super admin da Central |
| | `configure_integrations` | /configuracoes/integracoes (abas) | só admin e super admin |
| | `gerenciar_credenciais` | ação dentro de Integrações | só super admin |
| | `view_audit_logs` | /administracao/logs | |
| | `manage_privacy` | /administracao/privacidade | |
| | `manage_sessions` | /administracao/sessoes | |
| Rodapé | `conta_seguranca` | /conta/seguranca | sempre visível |

Os 3 níveis atuais viram os 3 primeiros perfis, com as mesmas liberações de hoje:
- **Analista** (`operadora`): `disparos`, `docusign`, `ver_dashboard`, `criar_disparo`, `ver_historico`, `ver_relatorios`.
- **Admin**: tudo do Analista, mais `configure_integrations`, `view_audit_logs` e `manage_privacy`.
- **Super Admin**: tudo.

## Fase 1 — Fonte, cores, logo e ícones
- [x] `src/styles.css` com a paleta do imobdocerias (oklch), sidebar clara e sem `html { font-size: 15px }`.
- [x] Inter 800 adicionada (`@fontsource/inter/800.css`).
- [x] Logo WSA em `src/assets/wsa-logo.png` e favicon trocado.
- [x] `@iconify/react` + coleções (dev) instalados; `scripts/gerar-icones.mjs` gera `src/components/icones/icones.data.ts`.
- [x] `IconeDoMenu` e `IconeIlustrativo` em `src/components/icones/icone-colorido.tsx`.
- [x] `npm run build` passa.

## Fase 2 — Registro de menus e shell
- [x] `src/config/menu-registry.ts`: fonte única de menu, rotas, breadcrumb, cards e matriz (ids da tabela acima, `parent`, `alwaysVisible`, `adminOnly`, `superAdminOnly`, `centralOnly`).
- [x] `src/lib/acesso/policy.ts`: `isAllowed` / `isEffectivelyAllowed` (regra do Portal). Até a Fase 3, as regras vêm dos 3 níveis fixos (`REGRAS_DO_NIVEL` em `src/lib/permissoes.ts`).
- [x] Sidebar com 3 níveis (Disparo em Massa › DocuSign › itens), recolher, menu no celular e ícones coloridos.
- [x] Cabeçalho com breadcrumb, título e chip do usuário.
- [x] Página Inicial no layout do mockup (faixa de destaque, KPIs e cards).
- [x] Rota `/regua-cobranca` com o aviso "Em construção".
- [x] Guarda de rota por permissão (`resolvePermissionForPath`): sem acesso, volta para /home com aviso.
- [x] `npm run build` passa.

## Banco novo — schema `imobenviomassa` no Supabase ImobSystem (ikvjaowvpvxojvcfwnct)
Pedido de 17/10/2026: por enquanto o schema fica **vazio**. O app continua no Supabase da Calper até a decisão de migrar.
- [x] Migration `supabase/imobsystem/migrations/20261017233000_imobenviomassa_schema.sql`: schema, anon fechado, privilégios padrão e exposição na API, acrescentando sem regravar a lista.
- [x] Scripts para o SQL Editor: `supabase/imobsystem/sql-editor/1_criar_schema.sql` e `2_testar_schema.sql`.
- [x] Ensaio local (PGlite com os papéis do Supabase): 5 de 5 testes ok, idempotente, schemas dos outros sistemas preservados.
- [ ] Aplicado no projeto ikvj (pelo Wagner, no SQL Editor).

## Fase 3 — Banco: perfis e matriz de permissões (schema a definir: `disparo_massa` no Supabase da Calper ou `imobenviomassa` no ikvj)
- [ ] Tabelas `disparo_massa.perfis_acesso` (key, label, descricao, ordem, is_system) e `disparo_massa.perfil_permissoes` (perfil, permission_id, enabled).
- [ ] Coluna `perfil_key` em `public.wa_project_users`, preenchida a partir de `user_roles`.
- [ ] Seed dos 3 perfis com as liberações de hoje.
- [ ] Funções `tem_permissao(text)`, `perfil_usuario_atual()`, `pode_atribuir`, `eh_gestor_perfis`.
- [ ] RPCs `listar_perfis`, `criar_perfil`, `editar_perfil`, `excluir_perfil` e `salvar_permissoes_perfil`, com auditoria.
- [ ] Views do contrato da Central (`disparo_massa.perfis` e `usuarios`) apontando para as tabelas novas (CREATE OR REPLACE).
- [ ] `user_roles` continua sincronizado, para não quebrar as RLS e as edge functions atuais.
- [ ] Teste a seco numa transação desfeita, simulando cada perfil.

## Fase 4 — Telas de acesso e servidor por permissão
- [ ] Perfis e permissões: lista de perfis, matriz em árvore, "Liberar todos", selos, barra de salvar/descartar, criar/editar/excluir perfil.
- [ ] Usuários: combo de perfil com os perfis atribuíveis (do seu nível para baixo).
- [ ] Permissões por aplicativo no layout do Portal (as RPCs `pa_*` já existem).
- [ ] Permissões efetivas lidas do banco (`useCurrentUser` / provider).
- [ ] Server functions checam `tem_permissao` no lugar do papel fixo.
- [ ] `npm run build` passa.

## Fase 5 — Integrações no padrão do Portal
- [x] Abas TOTVS RM | DocuSign | Gateway de APIs no topo das três telas (`src/components/integracoes/abas-integracoes.tsx`). As rotas `/configuracoes/docusign` e `/configuracoes/gateway` continuam (retorno do preview DocuSign e atalhos `/admin/*`); as abas navegam entre elas.
- [ ] Card padrão em cada aba: cabeçalho com status, formulário, senha em branco mantém a atual, "Salva em … por …", "Integração ativa", rodapé Descartar/Salvar.
- [ ] Card separado "Teste de conexão".
- [ ] `npm run build` passa.

## Fase 6 — Sessões ativas
- [ ] RPCs `listar_sessoes` e `encerrar_sessao`.
- [ ] Tela Sessões ativas.
- [ ] `npm run build` passa.
