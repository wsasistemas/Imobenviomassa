-- Rodar no SQL Editor do projeto ikvjaowvpvxojvcfwnct. Pode rodar de novo.
-- 19/10/2026 — o login do Imobenviomassa parou ("Não foi possível validar o acesso"): a Data API respondia
-- 406 PGRST106 "Invalid schema: imobenviomassa". A lista de schemas expostos foi regravada (ajuste do
-- imobdocerias) sem o imobenviomassa. Este script só ACRESCENTA o schema; não tira nenhum dos outros sistemas.
-- Cerebro: supabase-pgrst-db-schemas-no-banco-anula-painel.

-- 1) Diagnóstico: o que está gravado hoje no papel authenticator (se houver, é essa lista que vale).
select c as configuracao_atual
from pg_roles r, unnest(r.rolconfig) c
where r.rolname = 'authenticator' and c like 'pgrst.%';

-- 2) Acrescenta imobenviomassa à lista gravada (mantendo todos os que já estão lá).
do $$
declare
  v_atual text;
begin
  select split_part(c, '=', 2) into v_atual
  from pg_roles r, unnest(r.rolconfig) c
  where r.rolname = 'authenticator' and c like 'pgrst.db_schemas=%';

  if v_atual is null then
    raise notice 'Não há pgrst.db_schemas gravado no banco: a lista vem do painel. Marque imobenviomassa em Integrations › Data API › Exposed schemas.';
  elsif 'imobenviomassa' = any (string_to_array(replace(v_atual, ' ', ''), ',')) then
    raise notice 'imobenviomassa já está na lista: %', v_atual;
  else
    execute format('alter role authenticator set pgrst.db_schemas = %L', v_atual || ', imobenviomassa');
    raise notice 'Lista nova: %', v_atual || ', imobenviomassa';
  end if;
end $$;

-- 3) Recarrega a configuração e o cache de tabelas da API.
notify pgrst, 'reload config';
notify pgrst, 'reload schema';
