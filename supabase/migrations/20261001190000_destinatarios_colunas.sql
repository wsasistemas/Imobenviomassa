-- =====================================================================
-- Auditoria de segurança (2026-10-01) — Fase 4 / LGPD: o navegador deixa de ler CPF, telefone,
-- e-mail e dados_extras dos compradores.
--
-- Até aqui a policy de RLS de wa_campanha_destinatarios só decidia QUAIS LINHAS o usuário lê (as das
-- campanhas dele, ou todas para admin); todas as colunas vinham junto. Mascarar telefone e e-mail na
-- tela de relatório não protegia nada: a resposta da Data API já trazia tudo. Agora o GRANT é por
-- coluna: o navegador (authenticated) só lê as colunas de estado/acompanhamento. CPF, telefone, e-mail
-- e dados_extras (dados do cônjuge) só passam pelo servidor (service_role), nas server functions de
-- src/lib/relatorios.functions.ts, que mascaram por padrão e auditam a revelação.
--
-- Consequência: `select("*")` (ou qualquer select que cite cpf, telefone, email ou dados_extras) feito
-- pelo navegador nesta tabela passa a dar "permission denied for table wa_campanha_destinatarios".
-- As policies de RLS continuam valendo (linhas: campanha acessível + conta liberada).
--
-- Roda DEPOIS da 20261001160000 (que cria anonimizado_em). Idempotente: pode ser rodada de novo.
-- =====================================================================

-- Garantia caso esta migração seja aplicada isolada (a coluna vem da 20261001160000).
alter table public.wa_campanha_destinatarios add column if not exists anonimizado_em timestamptz;

revoke select on public.wa_campanha_destinatarios from authenticated, anon;

grant select (
  id,
  campanha_id,
  nome,
  empreendimento,
  bloco,
  unidade,
  status,
  erro_msg,
  envelope_docusign_id,
  enviado_em,
  assinado_em,
  created_at,
  updated_at,
  anonimizado_em
) on public.wa_campanha_destinatarios to authenticated;

-- O servidor (service_role) continua com acesso total.
grant all on public.wa_campanha_destinatarios to service_role;
