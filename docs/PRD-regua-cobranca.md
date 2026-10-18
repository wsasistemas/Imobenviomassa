# PRD — Régua de Cobrança (Disparo em Massa · imobenviomassa)

Versão 1.0 · 18/10/2026 · Autor: Wagner Antunes (WSA Sistemas IA)

> Coloque este arquivo em `docs/PRD-regua-cobranca.md` na raiz do projeto imobenviomassa. O prompt de implementação (`PROMPT-claude-code.md`) aponta para este caminho.

---

## 1. Visão geral

A Régua de Cobrança é o módulo do Disparo em Massa (imobenviomassa.imobsystems.com.br) que consulta, valida e envia boletos a vencer por WhatsApp e e-mail. O envio é feito em lotes acionados manualmente, com rastreio por boleto e indicadores por período, canal e empreendimento.

**Problema.** Hoje o envio de boletos depende de etapas manuais: extrair a lista, conferir contatos, gerar o PDF, enviar um a um e controlar em planilha. Não há visão consolidada de quem recebeu, quem tem contato inválido nem quanto falhou.

**Objetivo.** Automatizar as 10 etapas do processo, reaproveitando o que o portal já tem: o menu Régua de Cobrança, as Integrações TOTVS RM e o Gateway de APIs (tabela `api_registry`, aba Executar).

**Indicador principal.**

```
Taxa de sucesso da régua = disparos processados com sucesso ÷ disparos elegíveis × 100
```

Um boleto conta como sucesso quando ao menos um canal foi enviado.

---

## 2. Escopo

| Dentro do MVP | Fora do MVP (fase 2+) |
| --- | --- |
| Acionamento manual de lote e disparo extraordinário por usuário autorizado | Agendamento automático (D-5, D-1, D0) via cron |
| Origem: TOTVS RM via Gateway de APIs ou upload de planilha | Régua pós-vencimento (D+3, D+7) e negociação |
| Consulta de registro do boleto no banco | Segunda via e atualização de valor com juros |
| PDF protegido por senha e link temporário | Resposta do cliente pelo WhatsApp (atendimento) |
| Validação de WhatsApp e formato de e-mail | Canal SMS |
| WhatsApp pela Zenvia, só por template aprovado e sincronizado | Edição visual avançada de templates |
| E-mail por Zenvia, Resend ou SMTP, com domínio próprio do cliente | Conciliação de pagamento (baixa) no RM |
| Status por tentativa, relatório do lote e dashboard | |

---

## 3. Perfis e permissões

As permissões entram no módulo **Perfis e permissões** existente, como chaves do aplicativo `regua_cobranca`.

| Perfil | Pode fazer | Chaves |
| --- | --- | --- |
| Analista de cobrança | Montar lote, revisar pré-visualização, acionar lote | `regua.lote.criar`, `regua.lote.acionar` |
| Gestor financeiro | Tudo do analista + disparo extraordinário, cancelar lote, ver dashboard | `regua.disparo.extraordinario`, `regua.dashboard.ver` |
| Administrador | Configurar templates, senha do PDF, validade do link e integrações | `regua.config.editar`, `integracoes.editar` |
| Auditoria | Consultar lotes, tentativas e logs, sem acionar nada | `regua.auditoria.ver` |

Toda ação de acionamento, cancelamento ou alteração de configuração grava no módulo **Auditoria** (usuário, data/hora, IP, antes/depois).

---

## 4. Fluxo funcional (10 etapas)

```
01 Acionamento do lote (manual ou extraordinário, lote registrado)
02 Consulta no TOTVS RM ou planilha (boletos a vencer + dados do cliente)
03 Boleto registrado no banco?  ── não ──► Exceção: boleto não processado
        │ sim
04 Geração do PDF com senha (no servidor)
05 WhatsApp ou e-mail válido?   ── não ──► Exceção: cliente sem contato válido
        │ sim
06 Hospedagem temporária (URL assinada com expiração)
07 Preparação das mensagens (template por canal)
08 Disparo multicanal (WhatsApp por template Zenvia + e-mail pelo provedor ativo)
09 Registro dos resultados (status por tentativa e canal)
10 Relatório do lote e dashboard  ◄── exceções também entram aqui
```

**Regras de decisão**

- Se só um canal for válido, o disparo segue apenas por ele.
- Falha em um canal é registrada e pode ser reenviada no detalhe do lote, sem reprocessar o boleto inteiro.
- O lote termina como **Concluído com falhas** quando houver qualquer exceção ou falha.
- Um mesmo boleto não pode ser enviado duas vezes no mesmo canal em 24 h, salvo disparo extraordinário.

