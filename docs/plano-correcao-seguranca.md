# Auditoria de Segurança pré-deploy — Portal Docusign (disparo em massa)

Data: 2026-10-01 · Escopo: frontend, server functions, Edge Functions, migrações Supabase, deploy Vercel, histórico git.
Método: 6 auditorias paralelas (segredos/deploy, banco/RLS, autorização/IDOR, logs/LGPD, login/sessão, integrações/proxies), com evidências conferidas no código atual (branch `main`).

## 0. Status da execução e re-auditoria (atualizado em 2026-10-01, tarde)

**Fases 0 e 1 estão commitadas** (`c970411`, `f46f66d`, `3035058`). Esta re-auditoria rodou 5 frentes paralelas sobre o código atual da `main` (segredos/deploy/dependências, banco/RLS, autorização/IDOR/validação, login/sessão, logs/LGPD) para confirmar o que foi feito, o que continua aberto e o que a primeira rodada não viu.

### 0.0b Fase 4 (LGPD) implementada no código (2026-10-01, noite) — aguardando commit e aplicação no Supabase

Verificação: `tsc` limpo (só o erro pré-existente em `__root.tsx`), `vite build` OK, `npm audit` = 0 vulnerabilidades, bundle do cliente só com JWT `anon`, nenhuma leitura de CPF/telefone/e-mail pelo navegador. **Migrações e Vault não foram testados em Postgres real** (não há banco local): aplicar primeiro em um projeto de teste ou revisar o resultado dos NOTICE.

| Item | O que foi feito |
|---|---|
| N8 opt-out | Tabela `wa_opt_outs` (CPF, e-mail ou telefone normalizados, só service_role). `criarCampanha` marca quem casar como `opt_out` e não o coloca na fila; `enviarDestinatarioCampanha` rechecka na hora do envio; cônjuge que assina ou recebe cópia também bloqueia. Falha na consulta ⇒ nada é enviado. Toast na revisão com os nomes ignorados. |
| Direitos do titular | Tela **Administração › Privacidade** (Admin e Super Admin): consultar onde a pessoa aparece (sem dados pessoais), lista de descadastro (valores mascarados), anonimizar titular (Super Admin + MFA, inclusive como cônjuge), anonimizar campanha (Super Admin + MFA), retenção configurável. Tudo auditado sem gravar o identificador. "Registrar em descadastro" vem marcado: serve de lista de supressão depois de restaurar backup. |
| A6 / retenção | `wa_retencao_executar()` agora anonimiza destinatários de campanhas encerradas há mais de 12 meses (nunca encerradas: 18 meses) e apaga `docusign_envelopes.raw` após 12 meses. Prazos em `wa_retencao_config`. FKs de `docusign_envelopes` já tratadas na Fase 2. |
| N9 | `mapContratos` devolve ao navegador só uma allowlist de colunas do RM (`EXTRAS_RM_PERMITIDOS`), em vez de todas. |
| L1 / L11 | CSV gerado **no servidor** e auditado (`relatorio_exportado`): mascarado para todos; "CSV completo" só Admin, com confirmação. Relatório com telefone e e-mail mascarados; "Mostrar contatos" busca no servidor e audita (`contatos_revelados`). **Permissão por coluna** (migração `20261001190000`): o navegador não lê mais `cpf`, `telefone`, `email` nem `dados_extras` de `wa_campanha_destinatarios`. A busca por CPF no relatório foi removida de propósito (use a tela Privacidade). |
| N16 | Logs: `wa_auditoria` só por server function (select do navegador revogado, migração `20261001180000`); Admin vê IP e e-mail mascarados, Super Admin vê tudo. |
| M3 | Segredos no **Supabase Vault** (migração `20261001170000`, aditiva e com fallback para texto claro). Os segredos atuais só são movidos pelo script `supabase/pos-migracao/20261001_mover_segredos_para_vault.sql`, que você roda à mão depois de publicar e testar. Backups antigos continuam com o texto claro: rotacionar a chave RSA do DocuSign e a senha do RM depois. |
| N14 / N21 | `trocarMinhaSenha` exige conta ativa e descarta a sessão de verificação. |
| B8 | Catálogo estático de APIs removido (aba, componente e `gw()`). |
| B7 | `auth.tsx` não tinha resíduo de signup. |
| Docs | [docs/lgpd-privacidade.md](lgpd-privacidade.md): base legal, inventário, compartilhamento, direitos do titular, retenção, backup/restauração, incidentes (ANPD: 3 dias úteis, a confirmar com o jurídico), minuta de texto de privacidade, registro de operações e pendências para jurídico e DPO. |

**Ordem de aplicação no Supabase** (todas idempotentes): `20261001140000`, `…150000`, `…160000`, `…170000`, `…180000`, `…190000`. Publicar o app logo depois. A `20261001190000` precisa entrar junto com este código: sem ela o navegador ainda lê todas as colunas; com ela, qualquer `select("*")` novo em `wa_campanha_destinatarios` falha.

**Pendências operacionais da Fase 4:**
1. Aplicar as migrações acima e conferir o NOTICE do Vault ("Vault ativo" ou "INATIVO").
2. Testar "Testar conexão" do DocuSign e do RM **antes** de rodar o script do Vault; publicar o app; rodar o script; testar de novo e fazer um envio de teste.
3. Rotacionar a chave RSA do DocuSign e a senha do RM depois de mover para o Vault (backups antigos têm o texto claro).
4. Conferir o agendamento: `select jobname, schedule, active from cron.job where jobname = 'wa_retencao_diaria';` (habilitar `pg_cron` se não existir).
5. Rodar `supabase/pos-migracao/20261001_remover_tae.sql` depois de confirmar que nenhum outro sistema usa as tabelas do TAE.
6. Jurídico e DPO: itens da seção 11 de `docs/lgpd-privacidade.md` (Encarregado, base legal, prazos, DPA com DocuSign/Vercel/Supabase, retenção dentro do DocuSign, texto de privacidade).
7. Testar: criar campanha com um comprador descadastrado (deve aparecer como opt-out e não receber), anonimizar um titular de teste, abrir um relatório (contatos mascarados) e exportar CSV mascarado e completo, Logs como Admin (IP mascarado).
8. Commitar (sugestão: "segurança: fase 4 da auditoria (LGPD)").

**Limites conhecidos:** a anonimização no portal não apaga o envelope já assinado no DocuSign; `relatorios.index.tsx` e o dashboard ainda não somam `opt_out` nos totais; o ExecutarApiPanel do Gateway (só Admin) ainda exporta a resposta crua do RM.

**Próximo:** Fase 5 (sessão em cookie HttpOnly com `@supabase/ssr`).

### 0.0a Fase 3 implementada no código (2026-10-01, noite) — commitada em `d103ad9`

Verificação: `tsc` limpo (só o erro pré-existente em `__root.tsx`), `vite build` OK, **`npm audit` = 0 vulnerabilidades**, bundle do cliente só com JWT `anon`.

