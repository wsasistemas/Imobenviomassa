# Portal Disparo em Massa — LGPD, privacidade, backup e resposta a incidentes

Documento operacional para TI, jurídico e o Encarregado (DPO) da Calper. Descreve **que dados o portal trata, por quê, por quanto tempo, quem os recebe e como atender um titular ou um incidente**. Os itens marcados com ⚠ dependem de decisão do jurídico e estão com um padrão provisório.

Última revisão: 2026-10-01. Responsável pelo documento: TI (Calper). Encarregado (DPO): ⚠ _preencher nome e contato_.

---

## 1. O que o portal faz com dados pessoais

O portal envia, em lote, documentos de contrato (via DocuSign) a **compradores de imóveis** da Calper. A lista de compradores vem do TOTVS RM ou de uma planilha enviada pelo operador. Os operadores do portal são funcionários da Calper.

| Papel (LGPD) | Quem |
|---|---|
| Controlador | Construtora Calper |
| Operadores (suboperadores) | DocuSign (assinatura), Vercel (hospedagem do app), Supabase (banco, autenticação, Edge Functions) |
| Fonte dos dados | TOTVS RM (sistema da própria Calper) ou planilha carregada pelo operador |
| Titulares | Compradores e, quando constam do contrato, cônjuges. Também os funcionários que usam o portal |

**Base legal (provisória ⚠):** execução de contrato e procedimentos preliminares a pedido do titular (LGPD art. 7º, V) para o envio dos documentos do contrato; legítimo interesse (art. 7º, IX) para a trilha de auditoria e segurança do próprio portal. Confirmar com o jurídico.

## 2. Inventário de dados

| Dado | Onde fica | Finalidade | Retenção |
|---|---|---|---|
| Nome, CPF/CNPJ, telefone, e-mail, empreendimento, bloco, unidade do comprador | `wa_campanha_destinatarios` | Montar e enviar o envelope; acompanhar status | Anonimizado 12 meses após a campanha encerrar (⚠) |
| Nome, e-mail, telefone e CPF do cônjuge | `wa_campanha_destinatarios.dados_extras` (só 4 chaves) | Segundo signatário ou cópia | Igual ao comprador |
| Resposta bruta do DocuSign (nomes, e-mails dos signatários) | `docusign_envelopes.raw` | Conferência de status | Apagado em 12 meses (⚠) ou na anonimização |
| Mensagem de erro do envio | `wa_campanha_destinatarios.erro_msg` | Suporte | Igual ao comprador; só código resumido, nunca corpo de resposta |
| Lista de descadastro (CPF, e-mail ou telefone) | `wa_opt_outs` | Honrar o pedido de não receber envios | Enquanto o descadastro valer |
| Trilha de auditoria (funcionário, ação, IP, navegador) | `wa_auditoria` | Segurança e prestação de contas | 2 anos |
| Tentativas de login (e-mail, IP, navegador, resultado) | `auth_login_log` | Segurança (bloqueio por força bruta) | 180 dias |
| Conta do funcionário (nome, e-mail) | Supabase Auth, `profiles`, `wa_project_users` | Acesso ao portal | Enquanto o vínculo existir |
| Metadados de chamadas ao gateway (sem corpo) | `gateway_call_log` | Diagnóstico | 30 dias |

O que o portal **não** guarda: senhas de usuários em texto (o Supabase Auth guarda hash), corpo das respostas do RM, envelope SOAP, query string das chamadas.

**Minimização já aplicada:** o CPF não vai para o DocuSign (só nome, e-mail, telefone e dados do imóvel); `dados_extras` só aceita nome, e-mail, telefone e CPF do cônjuge; os logs do servidor e a trilha de auditoria filtram chaves com CPF, telefone, e-mail de comprador e segredos.

## 3. Com quem os dados são compartilhados

| Terceiro | O que recebe | Observação |
|---|---|---|
| DocuSign | Nome, e-mail, telefone (WhatsApp), nome do empreendimento, bloco e unidade, assunto e mensagem do envelope | O documento assinado é registro contratual e segue a retenção da conta DocuSign da Calper. A anonimização no portal **não apaga o envelope no DocuSign**. ⚠ Definir a política de retenção lá. |
| Vercel | IP e requisições do app (logs de plataforma); nenhum dado de comprador na URL | Confirmar região e contrato (DPA). |
| Supabase | Banco, autenticação e logs das Edge Functions | Confirmar região do projeto e contrato (DPA). Projeto compartilhado com outros sistemas Calper. |
| TOTVS RM | Só credenciais de serviço; o RM é fonte, não destino | — |

⚠ Transferência internacional: DocuSign, Vercel e Supabase podem processar dados fora do Brasil. Confirmar cláusulas contratuais no jurídico (LGPD arts. 33 a 36).

## 4. Direitos do titular (LGPD art. 18) — como atender

Tela: **Administração › Privacidade** (Admin e Super Admin). Todas as ações geram trilha em `wa_auditoria` **sem gravar o CPF, e-mail ou telefone consultado**.