---

## 5. Telas

### 5.1 Menu Régua de Cobrança (abas: Painel, Novo lote, Lotes, Templates, Configurações)

**Painel**
- RF-01 Cards: taxa de sucesso da régua, WhatsApp enviados/entregues, e-mails enviados/entregues, contatos inválidos, falhas de processamento, tempo médio por lote.
- RF-02 Gráficos: mensagens enviadas por dia e canal; taxa de sucesso e volume por empreendimento.
- RF-03 Filtros: período, empreendimento, unidade, canal, status, faixa de vencimento e lote.
- Tabela dos últimos lotes com link para o detalhe.

**Novo lote (assistente em 4 passos)**
1. Origem: TOTVS RM (API cadastrada no Gateway) ou upload `.xlsx`/`.csv` com modelo para download.
2. Filtros: período de vencimento, empreendimentos, unidades, canais.
3. Pré-visualização: cliente (CPF/CNPJ mascarado), unidade, boleto, vencimento, valor, status no banco, status do WhatsApp e do e-mail; o usuário pode excluir linhas. Cards: encontrados, elegíveis, não registrados, sem contato válido.
4. Confirmação: resumo e botão **Acionar lote**; disparo extraordinário exige permissão e justificativa.

- RF-04 O lote grava data/hora, usuário, empreendimentos, clientes, boletos, período, origem e status.
- RF-05 Boletos não registrados e clientes sem contato válido ficam fora do disparo e aparecem como exceção.
- RF-06 Trava de duplicidade de 24 h por boleto e canal.

**Lotes**
- RF-07 Lista de lotes com status (Rascunho, Em processamento, Concluído, Concluído com falhas, Cancelado) e progresso em tempo real.
- RF-08 Detalhe do lote: metadados, contadores (no lote, não registrados, sem contato, elegíveis, sucesso, falhas), resultado por canal, uma linha por boleto (PDF, WhatsApp, e-mail, resultado) com **Reenviar** nas falhas e **Ver trilha** com a linha do tempo do boleto.
- RF-09 Exportar relatório do lote em Excel e PDF.

**Templates**
- RF-10 WhatsApp: escolher o template Zenvia **Aprovado** e o número remetente; mapear cada variável (`{{1}}`, `{{2}}`…) para um campo do boleto (nome, unidade, empreendimento, vencimento, valor, linha digitável, dica da senha); cabeçalho Documento recebe o PDF; prévia da mensagem; enviar teste.
- RF-11 E-mail: assunto e corpo com variáveis `{{nome}}`, `{{unidade}}`, `{{empreendimento}}`, `{{vencimento}}`, `{{valor}}`, `{{linha_digitavel}}`, `{{link_boleto}}`, `{{dica_senha}}`; anexo (PDF protegido ou só link); enviar teste.
- Variável sem mapeamento impede salvar. Template que sair de Aprovado bloqueia novos lotes por WhatsApp.

**Configurações**
- RF-12 Regra da senha do PDF (ex.: 5 primeiros dígitos do CPF/CNPJ) e texto da dica.
- RF-13 Validade do link temporário (horas) e intervalo entre mensagens de WhatsApp.
- RF-14 Credenciais nunca nesta tela: ficam em Configurações › Integrações.

### 5.2 Configurações › Integrações (abas novas ao lado de TOTVS RM, DocuSign e Gateway de APIs)

**Aba Zenvia WhatsApp**

| Bloco | O que faz |
| --- | --- |
| Conta | Um token para todos os números, guardado no Vault e nunca enviado ao navegador; campo para colar/substituir; status; botão **Testar conexão e números** |
| Webhooks | Botão **Criar assinaturas**: uma assinatura para mensagens e status de entrega, apontando para a Edge Function `zenvia-webhook`; o setor sai do número de destino |
| Números remetentes | Números da conta com nome, setor e status; marca o número padrão da régua |
| Templates | Botão **Sincronizar templates**: lê os templates de WhatsApp da conta pela API v2 da Zenvia e faz upsert em `whatsapp_template`; filtro por status; coluna "Uso" mostra onde o template está vinculado |

**Aba E-mail**

| Provedor | Credencial | Domínio remetente |
| --- | --- | --- |
| Zenvia E-mail | Mesmo token da Zenvia | Configurado na conta Zenvia |
| Resend | API key no Vault | Domínio do cliente, cadastrado e verificado pela API do Resend |
| SMTP próprio | Host, porta, usuário e senha no Vault | O que o servidor do cliente permitir |