| Item | O que foi feito |
|---|---|
| M6 xlsx | `xlsx` 0.18.5 → **0.20.3** (tarball oficial do SheetJS, `package.json`). Upload: só .xlsx/.xls/.csv, ≤ 5 MB, ≤ 5.000 linhas, leitura com `sheetRows`, sem fórmulas/HTML (`disparo.novo.origem.tsx`). |
| M7 MFA | TOTP nativo do Supabase. Tela **Minha conta → Segurança** (`/conta/seguranca`): ativar (QR + chave manual + código), desativar (exige código). Desafio no login (`src/components/mfa-challenge.tsx`, 5 erros → sai). Guard de rotas derruba sessão parcial (aal1 com fator cadastrado). Servidor: `exigirAal2()` em `authz.ts`; **obrigatório** em todas as funções de gestão de usuários, config DocuSign, credenciais do RM e cadastro de APIs do Gateway. Super Admin sem fator recebe mensagem apontando para a tela. **Habilitar TOTP no dashboard.** |
| M8 senha | Política única em `src/lib/senha.ts` (mín. 12, 3 de 4 classes, sem sequências óbvias) usada no servidor e nas telas. **Senha inicial gerada pelo servidor** (16 caracteres, aleatória), mostrada uma única vez com botão copiar; o Super Admin não digita mais senha de ninguém. "Gerar nova senha" derruba todas as sessões da pessoa. Troca da própria senha revoga as outras sessões (`auth_revogar_sessoes`, migração `20261001150000`). Cadastro só para e-mails em `EMAIL_DOMINIOS_PERMITIDOS` (padrão `calper.com.br`). HIBP: ligar *Leaked password protection* no dashboard. |
| N10 erros | `src/lib/erros.server.ts`: mensagens genéricas ao navegador, detalhe só no log do servidor (truncado, e-mail/CPF/telefone mascarados). DocuSign devolve só `errorCode` traduzido; `erro_msg` dos destinatários nunca carrega JSON/XML. `totvs-soap-proxy` sem `raw`/`parsed` (só `debug` para Super Admin), códigos HTTP reais; `api-proxy` sem `url`/`details` em erro. |
| N11 Edge | `@supabase/supabase-js@2` e `fast-xml-parser@5` via `npm:`; CORS por `ALLOWED_ORIGINS` (secret; sem ela cai em `*` com aviso); credenciais TOTVS locais à requisição; `apiName`/`apiId` validados; destino só `https://` (http apenas IP privado/`.local`), bloqueio de localhost/metadata/`*.supabase.co`, `redirect: manual`; secrets de API só com prefixo `GW_`; `extraHeaders` por allowlist; timeout 30 s e corpo ≤ 5 MB; XML sem entidades. |
| B2 CSV | `src/lib/csv.ts`: células que começam com `= + - @ TAB CR` recebem `'`; `;` + BOM; **CPF mascarado** (`***.***.123-45`) nos CSVs de relatório e de erros (CSV completo fica para a Fase 4, no servidor). |
| B6 | Timeouts: DocuSign 30 s (PDF 60 s), RM 25 s com `AbortSignal`. |
| N14 | Filtro da auditoria amplia chaves (`cpf|cnpj|documento|telefone|celular|whatsapp|phone`) e desce em objetos aninhados (4 níveis). |
| N15 | `src/lib/sessao.ts` → `sairDoPortal()`: limpa wizard, cache de empreendimentos, chaves `wa:` e faz `signOut({ scope: "local" })` (não derruba os outros portais Calper). Usado no shell, troca de senha e guard. |
| N18 / N19 | Erros de configuração sem nome de variável; `supabase/config.toml` com `[auth]` (signup off, anônimo off, JWT 900 s, TOTP on, rate limits) para `supabase config push`. |

**Pendências operacionais da Fase 3:**
1. Aplicar `20261001150000_fase3_sessoes.sql`.
2. Dashboard: **Authentication → Multi-Factor → TOTP** habilitado; *Leaked password protection* ligada; JWT 900 s.
3. Secrets das Edge Functions: `ALLOWED_ORIGINS=https://<domínio do portal>`; renomear secrets de API para o prefixo `GW_` e ajustar `auth_secret_ref` no `api_registry`. Redeploy das duas functions.
4. Vercel: `EMAIL_DOMINIOS_PERMITIDOS` (se diferente de `calper.com.br`).
5. Cada Super Admin ativa o TOTP em Minha conta → Segurança **antes** de precisar mexer em usuários/credenciais (sem isso essas telas devolvem a mensagem de "exige verificação em duas etapas").
6. Testar: login com TOTP, criar usuário (senha gerada), trocar senha (outras sessões caem), importar planilha > 5 MB (recusa), exportar CSV (CPF mascarado), Executar API no Gateway.
7. Commitar (sugestão: "segurança: fase 3 da auditoria").

**Próximo:** Fase 4 (LGPD): allowlist do RM na resposta (N9), opt-out (N8), anonimização e retenção de destinatários, CSV completo no servidor com auditoria (L1), mascaramento nas telas (L11), Vault, documentação de privacidade/backup/incidente. Depois Fase 5 (cookies HttpOnly).

### 0.0 Fase 2 implementada no código (2026-10-01, tarde) — commitada em `6f735ce`

Plano v2 aprovado com os padrões do §7. Decisão adicional: **a integração TAE (TOTVS Assinatura Eletrônica) saiu do projeto** (código, telas, server functions e permissões); as tabelas são apagadas pelo script `supabase/pos-migracao/20261001_remover_tae.sql` depois de confirmar que nenhum outro sistema as usa. Verificação: `tsc` limpo (só o erro pré-existente em `__root.tsx`), `vite build` OK, nenhuma escrita direta do navegador nas tabelas do portal.