| Pedido | Como atender | Quem |
|---|---|---|
| Confirmar que há tratamento / acesso | Painel "Direitos do titular": informar CPF, e-mail ou telefone e consultar. A tela lista em quais campanhas a pessoa aparece (data, status, empreendimento, papel). Gerar o relatório de acesso a partir disso | Admin |
| Corrigir dados | Dados vêm do RM: corrigir na origem e refazer a campanha se necessário | Operador |
| Eliminar / anonimizar | Painel "Direitos do titular" → "Anonimizar este titular" (todas as campanhas, inclusive como cônjuge). Marcar "registrar também em descadastro" para a pessoa não voltar a receber envios | Super Admin, com verificação em duas etapas |
| Não receber mais envios (oposição/revogação) | Painel "Lista de descadastro". Campanhas novas já marcam o comprador como "opt-out" e não enviam | Admin |
| Informação sobre compartilhamento | Seção 3 deste documento | DPO |
| Portabilidade | Exportação CSV completa de uma campanha (Relatórios, só Admin, auditada), filtrando a pessoa | Admin |

Prazo para resposta completa: **15 dias** (LGPD art. 19, II). Registrar cada pedido (data, quem pediu, o que foi feito) no controle do DPO.

**Limites da anonimização:** o envelope já assinado no DocuSign e documentos de contrato mantidos por obrigação legal ou para defesa em processo (art. 16) **não** são apagados pelo portal.

## 5. Retenção automática

Todo dia às 03:15 UTC o `pg_cron` executa `wa_retencao_executar()`:

| Dado | Regra |
|---|---|
| Destinatários de campanhas encerradas (`concluida`, `erro`, `cancelada`) | Anonimizados após **12 meses** do último movimento da campanha (⚠ ajustável) |
| Destinatários de campanhas que nunca encerraram | Anonimizados após **18 meses** da criação |
| `docusign_envelopes.raw` | Apagado após 12 meses |
| `wa_auditoria` | Apagada após 2 anos |
| `auth_login_log` | Apagado após 180 dias |
| `gateway_call_log` | Apagado após 30 dias |

Anonimizar = apagar nome, CPF, telefone, e-mail, bloco, unidade, dados extras e mensagens de erro, e o JSON bruto do DocuSign. Ficam o status, as datas e o empreendimento, para estatística.

Os prazos de 12 e 18 meses ficam em `wa_retencao_config` e podem ser mudados na tela Privacidade (Super Admin, com MFA) sem alterar código. ⚠ O jurídico deve confirmar se o contrato exige guardar por mais tempo.

Conferir que o agendamento está ativo: `select jobname, schedule, active from cron.job where jobname = 'wa_retencao_diaria';`. Rodar à mão: `select * from public.wa_retencao_executar();`.

## 6. Segurança do tratamento (resumo)

Detalhes e evidências em `docs/plano-correcao-seguranca.md`.

- Acesso só por contas cadastradas, sem auto-cadastro, bloqueio por tentativas de login (5 por conta e 20 por IP em 15 minutos), senha mínima de 12 caracteres, verificação em duas etapas obrigatória para Super Admin em ações sensíveis.
- Dados de compradores só por funções de servidor que conferem perfil e dono da campanha; o navegador não grava nas tabelas de campanha e **não lê** as colunas CPF, telefone, e-mail e dados extras (permissão por coluna no banco). O relatório mostra telefone e e-mail mascarados; "Mostrar contatos" busca os valores no servidor e fica registrado na auditoria.
- Descadastro (opt-out) honrado na criação da campanha e de novo no momento do envio de cada destinatário.
- Credenciais de integração fora da API pública do banco e, quando o Vault estiver ativo, criptografadas em repouso.
- Cabeçalhos de segurança (HSTS, CSP, anti-clickjacking) e HTTPS obrigatório.
- Exportação de relatório mascara o CPF por padrão; o CSV completo é restrito e auditado.

## 7. Backup e restauração

⚠ **Confirmar no painel do Supabase e registrar aqui:** plano contratado, frequência do backup diário, janela de retenção e se o PITR (recuperação a qualquer ponto no tempo) está ligado. Sem PITR, a perda máxima é de até 24 horas.

Procedimento de teste de restauração (fazer **a cada trimestre** e depois de mudanças grandes de schema):

1. Restaurar o backup mais recente em um **projeto novo** (nunca sobre a produção).
2. Conferir contagem de linhas de `wa_campanhas`, `wa_campanha_destinatarios`, `wa_auditoria`, `wa_project_users` e `user_roles`.
3. Conferir que as funções (`wa_conta_liberada`, `auth_pre_login`, `wa_retencao_executar`) e as policies existem.
4. Registrar data, quem fez, tempo gasto e problemas. Apagar o projeto de teste.

**Após qualquer restauração em produção (obrigatório por LGPD):** o backup pode trazer de volta dados já eliminados.

