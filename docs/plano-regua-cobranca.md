# Plano — Régua de Cobrança (Disparo em Massa)

Base: `docs/PRD-regua-cobranca.md` (v1.0, 18/10/2026). Mockup: `docs/mockups/regua-cobranca.html` (v2, aguardando aprovação).
Este plano registra o que mudou em relação ao PRD e é a referência para as fases. Cada fase só começa com o "ok" do Wagner.

## 1. Decisões (18/10/2026)

| # | Decisão | Origem |
|---|---|---|
| D1 | Webhook da Zenvia em **Edge Function** (`zenvia-webhook`, sem JWT, chave no Vault). Todo o resto (Zenvia, Resend, SMTP, RM, banco) roda em **server functions** do app (`createServerFn` + `supabaseAdmin`), como as integrações atuais. | Wagner |
| D2 | Perfis do PRD criados **já com as permissões marcadas**: Analista de cobrança, Gestor financeiro, Auditoria. Admin e Super Admin continuam. | Wagner |
| D3 | Não há cadastro de setores: o setor do número remetente é **texto livre**. | Wagner |
| D4 | Ainda não há token nem template Zenvia: a Fase 1 entrega estrutura e telas; o **envio real de teste fica pendente**. | Wagner |
| D5 | Domínio de demonstração do Resend: **imobsystems.com.br** (DNS na Vercel da conta wagnersap). Conta Resend: o Wagner cria. | Wagner |
| D6 | **Título da remessa** obrigatório em todo lote (sugerido automaticamente, editável). Aparece em Lotes, Painel, Detalhe, exportação e Auditoria. | Wagner |
| D7 | Régua do TOTVS com **faixas de atraso**: 30 (1–30), 60 (31–60), 90 (61–90) e acima de 90 dias, além de **a vencer**. | Wagner |
| D8 | O usuário **escolhe o template de cada canal** marcado (WhatsApp e e-mail) **antes** da pré-visualização. | Wagner |
| D9 | A pré-visualização mostra **a mensagem montada de cada cliente**: com os dois canais, WhatsApp e e-mail **lado a lado**; com um canal só, apenas ele. | Wagner |
| D10 | Templates viram uma **biblioteca** (vários por canal, cada um com régua sugerida), não um vínculo único por canal. | consequência de D7/D8 |

## 2. Ajustes ao PRD (padrão do código prevalece)

| PRD | No projeto | Por quê |
|---|---|---|
| `empresa_id` | `imobiliaria_id` | nome do tenant em todas as tabelas; RLS por `imobenviomassa.tenant_atual()` |
| `regua.lote.criar` (com ponto) | `regua_lote_criar` | `perfil_permissoes.permission_id` aceita só `^[a-z0-9_]{2,60}$` |
| `integracoes.editar` | `gerenciar_credenciais` (já existe) | mesma regra, só Super Admin |
| Abas dentro da Régua | 5 itens no submenu da sidebar (Painel, Novo lote, Lotes, Templates, Configurações) | padrão do DocuSign; cada item tem permissão própria na matriz |
| "Boletos a vencer"; pós-vencimento fora do MVP | **a vencer + em atraso (30/60/90/>90)** no MVP | D7 |
| Assistente de 4 passos | **5 passos**: Origem → Remessa e filtros → Templates → Pré-visualização → Confirmação | D6, D8, D9 |
| Vault aceita `^(rm|docusign)_` | ampliar para `zenvia_`, `resend_`, `smtp_` | migration aditiva (`create or replace` da validação) |

## 3. Permissões (menu-registry + perfis)

| Chave | Tela/ação | Analista de cobrança | Gestor financeiro | Auditoria | Admin |
|---|---|:-:|:-:|:-:|:-:|
| `regua_cobranca` | submenu | ✓ | ✓ | ✓ | ✓ |
| `regua_dashboard_ver` | Painel |  | ✓ | ✓ | ✓ |
| `regua_lote_criar` | Novo lote | ✓ | ✓ |  | ✓ |
| `regua_lote_acionar` | acionar/cancelar | ✓ | ✓ |  | ✓ |
| `regua_disparo_extraordinario` | ignora trava 24 h |  | ✓ |  | ✓ |
| `regua_auditoria_ver` | Lotes, detalhe, trilha | ✓ | ✓ | ✓ | ✓ |
| `regua_config_editar` | Templates e Configurações |  |  |  | ✓ |
| `configure_integrations` (existe) | abas Zenvia/E-mail (ver, testar) |  |  |  | ✓ |
| `gerenciar_credenciais` (existe) | token, API key, SMTP | só Super Admin | | | |