| Item | O que foi feito |
|---|---|
| N1 / N1b | Migração `20261001140000`: `revoke insert, update, delete` de `authenticated` em `wa_campanhas`, `wa_campanha_destinatarios`, `docusign_envelopes`, `api_registry`; policies de escrita dropadas. Índice em `wa_campanha_destinatarios(envelope_docusign_id)`. |
| A1 / A3 | `wa_conta_liberada()` e `wa_eh_admin()` (SECURITY DEFINER) em todas as policies de SELECT de `wa_*`, `docusign_envelopes`, `api_registry`. Sessões **não** são revogadas (decisão 1): o acesso cai no próximo JWT (configurar 15 min no dashboard). |
| N7 | Fail-closed em `authz.ts`, `use-current-user.ts`, `route.tsx`, `api-proxy`, `totvs-soap-proxy`: erro ao ler `wa_project_users` ⇒ sem acesso. |
| N4 | zod em `salvarConfigDocusign` (ambiente enum, `base_url`/`auth_url` só https em `*.docusign.net` / `account(-d).docusign.com`, `id` ignorado), `obterTemplate*`, `obterModeloDocusign`, `refreshEnvelopesCampanha`, `reenviarEnvelopeDocusign`, `listarEmpreendimentosTotvs`, `buscarCompradoresPorEmpreendimento`, `testarConexaoRm`. |
| A8 | `salvarCredenciaisRm`: só `https://`; host deve estar em `RM_HOSTS_PERMITIDOS` (env) ou ser o mesmo já cadastrado no outro recurso (primeiro cadastro aceito e auditado). |
| N2 | Preview DocuSign: input só `templateId`/`recipientId`; `returnUrl`, `frameAncestors` e `messageOrigins` fixados em `APP_URL` (+ `apps(-d).docusign.com`); envelope `created` + `views/recipient_preview` (fallback `sent` + void); descarte para a lixeira após 10 min + varredura de órfãos por custom field; 20 previews/hora por usuário. **Requer `APP_URL` na Vercel.** Não testado contra a API real: testar em demo. |
| A9 | `vercel.json` com HSTS (preload), nosniff, `X-Frame-Options: DENY`, Referrer-Policy, Permissions-Policy e CSP (`frame-ancestors 'none'`, DocuSign e Supabase na allowlist). Validar com `curl -I` após o deploy. |
| N3 | `bun.lock` removido; `installCommand: npm ci`, `buildCommand: npm run build`; `package-lock.json` 100% em `registry.npmjs.org`. README atualizado. |
| N6 | `auth_pre_login` passa a **contar** a tentativa (atômico, lock de linha); IP `desconhecido` não conta; limite por IP separado (20 / 15 min, bloqueio fixo) do limite por conta (5 / 15 min, backoff 15 min × 2ⁿ ≤ 24 h); hook `hook_verificacao_senha` com a mesma janela e backoff; `auth_bloqueio_parametros()` com defaults (sem linha de config ainda bloqueia). |
| N5 | `criarUsuario` não redefine senha nem nome de conta já existente em outro portal Calper (só vincula + exige troca; aviso na tela; auditoria `usuario_vinculado`). `atualizarUsuario`/`desbloquearUsuario` validam uuid e exigem membro do portal. |
| A4 / A11 | Trigger `user_roles_sem_autopromocao` (JWT de usuário não concede a si mesmo papel ≠ `cliente`; vale para todos os portais, sem quebrar signup). `api_registry`: SELECT só admin com conta liberada; cadastro/remoção via `src/lib/gateway.functions.ts` (Super Admin, zod, auditado). |
| N13 / N20 | FKs `on delete set null` em `wa_auditoria.usuario_id` e `wa_project_users.adicionado_por`; FK `docusign_envelopes.campanha_id` (cascade) e `destinatario_id` (set null) após limpar órfãos; índice `wa_campanhas(criado_por)`; guard de `wa_project_users` virou allowlist. |
| TAE | Removidos `tae-*.ts`, `TAEConfigSection.tsx`, `TAEWebhookSubscriptions.tsx`, aba na tela Gateway, textos em `navigation.ts`/`permissoes.ts`. Migração `20261001110000` fica (condicional, inofensiva). |

**Não feito nesta fase (fica para a Fase 3/4):** N12 (`has_role` executável por `authenticated` — revogar quebraria policies de outros portais do projeto compartilhado; mitigado pelo trigger de autopromoção), N10, N11, N8, N9, N14–N19, N21.

**Pendências operacionais da Fase 2 (além das do §0.4):**
1. Aplicar `20261001140000_fase2_rls_conta_liberada.sql` (depois das `20261001*` anteriores).
2. Vercel: variável `APP_URL=https://<domínio do portal>` (Production e Preview); opcional `RM_HOSTS_PERMITIDOS`.
3. Depois de publicar: `curl -I https://<domínio>` e conferir HSTS/CSP; abrir o portal e testar login, disparo com 2 destinatários, preview de template, cadastro de API no Gateway.
4. Rodar `supabase/pos-migracao/20261001_remover_tae.sql` após a checagem descrita no próprio arquivo.
5. Commitar (sugestão: "segurança: fase 2 da auditoria + remoção do TAE").

### 0.1 Confirmado como feito (com evidência no código atual)

| Item | Evidência |
|---|---|
| C1 TAE privado | `20261001110000`: policies dropadas, revoke de `anon/authenticated`, RLS. `getTaeSettings` devolve só flags; escrita só Super Admin; allowlist https + `.totvs.*` (`tae-config.functions.ts:33`). |
| C2 Disparo server-side | Wizard só chama `criarCampanha` / `enviarDestinatarioCampanha` / `concluirCampanha` (`disparo.novo.revisao.tsx:64-66`). zod completo, 2.000/campanha, 5.000/dia, template conferido, `dados_extras` com allowlist de 4 chaves. IDOR de status/destinatários/reenvio resolvido via `assertEnvelopeDoUsuario`. |
| C3 Logs sem PII | `api-proxy` loga método, caminho sem query, status, duração, bytes. `gateway_call_log` só metadados, só `service_role`, retenção 30 d. Nenhum `console.*` com payload, token ou senha em `src/` ou `supabase/functions/`. |
| C4 Login | Único `signInWithPassword` do navegador removido. Server function `login`: 5 por IP e 5 por conta, janela 15 min, backoff 15 min × 2ⁿ até 24 h, mensagens genéricas, jitter, e-mail inexistente conta, conta inativa não recebe sessão. Hook `hook_verificacao_senha` com grant só a `supabase_auth_admin`. Troca de senha passa pela mesma contagem. |
| A2 `.env` | Não rastreado; histórico só tinha chave anon (nada a rotacionar). Bundle gerado não contém service role. |
| A7 Auditoria | Só servidor (`auditoria.server.ts`), com IP e UA; INSERT revogado de `authenticated`. |
| M9, M10, B4 | Rascunho do wizard limpo no logout; tabelas legadas dropadas; `definirNivel` só mexe nos papéis deste portal. |

### 0.2 Status dos 7 pontos do pedido (hoje)

| # | Requisito | Status | O que falta |
|---|---|---|---|
| 1 | Segredos: nenhuma chave no frontend | **OK** | Só o lockfile apontando para registry da Lovable (N3) e cabeçalhos HTTP (A9). |
| 2 | RLS: toda tabela com política por usuário | **Parcial** | Policies não exigem conta ativa (A1/A3); navegador ainda tem GRANT de escrita em campanhas (N1); `api_registry` legível por todos (M5); `user_roles`/`profiles` fora do repo (A4). |
| 3 | IDOR: toda rota com id confere o dono | **Parcial** | Server functions conferem dono. Mas N1 permite plantar `envelope_docusign_id` alheio e contornar a checagem (N1b). Preview aceita `returnUrl`/`frameAncestors` do cliente (N2). |
| 4 | Validação no servidor | **Parcial** | Disparo validado. 11 funções ainda com validador identidade, incluindo `salvarConfigDocusign` e `salvarCredenciaisRm` sem allowlist de host (N4). N1 contorna tudo via PostgREST. |
| 5 | Dados em log: nunca senha/cartão/PII | **OK** | Resíduos: mensagens cruas de DocuSign/RM gravadas em `erro_msg` e devolvidas ao navegador (N10). |
| 6 | LGPD: exclusão, privacidade, backup | **Ausente** | Fase 4 inteira (A6, N8, N9, L1, L11). |
| 7 | Login: 5 por IP e conta, contagem, bloqueio | **OK no código** | Depende de ativar o hook e aplicar as migrações. Ajustes de robustez em N6. |

