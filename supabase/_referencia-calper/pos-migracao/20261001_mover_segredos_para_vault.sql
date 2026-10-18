-- =====================================================================
-- Move os segredos de integração para o Supabase Vault e limpa o texto claro (auditoria, Fase 4 / M3).
--
--   Segredos movidos (nome no Vault ← origem em texto claro):
--     docusign_rsa_private_key ← public.docusign_config.rsa_private_key   (linha mais recente)
--     docusign_webhook_secret  ← public.docusign_config.webhook_secret    (linha mais recente)
--     rm_senha                 ← envio_privado.integracao_rm.senha        (id = 1)
--
-- NÃO roda sozinho. Execute no SQL Editor (como postgres), nesta ordem:
--   1. aplicar a migração supabase/migrations/20261001170000_vault_segredos.sql;
--   2. publicar o app (Vercel) com o código que lê os segredos do Vault;
--   3. rodar ESTE script;
--   4. testar: Configurações → Integração DocuSign → "Testar conexão"; Configurações → Integrações
--      TOTVS RM → "Testar conexão" (empreendimentos e compradores). Conferir também que a tela mostra
--      a chave RSA, o webhook secret e a senha do RM como "configurados".
--
-- Para cada segredo: grava no Vault, LÊ DE VOLTA e compara com o original (is not distinct from); só
-- se for idêntico zera a coluna de texto claro (rsa_private_key / webhook_secret = null, senha = '').
-- Se qualquer passo falhar, aquele segredo NÃO é zerado e sai um WARNING (a gravação no Vault daquele
-- segredo é desfeita). Os valores dos segredos nunca aparecem nas mensagens.
--
-- Idempotente: se a coluna já está vazia, o segredo é considerado movido e nada é feito. Se alguém
-- salvou um valor novo na coluna (Vault indisponível na hora de salvar), rodar de novo o move para o
-- Vault.
--
-- ROLLBACK (se algum teste falhar):
--   · O jeito normal: reinformar o segredo na tela de Configurações e salvar. A tela regrava no Vault
--     (ou, se o Vault estiver indisponível, na coluna, como antes) e o app volta a funcionar.
--   · Voltar tudo para texto claro (o app também funciona assim: a coluna tem prioridade sobre o Vault):
--       update public.docusign_config
--          set rsa_private_key = coalesce(public.wa_segredo_ler('docusign_rsa_private_key'), rsa_private_key),
--              webhook_secret  = coalesce(public.wa_segredo_ler('docusign_webhook_secret'), webhook_secret)
--        where id = (select id from public.docusign_config order by updated_at desc limit 1);
--       update envio_privado.integracao_rm
--          set senha = coalesce(public.wa_segredo_ler('rm_senha'), senha)
--        where id = 1;
--   · Atenção: depois de limpar as colunas, NÃO rode de novo a migração antiga
--     20260929120000_rm_credenciais_privado.sql: ela recria rm_credenciais sem ler o Vault e a senha
--     do RM "sumiria" para o app. Se isso acontecer, rode a 20261001170000_vault_segredos.sql de novo.
-- =====================================================================

-- ---------------------------------------------------------------------
-- (a) Pré-checagens. Se algo estiver faltando, aborta SEM alterar nada.
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_catalog.pg_extension where extname = 'supabase_vault') then
    raise exception 'Vault inativo (extensao supabase_vault). Habilite em Database > Extensions e rode a migracao 20261001170000_vault_segredos.sql. Nada foi alterado.';
  end if;

  if to_regprocedure('public.wa_segredo_gravar(text,text,text)') is null
     or to_regprocedure('public.wa_segredo_ler(text)') is null
     or to_regprocedure('public.wa_segredo_existe(text)') is null then
    raise exception 'Funcoes wa_segredo_* nao encontradas. Rode a migracao 20261001170000_vault_segredos.sql. Nada foi alterado.';
  end if;

  -- rm_credenciais precisa ser a versão nova (que lê o Vault); senão zerar a senha derrubaria o RM
  if to_regprocedure('public.rm_credenciais(text)') is null
     or position('wa_segredo_ler' in pg_get_functiondef(to_regprocedure('public.rm_credenciais(text)'))) = 0 then
    raise exception 'rm_credenciais nao le o Vault (migracao 20261001170000_vault_segredos.sql nao aplicada ou sobrescrita). Nada foi alterado.';
  end if;

  raise notice 'Pre-checagem OK: Vault ativo, funcoes wa_segredo_* presentes e rm_credenciais le o Vault.';
  raise notice 'Ja no Vault antes deste script: docusign_rsa_private_key=%, docusign_webhook_secret=%, rm_senha=%',
    public.wa_segredo_existe('docusign_rsa_private_key'),
    public.wa_segredo_existe('docusign_webhook_secret'),
    public.wa_segredo_existe('rm_senha');
end
$$;

-- ---------------------------------------------------------------------
-- (b1) DocuSign: chave RSA privada e webhook secret (linha mais recente de docusign_config,
--      a mesma que o app usa)
-- ---------------------------------------------------------------------
do $$
declare
  v_id     uuid;
  v_valor  text;
  v_outras int;
