-- =====================================================================
-- Auditoria de segurança (2026-10-01) — Fase 4 / M3: segredos de integração no Supabase Vault
--
--   Hoje a chave RSA privada e o webhook secret do DocuSign ficam em texto claro em
--   public.docusign_config, e a senha do TOTVS RM em envio_privado.integracao_rm.senha. Só a
--   service_role lê essas colunas, mas um dump/backup lógico do banco as expõe. O Supabase Vault
--   (extensão supabase_vault, schema vault) guarda o valor criptografado em repouso, com a chave de
--   criptografia fora do banco.
--
--   Esta migração é ADITIVA e COMPATÍVEL: só cria funções e recria as funções do RM. Não apaga nem
--   zera nada. O app funciona nos três estados:
--     1. migração não aplicada            → segredos nas colunas (como hoje);
--     2. migração aplicada, Vault inativo → idem (wa_segredo_gravar acusa 'vault_indisponivel' e o
--                                           app grava na coluna);
--     3. migração aplicada, Vault ativo   → segredos NOVOS vão para o Vault; os antigos continuam
--                                           nas colunas até o script de pós-migração movê-los.
--   A cópia dos segredos atuais para o Vault e a limpeza das colunas ficam em
--   supabase/pos-migracao/20261001_mover_segredos_para_vault.sql (o operador roda à mão, DEPOIS de
--   publicar o app e testar).
--
--   Funções criadas (SECURITY DEFINER, search_path vazio, só a service_role executa). Os nomes de
--   segredo aceitos são ^(rm|docusign)_[a-z0-9_]{1,60}$:
--     · wa_segredo_gravar(nome, valor, descricao) → uuid    cria ou atualiza o secret;
--     · wa_segredo_ler(nome)                      → text    valor decifrado (null se não existir);
--     · wa_segredo_existe(nome)                   → boolean.
--   Elas verificam o Vault em tempo de execução: sem a extensão, ler devolve null, existe devolve
--   false e gravar lança 'vault_indisponivel'. Assim as demais funções sempre compilam, e basta
--   habilitar o Vault depois (Database → Extensions → supabase_vault) para o estado 3 passar a valer,
--   sem rodar esta migração de novo.
--
--   RM: rm_credenciais, rm_credenciais_salvar e rm_status mantêm a MESMA assinatura/retorno (as Edge
--   Functions api-proxy e totvs-soap-proxy chamam rm_credenciais sem mudança). A senha vem da coluna
--   quando ela ainda tem valor (fallback, e é sempre a gravação mais recente: o salvar zera a coluna
--   ao ir para o Vault) e, estando a coluna vazia, do Vault (secret rm_senha).
--
-- Idempotente: pode ser rodado de novo.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Habilita o Vault, se possível (não falha a migração se não der)
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_catalog.pg_extension where extname = 'supabase_vault') then
    begin
      create extension if not exists supabase_vault with schema vault;
    exception when others then
      raise notice 'Supabase Vault nao pode ser habilitado automaticamente (SQLSTATE %). Habilite em Database > Extensions > supabase_vault. Ate la os segredos continuam em texto claro e o app funciona normalmente.', sqlstate;
    end;
  end if;
end
$$;

-- ---------------------------------------------------------------------
-- 2. Funções de acesso aos segredos (só service_role)
-- ---------------------------------------------------------------------