1. Rodar `select * from public.wa_retencao_executar();` para reaplicar a retenção.
2. Reaplicar as anonimizações de titulares feitas depois da data do backup: consultar `wa_auditoria` por `acao = 'titular_anonimizado'` e `'campanha_anonimizada'` com `created_at` posterior e repetir o procedimento. Por isso a opção "registrar também em descadastro" deve ficar marcada: o identificador vai para `wa_opt_outs`, que serve de lista de supressão.
3. Reaplicar a lista de descadastro posterior ao backup, se perdida.

Os segredos de integração (chave RSA, senha do RM) também voltam do backup; se houver suspeita de exposição do backup, **rotacionar** todos (seção 8).

## 8. Resposta a incidentes de segurança

**Incidente** = acesso não autorizado, vazamento, perda ou alteração indevida de dados pessoais, ou suspeita razoável disso.

### Primeiras horas

1. **Registrar**: quem detectou, quando, o que viu. Abrir registro do incidente com data e hora.
2. **Conter**:
   - Conta suspeita: desativar em Administração › Usuários e gerar nova senha (derruba as sessões).
   - Chave vazada: rotacionar — service role do Supabase (Settings › API), chave RSA e integration key do DocuSign, senha do RM, secrets `GW_*` das Edge Functions, `APP_URL`/`ALLOWED_ORIGINS` se alterados.
   - Sessões: Authentication › Users no Supabase para encerrar sessões (lembrar que a conta é compartilhada com outros sistemas Calper).
   - Preservar evidências: exportar `wa_auditoria`, `auth_login_log` e os logs da Vercel e do Supabase **antes** de qualquer limpeza (a retenção apaga logs antigos).
3. **Avisar** o DPO e o jurídico imediatamente.

### Avaliação

Responder: quais dados (CPF, contato, contrato)? Quantos titulares? Qual período? Houve uso indevido? Os dados estavam protegidos de forma que os torne ininteligíveis? Fontes: `wa_auditoria` (quem fez o quê, IP), `auth_login_log`, logs de Edge Functions, relatório de exportação (`relatorio_exportado`, `contatos_revelados`).

### Comunicação

Se o incidente puder acarretar risco ou dano relevante aos titulares (LGPD art. 48), o controlador comunica **a ANPD e os titulares**. ⚠ O prazo regulamentado hoje é de **3 dias úteis** a partir do conhecimento do incidente (Resolução CD/ANPD nº 15/2024); o jurídico confirma o enquadramento e conduz a comunicação. A comunicação deve trazer: natureza dos dados, titulares envolvidos, medidas técnicas adotadas, riscos, motivos de eventual atraso e medidas de mitigação.

### Depois

Corrigir a causa, rotacionar o que for preciso, atualizar `docs/plano-correcao-seguranca.md` e este documento, e registrar as lições aprendidas.

## 9. Texto de privacidade para os compradores (minuta ⚠)

> A Construtora Calper trata seus dados pessoais (nome, CPF, telefone, e-mail e dados do imóvel contratado) para enviar e acompanhar a assinatura eletrônica dos documentos do seu contrato, com base na execução do contrato (LGPD, art. 7º, V). Os dados são compartilhados com a DocuSign, plataforma de assinatura eletrônica, e armazenados em provedores de nuvem contratados pela Calper. Mantemos os dados identificáveis das campanhas de envio por 12 meses após o encerramento; depois disso são anonimizados. Você pode pedir acesso, correção, anonimização ou eliminação dos seus dados e se opor a novos envios pelo e-mail ⚠ _canal do Encarregado_.

O jurídico deve revisar e publicar o texto no canal adequado (site da Calper, contrato ou cláusula de privacidade).

## 10. Registro das operações de tratamento (resumo)

| Operação | Finalidade | Dados | Base legal ⚠ | Retenção |
|---|---|---|---|---|
| Importar compradores do RM ou planilha | Montar a campanha | Nome, CPF, contato, imóvel | Art. 7º, V | Até anonimização (12 meses) |
| Enviar envelope DocuSign | Colher assinatura | Nome, e-mail, telefone, imóvel | Art. 7º, V | Conforme DocuSign |
| Acompanhar status | Relatório | Status, datas | Art. 7º, V | Até anonimização |
| Exportar relatório | Gestão e suporte | CPF (mascarado), contatos | Art. 7º, IX | O arquivo é responsabilidade de quem exporta |
| Lista de descadastro | Honrar oposição | CPF, e-mail ou telefone | Art. 7º, II (obrigação legal) | Enquanto valer |
| Auditoria e login | Segurança | Funcionário, IP, navegador | Art. 7º, IX | 2 anos / 180 dias |

## 11. Pendências para o jurídico e o DPO

1. Nomear o Encarregado e publicar o canal de contato.
2. Confirmar a base legal e os prazos de retenção (12 e 18 meses, 2 anos, 180 dias).
3. Confirmar contratos (DPA) e transferência internacional com DocuSign, Vercel e Supabase.
4. Definir retenção dos envelopes dentro do DocuSign.
5. Revisar e publicar o texto de privacidade da seção 9.
6. Confirmar o plano de backup do Supabase e registrar o primeiro teste de restauração.
7. Treinar os operadores: o que exportar, o CSV completo e o dever de apagar arquivos exportados.