### 0.3 Novos achados da re-auditoria (não estavam no plano original)

**ALTOS — entram na Fase 2 (bloqueiam o deploy)**

- **N1 — Navegador ainda escreve direto em `wa_campanhas` e `wa_campanha_destinatarios`.** `20260701175149…:30,82` concede `INSERT, UPDATE, DELETE` a `authenticated` e as policies `:43-54, 97-131` aceitam qualquer linha com `criado_por = auth.uid()`. Nenhuma migração posterior revoga. Com o JWT de uma operadora, via PostgREST, dá para: inserir destinatários sem zod, sem cota e sem a allowlist de `dados_extras`; alterar `status`/totais/`assinado_em`; apagar campanhas para zerar a cota diária (`campanhas.functions.ts:125-136`); e **N1b** plantar o `envelope_docusign_id` de outra campanha num destinatário próprio e então ler status/CPF/telefone e reenviar envelopes alheios, pois `assertEnvelopeDoUsuario` resolve por esse campo (`docusign.functions.ts:87-99`). O wizard já não escreve direto (só SELECT), então a correção não quebra a UI. **Correção:** migração `revoke insert, update, delete on wa_campanhas, wa_campanha_destinatarios from authenticated, anon` + drop das policies de escrita (mesmo padrão de `wa_auditoria`). Manter SELECT. Cota diária passa a contar em `docusign_envelopes` (admin-only).
- **N2 — Preview de template DocuSign manipulável (era M2, sobe para alto).** `docusign.functions.ts:666-707, 747-795`: `returnUrl`, `allowFromUrl` e `frameAncestors` vêm do cliente sem allowlist (aceitam `http:`), permitindo embutir a view do DocuSign em origem alheia e redirecionar (phishing/clickjacking). Cada clique cria envelope real `status: "sent"` sem limite. **Correção:** zod; `returnUrl` fixo na origem do portal (`APP_URL`); `frameAncestors` fixo (portal + `apps.docusign.com`); `status: "created"` e void após o preview; limite por usuário.
- **N3 — Cadeia de suprimentos do deploy (era M11, sobe para alto).** `bun.lock` resolve 19 pacotes, incluindo `@supabase/*` e `xlsx`, em `europe-west4-npm.pkg.dev/lovable-core-prod`; `vercel.json:4` usa `bun install`, logo a Vercel instala a partir desse registry. `package-lock.json` está 100% em `registry.npmjs.org`. **Correção:** apagar `bun.lock`, trocar `installCommand` para `npm ci` e `buildCommand` para `npm run build` (ou regenerar `bun.lock` no registry oficial). Um único lockfile.

**MÉDIOS**

- **N4 — 11 server functions com validador identidade.** `salvarConfigDocusign` (`docusign.functions.ts:477`): `base_url`/`auth_url` sem allowlist de host (um Super Admin, ou token roubado dele, aponta `auth_url` para fora e vaza o JWT assinado com a chave RSA), `ambiente` fora do enum, `rsa_private_key` sem limite. `salvarCredenciaisRm` (`totvs.functions.ts:223`) aceita `http://` e qualquer host (senha do RM sai por Basic Auth para onde apontarem). `buscarCompradoresPorEmpreendimento`, `refreshEnvelopesCampanha`, `reenviarEnvelopeDocusign`, `obterTemplate*`, `obterModeloDocusign`, `testarConexaoRm`, `listarEmpreendimentosTotvs`, `obterTemplatePdfDocusign`. **Correção:** zod em todas; allowlist `*.docusign.net` / `account(-d).docusign.com`; RM só `https://` com host igual ao configurado.
- **N5 — Gestão de usuários no projeto compartilhado.** `criarUsuario` (`users.functions.ts:176-187`) redefine a senha de conta já existente de outro portal Calper sem aviso (takeover). `atualizarUsuario` (`:220-241`) e `desbloquearUsuario` (`:281-290`) aceitam qualquer `userId` do Auth, sem exigir que seja membro do portal e sem validar uuid. **Correção:** conta existente → só vincular + exigir troca de senha, nunca redefinir; exigir membro como faz `definirSenhaUsuario`.
- **N6 — Robustez do limite de login.** (a) Sem header de IP a chave vira `ip:desconhecido`, compartilhada por todos; atrás de NAT corporativo, 5 erros de qualquer pessoa bloqueiam o escritório por 15 min a 24 h. (b) `auth_pre_login` e `auth_registrar_resultado` são chamadas separadas: uma rajada paralela passa no pré-check antes de qualquer contagem. (c) Hook e RPC têm regras diferentes (hook: janela deslizante e bloqueio fixo 15 min, sem backoff). (d) Se `auth_bloqueio_config` ficar sem linha, `max_falhas` é NULL e nunca bloqueia (fail-open) (`20261001120000…:134,171,237,263`). (e) IP confiável só atrás da Vercel. **Correção:** limite por IP maior que por conta (ex.: 20 em 15 min, sem backoff exponencial) e não contar `desconhecido`; pré-check e incremento na mesma função com `for update`; alinhar o hook; `coalesce(max_falhas, 5)`; documentar a dependência da Vercel.
- **N7 — Fallbacks fail-open "antes da migração" continuam.** `authz.ts:24-30`, `use-current-user.ts:53`, `route.tsx:19-20`, `api-proxy:69-72`, `totvs-soap-proxy:25-34`. Um erro de banco cujo texto contenha `trocar_senha` libera acesso. **Correção:** erro → negar.
- **N8 — Opt-out não é honrado.** Enum tem `opt_out` e existe `bulk_opt_outs` nos types, mas `criarCampanha`/`enviarDestinatarioCampanha` não consultam nada. **Correção (Fase 4):** consultar lista por CPF/e-mail/telefone normalizados e marcar `opt_out` em vez de enviar; endpoint para registrar descadastro.
- **N9 — Servidor devolve todas as colunas do RM ao navegador.** `totvs.functions.ts:138-141,152`: a allowlist de 4 chaves só é aplicada ao gravar; o rascunho em `sessionStorage` carrega tudo. **Correção (Fase 4):** aplicar a allowlist em `mapContratos`.
- **N10 — Erros crus de terceiros chegam ao navegador e ao banco (era B1, sobe para médio).** Mensagens do PostgREST interpoladas em ~25 pontos (`users.functions.ts`, `authz.ts`, `rm.server.ts`, `gateway.ts`); corpo de resposta do DocuSign (até 300 chars) vai para `erro_msg` dos destinatários e para o CSV (`docusign.functions.ts:1033` → `campanhas.functions.ts:261,351`); `totvs-soap-proxy:324-333` devolve `raw` XML completo com HTTP 200; `api-proxy:283-284,376-384` devolve `url` e `details`. **Correção (Fase 3):** mensagem genérica + código; detalhe só no log do servidor, truncado.
- **N11 — Edge Functions.** `@supabase/supabase-js@2.45.0` e `fast-xml-parser@4.5.0` fixados via esm.sh (app usa 2.110); CORS `*`; credenciais TOTVS em variáveis de módulo (`totvs-soap-proxy:20-21,153-154`), vazamento possível entre requisições concorrentes no mesmo isolate. **Correção (Fase 3):** atualizar, CORS na origem do portal, variáveis locais.