-- Cria ou atualiza o secret `p_nome`. Lança 'vault_indisponivel' se a extensão não estiver ativa.
create or replace function public.wa_segredo_gravar(
  p_nome      text,
  p_valor     text,
  p_descricao text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_nome is null or p_nome !~ '^(rm|docusign)_[a-z0-9_]{1,60}$' then
    raise exception 'segredo_nome_invalido' using errcode = '22023';
  end if;
  if p_valor is null or p_valor = '' then
    raise exception 'segredo_valor_vazio' using errcode = '22023';
  end if;
  if not exists (select 1 from pg_catalog.pg_extension where extname = 'supabase_vault') then
    raise exception 'vault_indisponivel';
  end if;

  -- SQL dinâmico: as referências a vault.* só são resolvidas na execução.
  execute 'select id from vault.secrets where name = $1' into v_id using p_nome;

  if v_id is null then
    execute 'select vault.create_secret($1, $2, $3)' into v_id using p_valor, p_nome, coalesce(p_descricao, '');
  else
    execute 'select vault.update_secret($1, $2, $3, $4)' using v_id, p_valor, p_nome, coalesce(p_descricao, '');
  end if;

  return v_id;
end
$$;

-- Valor decifrado do secret `p_nome`; null se não existir (ou se o Vault não estiver ativo).
create or replace function public.wa_segredo_ler(p_nome text)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_valor text;
begin
  if p_nome is null or p_nome !~ '^(rm|docusign)_[a-z0-9_]{1,60}$' then
    raise exception 'segredo_nome_invalido' using errcode = '22023';
  end if;
  if not exists (select 1 from pg_catalog.pg_extension where extname = 'supabase_vault') then
    return null;
  end if;

  execute 'select decrypted_secret from vault.decrypted_secrets where name = $1' into v_valor using p_nome;
  return v_valor;
end
$$;

-- O secret `p_nome` existe? (false se o Vault não estiver ativo). Não decifra nada.
create or replace function public.wa_segredo_existe(p_nome text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_existe boolean;
begin
  if p_nome is null or p_nome !~ '^(rm|docusign)_[a-z0-9_]{1,60}$' then
    raise exception 'segredo_nome_invalido' using errcode = '22023';
  end if;
  if not exists (select 1 from pg_catalog.pg_extension where extname = 'supabase_vault') then
    return false;
  end if;

  execute 'select exists (select 1 from vault.secrets where name = $1)' into v_existe using p_nome;
  return coalesce(v_existe, false);
end
$$;

revoke all on function public.wa_segredo_gravar(text, text, text) from public, anon, authenticated;
revoke all on function public.wa_segredo_ler(text) from public, anon, authenticated;
revoke all on function public.wa_segredo_existe(text) from public, anon, authenticated;
grant execute on function public.wa_segredo_gravar(text, text, text) to service_role;
grant execute on function public.wa_segredo_ler(text) to service_role;
grant execute on function public.wa_segredo_existe(text) to service_role;

-- ---------------------------------------------------------------------
-- 3. RM: mesmas assinaturas de 20260929120000_rm_credenciais_privado.sql; só muda de onde vem a senha
-- ---------------------------------------------------------------------

-- Credenciais de uma integração, com a senha. Usada pelo servidor do app e pelas Edge Functions.
-- Senha: a coluna, se ainda tiver valor (fallback / gravação mais recente); senão o secret rm_senha do Vault.
create or replace function public.rm_credenciais(p_recurso text default 'empreendimentos')
returns table (endpoint text, usuario text, senha text)
language sql
stable
security definer
set search_path = ''
as $$
  select r.endpoint,
         i.usuario,
         coalesce(nullif(i.senha, ''), public.wa_segredo_ler('rm_senha'), '')
  from envio_privado.integracao_rm i
  join envio_privado.integracao_rm_recurso r on r.recurso = coalesce(p_recurso, 'empreendimentos')
  where i.id = 1
$$;

-- Grava usuário/senha (comuns) e o endpoint da integração informada. Usuário ou senha em branco
-- mantêm os atuais. Senha nova: vai para o Vault (e a coluna fica '') quando o Vault está ativo; sem
-- Vault, fica na coluna, como antes.
create or replace function public.rm_credenciais_salvar(
  p_endpoint text,
  p_usuario  text,
  p_senha    text,
  p_autor    text,
  p_recurso  text default 'empreendimentos'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recurso  text := coalesce(nullif(btrim(p_recurso), ''), 'empreendimentos');
  v_senha    text := coalesce(p_senha, '');
  v_no_vault boolean := false;
begin
  if v_recurso not in ('empreendimentos', 'compradores') then
    raise exception 'Integração desconhecida: %', v_recurso using errcode = '22023';
  end if;

  if v_senha <> '' then
    begin
      perform public.wa_segredo_gravar('rm_senha', v_senha, 'Senha do usuário do TOTVS RM (Disparo em Massa)');
      v_no_vault := true;
    exception when others then
      -- Vault indisponível (ou falha ao gravar): mantém o modelo anterior, senha na coluna.
      v_no_vault := false;
      raise warning 'rm_credenciais_salvar: Vault indisponivel; senha mantida na coluna (SQLSTATE %)', sqlstate;
    end;
  end if;

  insert into envio_privado.integracao_rm (id, usuario, senha, atualizado_em, atualizado_por)
  values (1, btrim(coalesce(p_usuario, '')), case when v_no_vault then '' else v_senha end, now(), coalesce(p_autor, ''))
  on conflict (id) do update
    set usuario        = case when excluded.usuario = '' then envio_privado.integracao_rm.usuario else excluded.usuario end,
        -- senha em branco mantém a atual (coluna e Vault); senha nova substitui a coluna ('' se foi para o Vault)
        senha          = case when v_senha = '' then envio_privado.integracao_rm.senha else excluded.senha end,
        atualizado_em  = now(),
        atualizado_por = excluded.atualizado_por;

  insert into envio_privado.integracao_rm_recurso (recurso, endpoint, atualizado_em, atualizado_por)
  values (v_recurso, btrim(coalesce(p_endpoint, '')), now(), coalesce(p_autor, ''))
  on conflict (recurso) do update
    set endpoint       = excluded.endpoint,
        atualizado_em  = now(),
        atualizado_por = excluded.atualizado_por;
end
$$;

-- Situação das integrações, SEM a senha (tela de Configurações → Integrações TOTVS RM).
-- "Configurado" considera a senha na coluna OU no Vault.
create or replace function public.rm_status()
returns table (
  recurso         text,
  configurado     boolean,
  endpoint        text,
  usuario         text,
  atualizado_em   timestamptz,
  atualizado_por  text,
  ultima_consulta timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.recurso,
         (r.endpoint <> '' and i.usuario <> '' and (i.senha <> '' or public.wa_segredo_existe('rm_senha'))),
         r.endpoint,
         i.usuario,
         greatest(r.atualizado_em, i.atualizado_em),
         case when r.atualizado_em >= i.atualizado_em then r.atualizado_por else i.atualizado_por end,
         r.ultima_consulta
  from envio_privado.integracao_rm_recurso r
  cross join envio_privado.integracao_rm i
  where i.id = 1
  order by r.recurso desc
$$;

revoke all on function public.rm_credenciais(text) from public, anon, authenticated;
revoke all on function public.rm_credenciais_salvar(text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.rm_status() from public, anon, authenticated;
grant execute on function public.rm_credenciais(text) to service_role;
grant execute on function public.rm_credenciais_salvar(text, text, text, text, text) to service_role;
grant execute on function public.rm_status() to service_role;

-- ---------------------------------------------------------------------
-- 4. Resumo
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_catalog.pg_extension where extname = 'supabase_vault') then
    raise notice 'Vault ativo: segredos novos (salvos pela tela) ja vao para o Vault. Para mover os atuais, rode supabase/pos-migracao/20261001_mover_segredos_para_vault.sql depois de publicar o app e testar.';
  else
    raise notice 'Vault INATIVO: nada muda; os segredos continuam em texto claro e o app funciona normalmente. Habilite a extensao supabase_vault e rode esta migracao de novo.';
  end if;
end
$$;