## 4. Modelo de dados (schema `imobenviomassa`, tudo com `imobiliaria_id` + RLS)

Régua
- `regua_lote`: id, numero (sequencial por imobiliária), **titulo**, observacao, origem (`rm`/`planilha`), **tipo_regua** (`a_vencer`/`atraso`), **faixa_atraso** (`30`/`60`/`90`/`90+`, nulo em a vencer), periodo_vencimento, filtros (jsonb), canais (text[]), **template_whatsapp_id**, **template_email_id**, usuario_id, tipo (`normal`/`extraordinario`), justificativa, status, contadores (jsonb), iniciado_em, finalizado_em.
- `regua_boleto`: lote_id, cliente_codigo, cliente_nome, cpf_cnpj (sem leitura pelo navegador, como em `wa_campanha_destinatarios`), empreendimento, unidade, numero, vencimento, **dias_atraso**, valor, linha_digitavel, status_registro_banco, status_geral, incluido (bool, exclusão manual).
- `regua_contato`, `regua_documento`, `regua_tentativa`: como no PRD.
- `regua_template` (substitui `regua_template_vinculo`): id, nome, canal, **regua_sugerida**, ativo; WhatsApp: whatsapp_template_id, remetente_id, mapa_variaveis, usa_documento; e-mail: assunto, corpo, anexo_tipo. Status calculado: Pronto / Variável sem campo / Zenvia não aprovado.
- `regua_config`: regra_senha, texto_dica, validade_link_horas, intervalo_whatsapp_seg.

Integrações: `integracao_zenvia`, `whatsapp_remetente` (setor = texto), `whatsapp_template`, `email_provedor` — como no PRD.

## 5. Fases

Implementação em 18/10/2026 (código no repositório; banco ainda não aplicado no ikvj). "Feito" = código pronto e testado
aqui; o teste de ponta a ponta depende de aplicar o banco e das contas Zenvia/Resend.

**Fase 0 — Decisões**
- [x] Mockup v2 aprovado (18/10/2026)
- [ ] Regra da senha do PDF e validade do link — padrão: 5 primeiros dígitos do CPF/CNPJ e 72 h (ajustável em Régua › Configurações)
- [ ] Banco piloto e empreendimento piloto
- [ ] Template de cobrança aprovado na Zenvia (sem conta ainda — D4)

**Fase 1 — Banco, permissões e integrações**
- [x] Migration aditiva `migrations/20261018200000_imobenviomassa_03_regua_cobranca.sql` (SQL Editor: `7_aplicar_regua.sql`) com RLS; teste a seco `8_testar_regua.sql`: 30/30 no ensaio local
- [x] Vault ampliado para `zenvia_`, `resend_`, `smtp_` (`segredo_nome_valido`)
- [x] Chaves no menu-registry e perfis Analista de cobrança, Gestor financeiro e Auditoria (perfis do sistema, regras no provisionamento)
- [x] Bucket privado `imobenviomassa-regua` (criado pela migration) e expiração: remove os PDFs vencidos a cada rodada de envio e pelo botão em Régua › Configurações (não há job diário: ver §7)
- [x] Aba Integrações › Zenvia WhatsApp: token (Vault, Super Admin + MFA), testar conexão e números, criar assinaturas, números remetentes (setor em texto), sincronizar templates
- [x] Edge Function `imobenviomassa-zenvia-webhook` (mensagens e status; idempotente)
- [x] Aba Integrações › E-mail: Zenvia / Resend / SMTP, cadastro e verificação de domínio, remetente, e-mail de teste
- [x] Auditoria em toda alteração de configuração e em todo acionamento, cancelamento, reenvio e exportação
- [ ] Envio real de template Zenvia com cabeçalho Documento — **pendente (D4)**. Formato usado, conferido na especificação oficial: `contents[{ type: "template", templateId, fields: { …variáveis, documentUrl } }]`

**Fase 2 — Origem dos dados**
- [ ] Cadastrar `API.FIN.BOLETOS_A_VENCER` e `API.FIN.BOLETOS_EM_ATRASO` no Gateway e testar na aba Executar — **depende da consulta no TOTVS**. A régua lê o endpoint cadastrado e manda `?parameters=DIAS_MIN=…;DIAS_MAX=…` (atraso) ou `DATA_INI=…;DATA_FIM=…` (a vencer)
- [x] Upload de planilha com modelo e validação (inclui `dias_atraso`; até 2.000 linhas)
- [x] Normalização das duas origens (aceita os nomes de coluna do RM e os do modelo)