**BAIXOS (Fase 3/4)**

- N12 `has_role` executável por `authenticated` com `user_id` arbitrário (enumeração de papéis): wrapper `has_role_me()` e revogar. N13 FKs sem `on delete` (`wa_auditoria.usuario_id`, `adicionado_por`) e `docusign_envelopes` sem FK; falta índice em `wa_campanhas(criado_por)`. N14 Regex de chaves sensíveis da auditoria não cobre `telefone|email|nome|documento` nem objetos aninhados (`auditoria.server.ts:43-50`). N15 Cache de empreendimentos em `localStorage` não é limpo no logout; `trocar-senha.tsx` e `route.tsx` fazem só `signOut()` sem limpar o resto. N16 Tela de Logs expõe e-mail e IP de todas as tentativas a Admin comum (`auth.functions.ts:143`). N17 `saveTaeSettings` usa `data.id` do cliente como alvo do update. N18 Mensagens de erro de configuração citam nomes de variáveis de ambiente (`client.server.ts:47-49`). N19 `supabase/config.toml` não versiona `[auth]` (signup, OTP, site_url). N20 Trigger `wa_project_users_guard` só bloqueia `auth.role() = 'authenticated'` (inverter para allowlist de `service_role`). N21 `trocarMinhaSenha` não exige conta ativa; sessão descartada fica em `auth.sessions` até expirar.

### 0.4 Pendências operacionais (fora do repositório, antes do deploy)

1. Aplicar as migrações `20261001*` no Supabase (`supabase db push` ou SQL Editor, em ordem).
2. **Ativar o hook**: Authentication → Hooks → *Password Verification Attempt* → Postgres → `public.hook_verificacao_senha`.
3. Dashboard: desligar signup, Magic Link, OTP, Phone, Anonymous; senha mín. 12 + *Leaked password protection*; JWT expiry 15–30 min; refresh token rotation; **elevar o rate limit de `/token`** (todas as tentativas saem dos IPs da Vercel); habilitar `pg_cron`.
4. Rodar as consultas da seção 5 (`user_roles`, `profiles`, `has_role`, `handle_new_user`) e versionar o resultado.
5. Redeploy das Edge Functions: `supabase functions deploy api-proxy` e `totvs-soap-proxy`.
6. Vercel: `SUPABASE_SERVICE_ROLE_KEY` só em Production, sem `VITE_`; domínio com HTTPS e, após A9, `curl -I` para conferir HSTS/CSP.
7. Testar: 5 erros de login (bloqueio por conta), desbloqueio na tela Usuários, disparo de teste com 2 destinatários, salvar TAE sem reenviar senha.

## 1. Veredito

**Não fazer o deploy em produção ainda.** O projeto tem uma base boa (ver §7), mas há 4 bloqueantes e um conjunto de itens de alto risco que, com dados de compradores (CPF, telefone, e-mail) e credenciais de integração em jogo, precisam ser resolvidos antes.

Status dos 7 pontos que você levantou:

| # | Requisito | Status | Referência |
|---|---|---|---|
| 1 | Segredos: nenhuma chave secreta no frontend | **Parcial** | Service role, RM e DocuSign OK. Senhas do TAE voltam ao navegador (C1). `.env` versionado (A2). |
| 2 | RLS: toda tabela com política por usuário | **Parcial** | Tabelas `wa_*` OK por criador/admin, mas não exigem conta ativa (A3). `api_registry` aberta a qualquer autenticado (M5). `user_roles`/`profiles`/`tae_*` fora do repo (A4). |
| 3 | IDOR: toda rota com id confere o dono | **Parcial** | 2 funções de envelope sem checagem de dono (M1); `enviarEnvelopeDocusign` não confere campanha (C2). |
| 4 | Validação no servidor | **Falha** | 14 server functions com validador identidade; o disparo em massa confia no que o navegador envia (C2). |
| 5 | Dados em log: nunca senha/cartão/PII | **Falha** | Edge Function loga corpo com CPF/telefone (C3). Senhas nunca vão a log (OK). |
| 6 | LGPD: exclusão, privacidade, backup | **Ausente** | Sem exclusão/anonimização, sem retenção, sem auditoria de acesso, backup não documentado (A6). |
| 7 | Login: 5 por IP e conta, contagem, bloqueio | **Ausente** | Login direto do navegador ao Supabase; nenhum contador/bloqueio existe (C4). |

## 2. Achados — CRÍTICOS (bloqueiam o deploy)

### C1 — Senhas do TAE armazenadas em texto claro e devolvidas ao navegador
- `src/lib/tae-config.functions.ts:41-52`: `select("*")` em `tae_integration_settings` devolve `service_password`, `sender_password`, `webhook_secret` ao cliente. `TAEConfigSection.tsx:340,370,533` renderiza nos inputs.
- Leitura usa o JWT do usuário, logo a tabela é legível direto pela Data API (sem passar pelo servidor). Policy da tabela não está no repositório.
- Perfil `admin` (não só Super Admin) pode ler e trocar a `auth_url` para host arbitrário, exfiltrando a senha (`tae-config.functions.ts:10-12, 54-98`). Contradiz `permissoes.ts:19`.
- **Correção**: mesmo modelo do RM/DocuSign. Migração: `revoke all on tae_integration_settings, tae_webhook_subscriptions from anon, authenticated` (ou mover para `envio_privado`). Server functions passam a usar `supabaseAdmin`, devolver `service_password_configurada: boolean`, "senha em branco mantém a atual", escrita só `super_admin`, validar `auth_url`/`api_url` com allowlist de host. Remover o `?secret=` da URL exibida.

### C2 — Disparo em massa orquestrado no navegador; servidor aceita qualquer destinatário
- `disparo.novo.revisao.tsx:163-351` cria campanha/destinatários direto no banco e chama `enviarEnvelopeDocusign` por destinatário.
- `docusign.functions.ts:842-855`: validador identidade. `signers[]`, e-mails, telefones, `tabs`, assunto, `campanhaId`, `destinatarioId` não são validados nem limitados; `campanhaId` não é conferido contra o chamador.
- Insert em `docusign_envelopes` (`:975-983`) usa o cliente do usuário com erro engolido; para perfil Analista a policy é admin-only, então o registro **nunca é gravado** (perde rastreabilidade, RNF-09).
- Qualquer conta `operadora` (ou token roubado) envia qualquer template da conta DocuSign para qualquer e-mail/WhatsApp, sem limite.
- **Correção**: nova server function `dispararCampanha(campanhaId)` que lê os destinatários **do banco**, valida com zod (e-mail, telefone E.164/BR, CPF, tamanho do lote, assunto ≤ 100), confere `wa_campanhas.criado_por = userId`, envia, grava `docusign_envelopes` com `supabaseAdmin` e audita `campanha_disparada`. Limite diário de envelopes por usuário. O navegador só chama essa função.