- Um provedor ativo por empresa.
- Domínio próprio (Resend): o usuário informa o domínio → **Cadastrar domínio** (API de domínios do Resend) → tabela com os registros DNS (SPF e DKIM) para copiar → **Verificar DNS** → status `not_started`, `pending`, `verified`, `failed`, `temporary_failure`. Sem `verified`, a régua não envia e-mail por esse domínio.
- Remetente: nome, e-mail, responder para; **Enviar e-mail de teste**.

---

## 6. Requisitos não funcionais

| Tema | Requisito |
| --- | --- |
| Segredos | Tokens, API keys e senhas no Vault do Supabase; toda chamada externa por Edge Function |
| PDF | Senha aplicada no servidor; bucket privado; acesso por URL assinada com expiração (padrão 72 h) |
| Expiração | Rotina diária remove PDFs vencidos e grava criação/expiração |
| Acesso a dados | RLS por empresa em todas as tabelas novas |
| LGPD | CPF mascarado na tela; base legal: execução de contrato; logs sem o PDF |
| Processamento | Fila assíncrona; lote de 1.000 boletos em até 15 min; reprocessamento idempotente |
| Limites de envio | Intervalo configurável entre mensagens de WhatsApp |
| Auditoria | Cada tentativa guarda payload, resposta do provedor e horário |
| Migrations | Somente aditivas, versionadas no Git |

---

## 7. Modelo de dados

### Régua

| Tabela | Conteúdo principal |
| --- | --- |
| `regua_lote` | id, empresa_id, origem (rm/planilha), filtros (json), periodo_vencimento, usuario_id, tipo (normal/extraordinario), justificativa, status, contadores, iniciado_em, finalizado_em |
| `regua_boleto` | lote_id, cliente (codigo, nome, cpf_cnpj), empreendimento, unidade, numero, vencimento, valor, linha_digitavel, status_registro_banco, status_geral |
| `regua_contato` | boleto_id, canal, valor, status_validacao (valido, invalido, nao_localizado, erro, nao_informado), validado_em |
| `regua_documento` | boleto_id, storage_path, protegido, criado_em, expira_em, removido_em |
| `regua_tentativa` | boleto_id, canal, mensagem_renderizada, status (enviado, entregue, falha), provedor, id_provedor, resposta (json), tentado_em |
| `regua_template_vinculo` | empresa_id, canal, whatsapp_template_id, remetente_id, mapa_variaveis (json), usa_documento, assunto, corpo, anexo_tipo |
| `regua_config` | empresa_id, regra_senha, texto_dica, validade_link_horas, intervalo_whatsapp_seg |

### Integrações

| Tabela | Conteúdo principal |
| --- | --- |
| `integracao_zenvia` | empresa_id, token_vault_ref, status_conexao, webhook_ids (json), testado_em |
| `whatsapp_remetente` | empresa_id, numero, nome, setor, status, padrao_regua |
| `whatsapp_template` | empresa_id, zenvia_id, nome, categoria, idioma, status, header_tipo, corpo, variaveis (json), sincronizado_em |
| `email_provedor` | empresa_id, tipo (zenvia/resend/smtp), credencial_vault_ref, smtp_host, smtp_porta, dominio, dominio_id_provedor, status_dominio, registros_dns (json), remetente_nome, remetente_email, reply_to, ativo |

### Integrações externas

| Integração | Uso | Como entra |
| --- | --- | --- |
| TOTVS RM | Boletos a vencer + dados do cliente | API no Gateway (`api_registry`), ex.: `API.FIN.BOLETOS_A_VENCER` |
| Planilha | Origem alternativa | Upload com validação de colunas |
| Banco | Consulta de registro do boleto | Edge Function por banco, credenciais em Integrações |
| Zenvia WhatsApp | Envio por template + status de entrega | API v2 (`/v2/templates`, `/v2/channels/whatsapp/messages`) + webhook |
| Zenvia E-mail / Resend / SMTP | Envio do e-mail com PDF | Provedor ativo em `email_provedor` |
| Z-API (opcional) | Verificar se o número tem WhatsApp | Só validação; sem ela, número inválido aparece como falha de envio |

O status **entregue** só é preenchido quando o provedor devolver webhook de entrega.

---

## 8. Indicadores e critérios de aceite

| Indicador | Fórmula |
| --- | --- |
| Taxa de sucesso por canal | enviados com sucesso no canal ÷ elegíveis no canal |
| Taxa de contatos inválidos | contatos inválidos ou não informados ÷ boletos |
| Taxa de falha de processamento | boletos com erro (registro, PDF ou envio) ÷ boletos do lote |
| Volume por empreendimento | boletos enviados por empreendimento |
| Tempo médio de processamento | finalizado_em − iniciado_em, média por lote |