**Fase 3 — Banco e documento**
- [ ] Consulta de registro no banco piloto — **sem banco piloto**: hoje o registro vem da coluna `registrado` da origem (S/N); sem a coluna, o boleto segue como "Não verificado"
- [x] PDF com senha no servidor (AES-256; linha digitável e código de barras montado a partir dela)
- [x] URL assinada com expiração em `regua_documento`

**Fase 4 — Templates e pré-visualização**
- [x] Tela Templates: biblioteca + editor (WhatsApp vinculado a template Zenvia; e-mail com variáveis), prévia e enviar teste
- [x] Novo lote, passos 1–3: origem, título da remessa, tipo de régua e faixa, canais, template de cada canal (sugerido pela faixa)
- [x] Validação de contatos: formato de e-mail e de telefone. Z-API não implementada (opcional no PRD): número sem WhatsApp aparece como falha de envio
- [x] Passo 4: tabela com status de registro e contato + prévia da mensagem do cliente selecionado (WhatsApp e e-mail lado a lado)

**Fase 5 — Disparo**
- [x] Passo 5 e acionamento: fila com intervalo entre WhatsApp, trava de 24 h por boleto e canal, disparo extraordinário com justificativa
- [x] Envio WhatsApp por template com PDF no cabeçalho; e-mail pelo provedor ativo (Resend só com domínio `verified`)
- [x] Webhook de entrega gravando em `regua_tentativa` (entregue / lido / falha)

**Fase 6 — Relatório e dashboard**
- [x] Lotes com título, régua, progresso; detalhe por boleto com reenviar e trilha (payload e resposta do provedor)
- [x] Exportação Excel e PDF (com o título da remessa)
- [x] Painel com indicadores e filtros (período, empreendimento, canal, status, régua/faixa, lote). Filtro por unidade não entrou

**Fase 7 — Piloto**
- [ ] Lote de teste com 10 boletos de contatos internos
- [ ] Lote real do empreendimento piloto
- [ ] Critérios de aceite do PRD (seção 8) + os novos abaixo

## 6. Critérios de aceite acrescentados
- [ ] Lote não avança sem título
- [ ] Com WhatsApp e e-mail marcados, o lote não avança sem um template de cada canal
- [ ] A prévia mostra, para o cliente selecionado, exatamente o texto que será enviado em cada canal válido dele
- [ ] Filtro de faixa 30/60/90 traz do TOTVS só boletos com atraso dentro da faixa
- [ ] O título da remessa aparece em Lotes, Painel, Detalhe, exportação e Auditoria

## 7. Como o envio roda (diferença em relação ao PRD)
O PRD pede "fila assíncrona". O app segue o padrão do Disparo DocuSign: o lote fica "Em processamento" e a tela do lote
chama o servidor em sequência (até 6 envios por chamada, respeitando o intervalo do WhatsApp). Fechou a tela: o lote
espera e continua de onde parou ao abrir de novo ("Continuar envio"); envios presos há mais de 10 min voltam para a fila.
Para rodar sem tela aberta, o próximo passo é um agendador (pg_cron chamando uma Edge Function), que também faria a
limpeza diária dos PDFs vencidos.

## 8. Ajustes de 19/10/2026 (pedidos do Wagner)
- [x] Faixa de atraso **personalizada** (de X a Y dias, ou "X ou mais"), além das prontas. Banco: `migrations/20261019100000_imobenviomassa_04_regua_faixa_personalizada.sql` (SQL Editor: `9_regua_faixa_personalizada.sql`); os dias ficam em `regua_lote.filtros.dias_min/dias_max` e vão ao TOTVS como `DIAS_MIN`/`DIAS_MAX`.
- [x] **Filtros por campo** montados pelo usuário com as colunas que a API do TOTVS RM devolve ("Carregar campos do TOTVS") ou as colunas da planilha: campo + condição (igual, diferente, contém, maior, menor, entre, vazio, preenchido) + valor. Todos valem juntos (E), aplicados no servidor e gravados em `regua_lote.filtros.campos`; aparecem no resumo e no detalhe do lote.
- [x] Passo 3 virou **Canais e templates**: o card Canais (WhatsApp, e-mail ou os dois) e, logo abaixo, os templates de cada canal marcado. Os canais saíram do card Filtros.