### C3 — PII de compradores nos logs e na tabela de log do gateway
- `supabase/functions/api-proxy/index.ts:338` loga URL completa com query; `:380-386` loga até 800 caracteres do corpo da resposta do RM (CPF, telefone, e-mail) nos logs do Supabase.
- `totvs-soap-proxy/index.ts:296-314` persiste envelope SOAP + 4.000 chars da resposta em `gateway_call_log`, sem retenção e com RLS não verificável.
- **Correção**: logar só método, status, duração e `apiId`; URL sem query string; em `gateway_call_log` guardar só metadados (ou mascarar CPF/telefone/e-mail); RLS admin-only; retenção 30 dias via `pg_cron`.

### C4 — Login sem limite de tentativas, sem bloqueio, sem registro de IP
- `src/routes/auth.tsx:35`: `signInWithPassword` direto do navegador. Nenhuma tabela, RPC ou contador existe. Só vale o rate limit nativo do Supabase (por IP, não por conta).
- `conta.functions.ts:40-45`: troca de senha verifica a senha atual via `signInWithPassword` do servidor, sem contagem (oráculo de senha).
- **Correção (sem captcha), defesa em 3 camadas**:
  1. **Auth Hook "Password Verification Attempt"** no Supabase (função Postgres): bloqueio **por conta** que ninguém contorna chamando o GoTrue direto. Tabela `auth_falhas_por_usuario`; 5 falhas em 15 min → bloqueio 15 min; cobre também `trocarMinhaSenha`.
  2. **Server function `login`** na Vercel: lê IP de `x-real-ip`/`x-forwarded-for`, consulta RPC atômica `auth_pre_login` (chaves `ip:<ip>` e `conta:<email>`), chama `signInWithPassword` no servidor, registra em `auth_login_log` (e-mail, user_id, IP, user agent, resultado), backoff exponencial (15 min × 2^n, teto 24 h), mensagem genérica única, jitter de tempo de resposta. Conta também e-mails inexistentes (sem enumeração).
  3. Tela Usuários: selo "bloqueado até" + botão **Desbloquear** (super admin, auditado com IP). Tela Logs exibe `auth_login_log`.
  - Risco operacional a testar: com login no servidor, todas as tentativas saem dos IPs da Vercel e contam juntas no rate limit por IP do GoTrue. Elevar o limite de `/token` no dashboard.

## 3. Achados — ALTOS (corrigir antes do deploy)

| ID | Achado | Evidência | Correção |
|---|---|---|---|
| A1 | Desativar usuário ou exigir troca de senha não revoga sessão nem corta acesso à Data API | `users.functions.ts:234-235` mantém papel; nenhuma chamada a `admin.signOut`/ban; policies `wa_*` só olham `has_role`; guard é só client-side (`route.tsx:21-29`); fallbacks fail-open "antes da migração" em `authz.ts:27-30`, `use-current-user.ts:53` | Função `wa_conta_liberada()` (SECURITY DEFINER: ativo + sem troca + papel do portal) em **todas** as policies `wa_*`, `docusign_envelopes`, `api_registry`; ao desativar/definir senha: `delete from auth.sessions where user_id = …` via função service_role; remover fallbacks fail-open; JWT expiry 15–30 min |
| A2 | `.env` versionado no git apesar do `.gitignore`; `.env.example` e README mandam colocar a service role nele | `git ls-files .env` (commit `a810402`); histórico só tem chave anon (verificado, nenhum segredo vazou) | `git rm --cached .env`; corrigir texto do README; pre-commit com gitleaks |
| A3 | Policies de `wa_campanhas`/`wa_campanha_destinatarios`/`wa_auditoria` aceitam qualquer `authenticated` do projeto compartilhado (papel `cliente` de outros sistemas, conta desativada, signup aberto) | `20260701175149…:35-54, 87-132`; `20260701173324…:57-60` | Mesma `wa_conta_liberada()` de A1 em USING e WITH CHECK |
| A4 | Policies de `user_roles`, `profiles`, `tae_*`, `gateway_call_log`, função `has_role` e trigger `handle_new_user` **não estão no repositório** (projeto Supabase compartilhado). Se `user_roles` permitir INSERT/UPDATE ao próprio usuário, há auto-promoção a super_admin | ausência nas migrações; `types.ts` | Rodar no SQL Editor (§5) e versionar o resultado; garantir `revoke insert, update, delete on user_roles from authenticated`; `has_role` SECURITY DEFINER com `search_path` |
| A5 | Sessão em `localStorage`, sem cookie HttpOnly, sem expiração por inatividade (README promete 8 h) | `client.ts:49-53`; rotas `ssr:false` | Fase posterior: `@supabase/ssr` com cookies `HttpOnly; Secure; SameSite=Lax`; no dashboard: time-box 12 h, inatividade 8 h, refresh token rotation; enquanto isso, A1 + JWT curto |
| A6 | LGPD: sem exclusão/anonimização de comprador nem de usuário; sem retenção; FKs bloqueiam delete em `auth.users`; `docusign_envelopes` sem FK (órfãos com PII); `dados_extras` grava **todas** as colunas do RM; CSV exporta CPF completo; sem auditoria de visualização/exportação | `totvs.functions.ts:138-141`; `20260701175149…:17`; `20260701235454…:48-49`; `RelatorioDetalheView.tsx:307-324` | Ver Fase 4 |
| A7 | Trilha de auditoria forjável pelo navegador; `ip` nunca preenchido; disparo, login, exportação e alterações TAE/gateway não auditados | `audit.ts:16-23`; policy INSERT `auth.uid() = usuario_id`; `paineis.tsx:389` duplica | `revoke insert on wa_auditoria from authenticated`; uma função `auditar()` server-side com `supabaseAdmin`, IP e user agent; remover `src/lib/audit.ts`; retenção 2 anos |
| A8 | Endpoint do RM aceita `http://`; Basic Auth + PII podem cruzar a internet em claro | `totvs.functions.ts:234-235`; exemplos da UI com `http://` | Exigir `https://` em `salvarCredenciaisRm` e em `rmOrigin`; se o RM não tiver TLS, reverse proxy TLS na frente |
| A9 | Sem cabeçalhos de segurança HTTP (CSP, HSTS, frame-ancestors, nosniff, Referrer-Policy) | `vercel.json` sem `headers`; grep vazio | Bloco `headers` no `vercel.json` (CSP com `js.docusign.com`, `frame-src` DocuSign, `frame-ancestors 'none'`); validar com `curl -I` |

## 4. Achados — MÉDIOS e BAIXOS

