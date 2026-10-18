-- Rodar no SQL Editor do projeto ikvjaowvpvxojvcfwnct DEPOIS do 1_criar_schema.sql.
-- Esperado: todas as linhas com ok = true.

select 'schema existe' as teste,
       exists (select 1 from pg_namespace where nspname = 'imobenviomassa') as ok
union all
select 'exposto na API (pgrst.db_schemas)',
       exists (
         select 1 from pg_roles r, unnest(r.rolconfig) c
         where r.rolname = 'authenticator'
           and c like 'pgrst.db_schemas=%'
           and 'imobenviomassa' = any (string_to_array(replace(split_part(c, '=', 2), ' ', ''), ','))
       )
union all
select 'anon sem acesso ao schema',
       not has_schema_privilege('anon', 'imobenviomassa', 'USAGE')
union all
select 'authenticated com acesso ao schema',
       has_schema_privilege('authenticated', 'imobenviomassa', 'USAGE')
union all
select 'service_role com acesso ao schema',
       has_schema_privilege('service_role', 'imobenviomassa', 'USAGE');

-- Lista completa que a API usa (confira se os schemas dos outros sistemas continuam lá):
select split_part(c, '=', 2) as schemas_expostos
from pg_roles r, unnest(r.rolconfig) c
where r.rolname = 'authenticator' and c like 'pgrst.db_schemas=%';