**Critérios de aceite**

- [ ] Lote criado pelo RM e pela planilha gera a mesma pré-visualização para os mesmos boletos
- [ ] Boleto não registrado fica fora do disparo e aparece como exceção
- [ ] Cliente sem contato válido fica fora do disparo e aparece como exceção
- [ ] PDF só abre com a senha configurada e o link expira no prazo
- [ ] WhatsApp sai só por template Aprovado, com variáveis preenchidas e PDF no cabeçalho
- [ ] E-mail sai pelo provedor ativo; com Resend, só por domínio `verified`
- [ ] Cada tentativa tem status por canal e resposta do provedor gravados
- [ ] Reacionar o mesmo lote não gera envio duplicado
- [ ] Totais do dashboard batem com o relatório exportado
- [ ] Nenhum token ou senha aparece no frontend, no bundle ou nos logs
- [ ] Usuário sem permissão não vê disparo extraordinário nem as abas de Integrações

---

## 9. Plano de ação (fases com portão)

Cada fase só começa quando o checklist da anterior estiver todo marcado.

**Fase 0 — Decisões**
- [ ] Criar e aprovar na Zenvia o template de cobrança (categoria Utilidade, cabeçalho Documento)
- [ ] Definir regra da senha do PDF e validade do link
- [ ] Definir banco piloto e empreendimento piloto
- [ ] Aprovar o mockup

**Fase 1 — Base de dados, permissões e integrações**
- [ ] Migrations das tabelas `regua_*` e de integração, com RLS
- [ ] Chaves de permissão em Perfis e permissões
- [ ] Bucket privado de boletos e rotina de expiração
- [ ] Aba Zenvia WhatsApp: token no Vault, teste, webhooks, números e sincronização de templates
- [ ] Aba E-mail: Zenvia, Resend ou SMTP, com verificação de domínio
- [ ] Envio real de teste de template com cabeçalho Documento (confirmar o campo de mídia na API da Zenvia)

**Fase 2 — Origem dos dados**
- [ ] Cadastrar `API.FIN.BOLETOS_A_VENCER` no Gateway e testar na aba Executar
- [ ] Upload de planilha com modelo e validação
- [ ] Normalização das duas origens para `regua_boleto`

**Fase 3 — Banco e documento**
- [ ] Edge Function de consulta de registro no banco piloto
- [ ] Geração do PDF com senha no servidor
- [ ] URL assinada com expiração em `regua_documento`

**Fase 4 — Validação de contatos**
- [ ] Validação de WhatsApp (Z-API opcional, com cache) e de formato de e-mail
- [ ] Tela de pré-visualização com status de registro e contato

**Fase 5 — Mensagens e disparo**
- [ ] Aba Templates com vínculo ao template Zenvia e mapeamento de variáveis
- [ ] Fila com intervalo entre mensagens e trava de duplicidade
- [ ] Envio WhatsApp por template com PDF no cabeçalho e e-mail pelo provedor ativo
- [ ] Webhooks de entrega gravando em `regua_tentativa`

**Fase 6 — Relatório e dashboard**
- [ ] Tela Lotes com progresso em tempo real e detalhe por boleto
- [ ] Exportação Excel e PDF
- [ ] Painel com indicadores e filtros

**Fase 7 — Piloto**
- [ ] Lote de teste com 10 boletos de contatos internos
- [ ] Lote real do empreendimento piloto
- [ ] Conferir critérios de aceite e liberar para os demais

---

## 10. Riscos e decisões

| Risco ou decisão | Impacto | Encaminhamento |
| --- | --- | --- |
| Envio em massa por Z-API (não oficial) | Bloqueio do número | Decidido: envio pela Zenvia com template aprovado; Z-API só para validar |
| Campo de mídia do cabeçalho na Zenvia | PDF não chega no WhatsApp | Validar com envio real na Fase 1 |
| Link do PDF expirar antes do download pela Zenvia | Mensagem sem documento | Validade mínima de algumas horas; registrar falha |
| Senha do PDF no WhatsApp | Cliente não consegue abrir | Enviar a dica da senha na mensagem; testar no piloto |
| Título fala em régua "periódica", gatilho é manual | Expectativa diferente | Agendamento é fase 2 |
| "Registro on-line": consultar ou registrar? | Escopo diferente se o RM já registra via CNAB | MVP assume só consulta; confirmar com o financeiro |
| Dados desatualizados no RM | Muitos contatos inválidos | Exportar lista de inválidos para correção do cadastro |
| Domínio do cliente sem DNS publicado | E-mail não sai | Bloquear envio e mostrar o status na tela de Templates |