**Médios**
- M1 — IDOR em `consultarStatusEnvelopeDocusign` (`docusign.functions.ts:1047`) e `listarDestinatariosEnvelopeDocusign` (`:1141`): qualquer operadora lê nome/e-mail/telefone de qualquer envelope da conta e grava status cruzado. Resolver campanha por `envelope_docusign_id` + `assertCampanhaDoUsuario`.
- M2 — Preview de template cria envelopes reais `status: "sent"` a cada clique, nunca anulados; `returnUrl`/`frameAncestors` vêm do cliente (`:666-684, 724-770`). Usar `status: "created"` + void ao final; fixar `returnUrl` na origem do app.
- M3 — Chave RSA DocuSign, senha do RM e cache de token em texto claro no banco (acesso correto, mas dump/backup expõe). Supabase Vault; não persistir `access_token_cache`.
- M4 — Webhooks anunciados na UI (`/api/public/tae-webhook?secret=`, `/api/public/docusign/connect`) **não existem** no código; secret na query string. Remover da UI até implementar com HMAC em header + janela de tempo + idempotência.
- M5 — `api_registry` legível por qualquer `authenticated` (`USING (true)`): hosts internos, nomes de secrets, templates SOAP. IP público do RM hardcoded em `api-proxy:175`. Restringir SELECT a admin; IP via config.
- M6 — `xlsx@0.18.5` com CVE-2023-30533 e CVE-2024-22363 sem patch no npm (`npm audit`: 1 high). Parse só no navegador, sem limite de tamanho/linhas (`origem.tsx:176-222`). Trocar por `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz` ou `exceljs`; limitar 5 MB / 5.000 linhas.
- M7 — Sem MFA. Habilitar TOTP (nativo, sem captcha) e exigir `aal2` em `exigirSuperAdmin` e nas funções de credenciais.
- M8 — Política de senha só comprimento 10, duplicada em 3 lugares; sem HIBP; sem revogar outras sessões ao trocar; `criarUsuario` redefine senha de conta já existente de outro sistema sem aviso (`users.functions.ts:170-181`). `definirNivel` apaga papéis de outros sistemas (`:64-69`).
- M9 — Rascunho do wizard com CPF/telefone em `sessionStorage` não é limpo no logout (`wizard-store.ts:104-107`; `app-shell.tsx:72-77`).
- M10 — `totvs_config` legado com senha do RM legível por admin até rodar o script manual `pos-migracao/20260929_remover_totvs_config.sql`; `wa_integracoes_config` morta mas gravável. Confirmar execução / dropar.
- M11 — `bun.lock` resolve 19 pacotes num mirror do Lovable (`europe-west4-npm.pkg.dev/lovable-core-prod`); `package-lock.json` não rastreado. Regenerar lock no registro padrão e manter um só lockfile.

**Baixos**
- B1 — Mensagens cruas do PostgREST/DocuSign/RM chegam ao navegador (nomes de tabelas, XML completo). Mapear para genéricas; detalhe só no log do servidor.
- B2 — Injeção de fórmula em CSV (`RelatorioDetalheView.tsx:49-61`, `verificacao.tsx:82-97`, `ExecutarApiPanel.tsx:190-217`). Prefixar `'` em células iniciadas por `= + - @`.
- B3 — CORS `*` nas Edge Functions (Bearer, sem cookie: risco baixo). Restringir ao domínio.
- B4 — `has_role(uuid, role)` executável por `authenticated` com `_user_id` arbitrário: enumeração de papéis.
- B5 — `applyParams` aceita `..` em placeholders; `extraHeaders` por denylist; blocklist de secrets do runtime em vez de allowlist (`api-proxy:24-31, 97-101, 160-171`).
- B6 — `fetch` sem timeout em `tae-sync.server.ts`, `tae-auth.server.ts`, PDF DocuSign; parser XML com entidades habilitadas e sem limite de tamanho (`totvs-soap-proxy:5, 254-259`).
- B7 — Senha inicial digitada pelo admin (não gerada aleatoriamente); restos de mensagens de signup em `auth.tsx:89-94`.
- B8 — Catálogo estático de APIs inexistentes (`CatalogoApisContent.tsx`); índices duplicados; faltam índices em `wa_campanhas(criado_por)` e `wa_campanha_destinatarios(envelope_docusign_id)`.
- B9 — Import estático de `tae-auth.server` em `tae-config.functions.ts:5` (hoje seguro pelo `importProtection`, mas frágil).

## 5. Verificações que só você pode fazer (fora do repositório)

Rodar no SQL Editor do Supabase e colar o resultado no repo:

```sql
select tablename, policyname, cmd, roles, qual, with_check
  from pg_policies where schemaname = 'public'
   and tablename in ('profiles','user_roles','api_registry','tae_integration_settings',
                     'tae_webhook_subscriptions','gateway_call_log','soap_envelope_templates','totvs_config');
select relname, relrowsecurity from pg_class
 where relname in ('profiles','user_roles','tae_integration_settings','tae_webhook_subscriptions','gateway_call_log');
select proname, prosecdef, proconfig from pg_proc
 where proname in ('has_role','handle_new_user','set_horario_ativo','is_project_owner');
select to_regclass('public.totvs_config');           -- deve ser NULL após o pós-migração
select * from public.wa_integracoes_config;           -- conferir se há credenciais antigas
```

No dashboard do Supabase (Authentication):
- Sign In / Providers → Email: **desmarcar "Allow new users to sign up"**; desligar Magic Link, OTP, Phone, Anonymous.
- Senha: mínimo 12, letras + dígitos + símbolos, *Leaked password protection* (HIBP).
- Sessions: JWT expiry 900–1800 s; refresh token rotation ON; time-box 12 h; inatividade 8 h.
- Rate Limits: revisar `/token` (ver C4).
- Hooks: *Password Verification Attempt* (C4); *Before User Created* rejeitando domínio ≠ `calper.com.br`.
- MFA: habilitar TOTP.
- Backups: confirmar PITR/backup diário e testar um restore.

Na Vercel: confirmar que `SUPABASE_SERVICE_ROLE_KEY` está só em *Environment Variables* (Production), nunca em variável `VITE_*`; `curl -I https://<dominio>` para conferir cabeçalhos após A9.

## 6. Plano de correção v2 por fases (para aprovação)

Fases 0, 1 e 2 concluídas no código (ver §0.0). O deploy fica liberado após **aplicar as migrações, as pendências operacionais (§0.0 e §0.4) e as consultas do §5**. Fases 3 a 5 podem seguir com o sistema em produção, com o risco documentado.

