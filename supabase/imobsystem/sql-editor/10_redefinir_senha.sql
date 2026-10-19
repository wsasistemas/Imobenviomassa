-- Rodar no SQL Editor do projeto ikvjaowvpvxojvcfwnct. Pode rodar de novo.
-- Conteúdo idêntico a migrations/20261019140000_imobenviomassa_05_redefinir_senha.sql.
begin;

-- =====================================================================================================
-- Imobenviomassa — 05: "Esqueceu a senha?" (19/10/2026)
-- O link de redefinição é gerado e enviado pelo próprio app (provedor de e-mail da imobiliária, ex.: Resend),
-- e não pelo e-mail de recuperação do Supabase: no ikvj compartilhado, o link padrão cai no Site URL de outro
-- sistema quando o endereço não está na allowlist (Cerebro: supabase-recuperar-senha-cai-no-site-url-de-outro-sistema).
-- Só ADITIVA: tabela nova, acessada apenas pelo servidor (service_role). Guarda o hash do token, nunca o token.
-- =====================================================================================================
create table if not exists imobenviomassa.senha_redefinicao (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade,  -- nulo quando o e-mail não tem conta (só conta no limite)
  email       text not null,
  token_hash  text unique,                                        -- sha-256 do token enviado por e-mail
  ip          text,
  criado_em   timestamptz not null default now(),
  expira_em   timestamptz,
  usado_em    timestamptz
);
create index if not exists senha_redefinicao_email_idx on imobenviomassa.senha_redefinicao (email, criado_em desc);
create index if not exists senha_redefinicao_ip_idx on imobenviomassa.senha_redefinicao (ip, criado_em desc);

alter table imobenviomassa.senha_redefinicao enable row level security;
revoke all on imobenviomassa.senha_redefinicao from public, anon, authenticated;
grant all on imobenviomassa.senha_redefinicao to service_role;

notify pgrst, 'reload schema';

commit;