begin
  if to_regclass('public.docusign_config') is null then
    raise notice '[DocuSign] tabela public.docusign_config nao existe; nada a mover.';
    return;
  end if;

  select id into v_id from public.docusign_config order by updated_at desc limit 1;
  if v_id is null then
    raise notice '[DocuSign] nenhuma configuracao salva; nada a mover.';
    return;
  end if;

  select count(*) into v_outras
    from public.docusign_config
   where id <> v_id
     and (nullif(rsa_private_key, '') is not null or nullif(webhook_secret, '') is not null);
  if v_outras > 0 then
    raise warning '[DocuSign] % linha(s) antiga(s) de docusign_config ainda tem segredo em texto claro; o app usa so a mais recente. Revise e apague essas linhas manualmente.', v_outras;
  end if;

  -- o app nunca persiste o access token (fica só em memória); limpa qualquer resquício
  update public.docusign_config
     set access_token_cache = null, access_token_expira_em = null
   where id = v_id and (access_token_cache is not null or access_token_expira_em is not null);

  -- chave RSA privada
  select rsa_private_key into v_valor from public.docusign_config where id = v_id;
  if nullif(v_valor, '') is null then
    raise notice '[DocuSign] chave RSA: sem texto claro na tabela (ja movida ou nunca configurada). No Vault: %',
      public.wa_segredo_existe('docusign_rsa_private_key');
  else
    begin
      perform public.wa_segredo_gravar('docusign_rsa_private_key', v_valor, 'Chave RSA privada do DocuSign (JWT)');
      if public.wa_segredo_ler('docusign_rsa_private_key') is not distinct from v_valor then
        update public.docusign_config set rsa_private_key = null where id = v_id;
        raise notice '[DocuSign] chave RSA: movida para o Vault e removida da tabela.';
      else
        raise exception 'verificacao_falhou';
      end if;
    exception when others then
      raise warning '[DocuSign] chave RSA: NAO movida; o texto claro foi mantido na tabela (SQLSTATE %).', sqlstate;
    end;
  end if;

  -- webhook secret
  select webhook_secret into v_valor from public.docusign_config where id = v_id;
  if nullif(v_valor, '') is null then
    raise notice '[DocuSign] webhook secret: sem texto claro na tabela (ja movido ou nunca configurado). No Vault: %',
      public.wa_segredo_existe('docusign_webhook_secret');
  else
    begin
      perform public.wa_segredo_gravar('docusign_webhook_secret', v_valor, 'Webhook secret do DocuSign');
      if public.wa_segredo_ler('docusign_webhook_secret') is not distinct from v_valor then
        update public.docusign_config set webhook_secret = null where id = v_id;
        raise notice '[DocuSign] webhook secret: movido para o Vault e removido da tabela.';
      else
        raise exception 'verificacao_falhou';
      end if;
    exception when others then
      raise warning '[DocuSign] webhook secret: NAO movido; o texto claro foi mantido na tabela (SQLSTATE %).', sqlstate;
    end;
  end if;
end
$$;

-- ---------------------------------------------------------------------
-- (b2) TOTVS RM: senha do usuário (envio_privado.integracao_rm, id = 1)
-- ---------------------------------------------------------------------
do $$
declare
  v_valor text;
begin
  if to_regclass('envio_privado.integracao_rm') is null then
    raise notice '[RM] tabela envio_privado.integracao_rm nao existe; nada a mover.';
    return;
  end if;

  -- mesma garantia da pré-checagem, caso o script seja rodado por um cliente que continua após erro
  if position('wa_segredo_ler' in coalesce(pg_get_functiondef(to_regprocedure('public.rm_credenciais(text)')), '')) = 0 then
    raise warning '[RM] rm_credenciais nao le o Vault; senha NAO movida.';
    return;
  end if;

  select senha into v_valor from envio_privado.integracao_rm where id = 1;
  if not found then
    raise notice '[RM] envio_privado.integracao_rm sem a linha id = 1; nada a mover.';
    return;
  end if;

  if nullif(v_valor, '') is null then
    raise notice '[RM] senha: sem texto claro na tabela (ja movida ou nunca configurada). No Vault: %',
      public.wa_segredo_existe('rm_senha');
    return;
  end if;

  begin
    perform public.wa_segredo_gravar('rm_senha', v_valor, 'Senha do usuário do TOTVS RM (Disparo em Massa)');
    if public.wa_segredo_ler('rm_senha') is not distinct from v_valor then
      update envio_privado.integracao_rm set senha = '' where id = 1;
      raise notice '[RM] senha: movida para o Vault e removida da tabela.';
    else
      raise exception 'verificacao_falhou';
    end if;
  exception when others then
    raise warning '[RM] senha: NAO movida; o texto claro foi mantido na tabela (SQLSTATE %).', sqlstate;
  end;
end
$$;

-- ---------------------------------------------------------------------
-- (c) Resultado (só booleanos, nunca valores). Esperado depois de tudo certo:
--     no_vault = true e texto_claro_na_tabela = false nas três linhas
--     (webhook_secret só aparece como true se algum dia foi configurado).
-- ---------------------------------------------------------------------
select 'docusign_rsa_private_key' as segredo,
       public.wa_segredo_existe('docusign_rsa_private_key') as no_vault,
       coalesce((select nullif(rsa_private_key, '') is not null
                   from public.docusign_config order by updated_at desc limit 1), false) as texto_claro_na_tabela
union all
select 'docusign_webhook_secret',
       public.wa_segredo_existe('docusign_webhook_secret'),
       coalesce((select nullif(webhook_secret, '') is not null
                   from public.docusign_config order by updated_at desc limit 1), false)
union all
select 'rm_senha',
       public.wa_segredo_existe('rm_senha'),
       coalesce((select senha <> '' from envio_privado.integracao_rm where id = 1), false);