| Fase | Conteúdo | Itens | Esforço |
|---|---|---|---|
| **2 — Bloqueantes restantes** (antes do deploy) | (1) Migração: revogar escrita do navegador em `wa_campanhas`/`wa_campanha_destinatarios` e dropar policies de escrita; cota diária contada em `docusign_envelopes`. (2) `wa_conta_liberada()` SECURITY DEFINER em todas as policies `wa_*`, `docusign_envelopes`, `api_registry`; `api_registry` SELECT admin-only e cadastro/exclusão via server function. (3) Revogar sessões ao desativar/definir senha (conforme decisão 1). (4) Remover fallbacks fail-open. (5) zod nas 11 funções restantes, com allowlist de host para DocuSign e RM e `https://` obrigatório. (6) Preview DocuSign: `returnUrl`/`frameAncestors` fixos, `status: "created"` + void, limite. (7) Cabeçalhos de segurança no `vercel.json` (HSTS, CSP, `frame-ancestors 'none'`, nosniff, Referrer-Policy, Permissions-Policy). (8) Lockfile único no registry oficial e `installCommand` coerente. (9) Ajustes do limite de login (N6: IP desconhecido, limite por IP ≥ conta, atomicidade, hook alinhado, `coalesce`). (10) Gestão de usuários: não redefinir senha de conta existente; exigir membro em `atualizarUsuario`/`desbloquearUsuario`. (11) Migração defensiva: `revoke insert, update, delete on user_roles, profiles from authenticated` + `has_role_me()`. | N1, N1b, A1, A3, M5, A11, N7, N4, A8, N2, A9, N3, N6, N5, A4, N12 | 3–4 dias |
| **3 — Endurecimento** | Trocar `xlsx` (tarball oficial 0.20.x ou `exceljs`) + limite 5 MB / 5.000 linhas; MFA TOTP para Super Admin (`aal2` em credenciais); política de senha única (mín. 12, classes) + HIBP + revogar outras sessões na troca; senha inicial gerada no servidor + allowlist de domínio de e-mail; mensagens de erro genéricas (N10) e `erro_msg` sem corpo de terceiro; Edge Functions: deps atualizadas, CORS na origem, variáveis locais, `apiName` validado, allowlist de `base_url`; CSV com proteção contra injeção de fórmula; logout centralizado (`sairDoPortal()`); `saveTaeSettings` ignora `data.id`; erros de config sem nome de variável; `config.toml` com `[auth]` versionado. | M6, M7, M8, L9, N10, N11, B2, N15, N17, N18, N19, B5, B6 | 3 dias |
| **4 — LGPD** | Allowlist de colunas do RM na resposta ao navegador; opt-out honrado (`bulk_opt_outs`) + endpoint de descadastro; função `anonimizar_campanha(id)` (Super Admin, auditada) zerando CPF/telefone/e-mail/`dados_extras`/`raw`; retenção automática de destinatários concluídos (prazo da decisão 2) e `docusign_envelopes` com FK; CSV com CPF mascarado por padrão, "CSV completo" gerado no servidor, restrito e auditado; mascaramento nas telas com "revelar" auditado; auditoria com regex ampliada e recursiva; FKs `on delete`, índices; Vault para RM/DocuSign; tela de Logs: tentativas só Super Admin, IP mascarado para Admin; README/`docs`: base legal, registro de operações, backup/restore testado, runbook de incidente (ANPD: 3 dias úteis, Res. CD/ANPD 15/2024; jurídico confirma). | A6, N8, N9, L1, L11, N13, N14, N16, M3, B7, B8 | 3–4 dias |
| **5 — Sessão em cookie** | `@supabase/ssr` com cookies `HttpOnly; Secure; SameSite=Lax`; `login` devolve cookie em vez de tokens; inatividade 8 h no servidor. | A5, L4 | 2 dias |

Total restante estimado: 11–13 dias. Ordem sugerida dentro da Fase 2: N1 → N7 → A1/A3 → N4/A8 → N2 → A9/N3 → N6 → N5/A4.

## 7. Decisões (aprovadas em 2026-10-01 com os padrões abaixo; TAE removido do projeto)

Para cada item há um **padrão proposto**; o plano foi aprovado sem ressalvas, então valem os padrões.

1. **Revogar sessão ao desativar / definir senha.** A conta Auth é compartilhada com outros sistemas Calper: apagar `auth.sessions` ou banir derruba os outros portais. **Padrão:** `wa_conta_liberada()` nas policies + JWT de 15 min (acesso cai em até 15 min) e **sem** revogar sessões. Alternativa: revogar mesmo assim (acesso imediato, efeito colateral nos outros portais).
2. **Prazos de retenção.** **Padrão:** destinatários anonimizados 12 meses após a conclusão da campanha; `wa_auditoria` 2 anos; `auth_login_log` 180 d; `gateway_call_log` 30 d. Confirmar com o jurídico (contrato pode exigir mais).
3. **TAE: Admin vs Super Admin.** **Padrão:** credenciais só Super Admin (já implementado). Manter?
4. **Feature "Gateway de APIs / Executar API" em produção.** **Padrão:** manter apenas o que está ligado ao `api_registry`, remover o catálogo estático (`CatalogoApisContent.tsx`), cadastro via server function.
5. **Rate limit de `/token` no Supabase.** Com login pelo servidor, todas as tentativas saem dos IPs da Vercel. **Padrão:** elevar o limite no dashboard (ex.: 300/5 min) e manter o bloqueio real nas nossas tabelas.
6. **Substituir `xlsx`.** **Padrão:** tarball oficial do SheetJS 0.20.3 (mesma API, zero refatoração). Alternativa: `exceljs` (npm, mais refatoração).
7. **Limite por IP.** **Padrão:** 20 falhas em 15 min por IP (bloqueio 15 min fixo) e 5 por conta com backoff, para não derrubar o escritório inteiro atrás de NAT. Alternativa: manter 5/5 como pedido, aceitando o risco de bloqueio coletivo.
8. **CSV completo com CPF.** **Padrão:** CSV mascarado para todos; CSV completo só Admin/Super Admin, gerado no servidor e auditado.
9. **Lockfile e instalador na Vercel.** **Padrão:** `npm ci` + `package-lock.json`, apagar `bun.lock`. Alternativa: regenerar `bun.lock` no registry oficial.
10. **Preview de template.** **Padrão:** envelope `created` + void. Alternativa: desligar o preview (só PDF do template).

## 8. O que já está bom

- Service role nunca vai ao cliente: `importProtection` em `vite.config.ts`, `await import` dentro dos handlers, proxy lazy.
- Credenciais do RM em schema privado `envio_privado`, funções SECURITY DEFINER com `search_path=''`, EXECUTE só service_role, senha nunca devolvida nem logada.
- `docusign_config` fora da Data API; chave RSA e segredo nunca devolvidos; token só em memória; escrita só super admin.
- JWT verificado no servidor (`getClaims`); todas as 34 server functions com `requireSupabaseAuth` e checagem de papel no banco; papéis nunca vêm de `user_metadata`; nenhum `userId` de input identifica o chamador.
- `wa_project_users` gravável só pelo servidor (policies removidas + REVOKE + trigger guard); `trocar_senha` só desligada após conferir a senha atual.
- Gestão de usuários só super admin, sem auto-rebaixamento, garante outro super admin, `email_confirm` forçado.
- Edge Functions com `verify_jwt`, rejeição do anon key, checagem de papel e conta ativa; host de destino nunca controlado pelo chamador; senha do RM mascarada no SOAP; parâmetros XML escapados.
- Sem signup/OTP/OAuth/reset no código; sem open redirect; sem `dangerouslySetInnerHTML` com dados externos; `window.open` com `noopener`.
- Página de erro SSR genérica, sem stack/env. Nenhum segredo real no histórico git.

## 9. Não verificável a partir do repositório

Policies e RLS das tabelas do projeto compartilhado (§5); configurações do dashboard Supabase (signup, senha, rate limits, JWT, hooks, MFA, backups); variáveis na Vercel; cabeçalhos injetados pela Vercel; se as migrações e o pós-migração foram aplicados em produção; algoritmo de assinatura do JWT (HS256 vs ES256).
