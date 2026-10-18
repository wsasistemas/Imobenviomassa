-- =====================================================================================================
-- Teste a seco da estrutura do imobenviomassa (rodar no SQL Editor DEPOIS do 3_aplicar_estrutura.sql).
--
-- É UM bloco só (do $$ … $$): o SQL Editor do Supabase executa cada comando separado, então temp table,
-- begin/rollback e funções pg_temp não sobrevivem entre comandos. Aqui tudo roda numa execução e o bloco
-- TERMINA COM ERRO DE PROPÓSITO — é isso que desfaz tudo (usuários, imobiliárias e campanhas fictícios).
--
-- Resultado esperado (aparece como "Error" no painel, é normal):
--   TESTE CONCLUÍDO — nada foi gravado. passaram: 35, falharam: 0
-- Se algo falhar, a mensagem lista cada teste com FALHOU.
-- =====================================================================================================
do $teste$
declare
  r text[] := '{}';
  v_ok boolean;
  v_txt text;
  i int;
  v_json jsonb;
  c_a  constant uuid := 'aaaaaaaa-0000-0000-0000-000000000000';
  c_b  constant uuid := 'bbbbbbbb-0000-0000-0000-000000000000';
  c_a1 constant uuid := 'a0000000-0000-0000-0000-0000000000a1';
  c_a2 constant uuid := 'a0000000-0000-0000-0000-0000000000a2';
  c_b1 constant uuid := 'b0000000-0000-0000-0000-0000000000b1';
  c_c1 constant uuid := 'c0000000-0000-0000-0000-0000000000c1';
begin
  -- ----- Cenário -----
  insert into auth.users (id, email) values
    (c_a1, 'teste.a1@imobenviomassa.test'),
    (c_a2, 'teste.a2@imobenviomassa.test'),
    (c_b1, 'teste.b1@imobenviomassa.test'),
    (c_c1, 'teste.semcadastro@imobenviomassa.test');

  insert into imobenviomassa.imobiliarias (id, nome) values
    (c_a, 'Imobiliária Teste A'),
    (c_b, 'Imobiliária Teste B');

  insert into imobenviomassa.usuarios (id, imobiliaria_id, email, nome, perfil) values
    (c_a1, c_a, 'TESTE.A1@imobenviomassa.test', 'A1', 'super_admin'),
    (c_a2, c_a, 'teste.a2@imobenviomassa.test', 'A2', 'analista'),
    (c_b1, c_b, 'teste.b1@imobenviomassa.test', 'B1', 'admin');

  insert into imobenviomassa.wa_campanhas (id, imobiliaria_id, nome, criado_por, origem) values
    ('ca000000-0000-0000-0000-0000000000a1', c_a, 'A por A1', c_a1, 'excel'),
    ('ca000000-0000-0000-0000-0000000000a2', c_a, 'A por A2', c_a2, 'excel'),
    ('cb000000-0000-0000-0000-0000000000b1', c_b, 'B por B1', c_b1, 'totvs');

  insert into imobenviomassa.wa_campanha_destinatarios (imobiliaria_id, campanha_id, nome, cpf, email, telefone) values
    (c_a, 'ca000000-0000-0000-0000-0000000000a2', 'Comprador A', '111.222.333-44', 'comprador@x.test', '5521999990000'),
    (c_b, 'cb000000-0000-0000-0000-0000000000b1', 'Comprador B', '111.222.333-44', 'comprador@x.test', '21999990000');

  -- ----- Estrutura -----
  v_ok := exists (select 1 from imobenviomassa.wa_retencao_config where imobiliaria_id = c_a)
      and (select count(*) from imobenviomassa.integracao_rm_recurso where imobiliaria_id = c_a) = 2;
  r := r || format('%s 01 provisionou retenção e RM da imobiliária A', case when v_ok then 'ok    ' else 'FALHOU' end);

  v_ok := (select count(*) from imobenviomassa.perfil_permissoes where imobiliaria_id = c_a and perfil = 'analista') = 6
      and (select count(*) from imobenviomassa.perfil_permissoes where imobiliaria_id = c_a and perfil = 'admin' and permission_id not like 'regua%') = 9;
  r := r || format('%s 02 regras iniciais: Analista com 6 liberações, Admin com 9 (fora as da régua)', case when v_ok then 'ok    ' else 'FALHOU' end);

  v_ok := (select email from imobenviomassa.usuarios where id = c_a1) = 'teste.a1@imobenviomassa.test';
  r := r || format('%s 03 e-mail gravado em minúsculas', case when v_ok then 'ok    ' else 'FALHOU' end);

  v_ok := exists (select 1 from acessos.aplicativos where schema_name = 'imobenviomassa');
  r := r || format('%s 04 app registrado na Central', case when v_ok then 'ok    ' else 'FALHOU' end);

  begin
    insert into imobenviomassa.usuarios (id, email, perfil) values (c_c1, 'x@x.test', 'analista');
    v_ok := false;
    raise exception using errcode = 'P0099';  -- desfaz o insert do subbloco
  exception
    when not_null_violation then v_ok := true;
    when sqlstate 'P0099' then v_ok := false;
  end;
  r := r || format('%s 05 usuário sem imobiliária (com 2 ativas) é recusado', case when v_ok then 'ok    ' else 'FALHOU' end);

  -- ----- Analista A2 -----
  perform set_config('request.jwt.claims', json_build_object('sub', c_a2, 'role', 'authenticated')::text, true);
  set local role authenticated;

  v_ok := imobenviomassa.tenant_atual() = c_a;
  r := r || format('%s 06 A2: tenant_atual = imobiliária A', case when coalesce(v_ok, false) then 'ok    ' else 'FALHOU' end);
  v_ok := (select count(*) from imobenviomassa.wa_campanhas) = 1;
  r := r || format('%s 07 A2 (analista) vê só a própria campanha', case when v_ok then 'ok    ' else 'FALHOU' end);
  v_ok := (select count(*) from imobenviomassa.wa_campanha_destinatarios) = 1;
  r := r || format('%s 08 A2 vê o destinatário da própria campanha', case when v_ok then 'ok    ' else 'FALHOU' end);
  v_ok := (select perfil = 'analista' and (select count(*) from jsonb_object_keys(regras)) = 6 from imobenviomassa.meu_acesso());
  r := r || format('%s 09 A2: meu_acesso traz o perfil e 6 regras', case when coalesce(v_ok, false) then 'ok    ' else 'FALHOU' end);
  v_ok := not imobenviomassa.tem_permissao('manage_permissions');
  r := r || format('%s 10 A2 não tem manage_permissions', case when coalesce(v_ok, false) then 'ok    ' else 'FALHOU' end);

  begin
    perform cpf from imobenviomassa.wa_campanha_destinatarios;
    v_ok := false;
  exception when insufficient_privilege then v_ok := true;
  end;
  r := r || format('%s 11 navegador não lê CPF dos destinatários', case when v_ok then 'ok    ' else 'FALHOU' end);

  begin
    perform imobenviomassa.salvar_permissoes_perfil('analista', '[{"id":"manage_users","enabled":true}]');
    v_ok := false;
    raise exception using errcode = 'P0099';
  exception
    when sqlstate 'P0099' then v_ok := false;
    when others then v_ok := true;
  end;
  r := r || format('%s 12 analista não altera permissões', case when v_ok then 'ok    ' else 'FALHOU' end);

  begin
    insert into imobenviomassa.wa_campanhas (nome, criado_por, origem) values ('x', c_a2, 'excel');
    v_ok := false;
    raise exception using errcode = 'P0099';
  exception
    when insufficient_privilege then v_ok := true;
    when sqlstate 'P0099' then v_ok := false;
  end;
  r := r || format('%s 13 navegador não grava campanha direto', case when v_ok then 'ok    ' else 'FALHOU' end);

  begin
    perform * from imobenviomassa.rm_credenciais(c_a);
    v_ok := false;
  exception when insufficient_privilege then v_ok := true;
  end;
  r := r || format('%s 14 navegador não lê credenciais do RM', case when v_ok then 'ok    ' else 'FALHOU' end);

  reset role;

  -- ----- Super Admin A1 -----
  perform set_config('request.jwt.claims', json_build_object('sub', c_a1, 'role', 'authenticated')::text, true);
  set local role authenticated;

  v_ok := (select count(*) from imobenviomassa.wa_campanhas) = 2
      and not exists (select 1 from imobenviomassa.wa_campanhas where imobiliaria_id = c_b);
  r := r || format('%s 15 A1 (super admin) vê as 2 campanhas da A e nenhuma da B', case when v_ok then 'ok    ' else 'FALHOU' end);
  v_ok := imobenviomassa.tem_permissao('manage_permissions');
  r := r || format('%s 16 A1 tem qualquer permissão', case when coalesce(v_ok, false) then 'ok    ' else 'FALHOU' end);
  v_ok := imobenviomassa.criar_perfil('Jurídico', 'Só relatórios') like 'juridico_%';
  r := r || format('%s 17 A1 cria perfil "Jurídico" na A', case when coalesce(v_ok, false) then 'ok    ' else 'FALHOU' end);
  v_ok := imobenviomassa.salvar_permissoes_perfil((select chave from imobenviomassa.perfis where nome = 'Jurídico'),
            '[{"id":"ver_relatorios","enabled":true},{"id":"docusign","enabled":true}]') = 2;
  r := r || format('%s 18 A1 salva 2 permissões do perfil novo', case when coalesce(v_ok, false) then 'ok    ' else 'FALHOU' end);
  -- 3 do sistema + o Jurídico + os perfis do sistema que a 03 (Régua) acrescenta, se já aplicada.
  v_ok := (select count(*) from imobenviomassa.listar_perfis())
          = 4 + (select count(*) from imobenviomassa.perfis where sistema and chave not in ('super_admin', 'admin', 'analista'));
  r := r || format('%s 19 listar_perfis da A traz os do sistema + o novo', case when v_ok then 'ok    ' else 'FALHOU' end);
  v_ok := (select count(*) from imobenviomassa.usuarios) = 2;
  r := r || format('%s 20 A1 vê os usuários da A, não os da B', case when v_ok then 'ok    ' else 'FALHOU' end);

  begin
    perform imobenviomassa.salvar_permissoes_perfil('super_admin', '[{"id":"ver_dashboard","enabled":false}]');
    v_ok := false;
    raise exception using errcode = 'P0099';
  exception
    when sqlstate 'P0099' then v_ok := false;
    when others then v_ok := true;
  end;
  r := r || format('%s 21 Super Admin não é editável', case when v_ok then 'ok    ' else 'FALHOU' end);

  begin
    perform imobenviomassa.salvar_permissoes_perfil('analista', '[{"id":"Inválido!","enabled":true}]');
    v_ok := false;
    raise exception using errcode = 'P0099';
  exception
    when sqlstate 'P0099' then v_ok := false;
    when others then v_ok := true;
  end;
  r := r || format('%s 22 id de permissão inválido é recusado', case when v_ok then 'ok    ' else 'FALHOU' end);

  reset role;

  -- ----- Admin B1 (outra imobiliária) -----
  perform set_config('request.jwt.claims', json_build_object('sub', c_b1, 'role', 'authenticated')::text, true);
  set local role authenticated;

  v_ok := (select count(*) from imobenviomassa.wa_campanhas) = 1
      and (select imobiliaria_id from imobenviomassa.wa_campanhas limit 1) = c_b;
  r := r || format('%s 23 B1 vê só a campanha da B', case when coalesce(v_ok, false) then 'ok    ' else 'FALHOU' end);
  v_ok := not exists (select 1 from imobenviomassa.perfis where nome = 'Jurídico');
  r := r || format('%s 24 B1 não vê o perfil criado na A', case when v_ok then 'ok    ' else 'FALHOU' end);
  v_ok := (select count(*) from imobenviomassa.imobiliarias) = 1;
  r := r || format('%s 25 B1 enxerga só a própria imobiliária', case when v_ok then 'ok    ' else 'FALHOU' end);

  reset role;

  -- ----- Sem cadastro e anon -----
  perform set_config('request.jwt.claims', json_build_object('sub', c_c1, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_ok := imobenviomassa.tenant_atual() is null and (select count(*) from imobenviomassa.wa_campanhas) = 0;
  r := r || format('%s 26 usuário sem cadastro: tenant nulo e 0 campanhas', case when v_ok then 'ok    ' else 'FALHOU' end);
  reset role;

  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
  begin
    perform 1 from imobenviomassa.wa_campanhas;
    v_ok := false;
  exception when insufficient_privilege then v_ok := true;
  end;
  r := r || format('%s 27 anon não lê tabelas', case when v_ok then 'ok    ' else 'FALHOU' end);
  reset role;

  -- ----- Usuário desativado -----
  update imobenviomassa.usuarios set ativo = false where id = c_a2;
  perform set_config('request.jwt.claims', json_build_object('sub', c_a2, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_ok := imobenviomassa.tenant_atual() is null and (select count(*) from imobenviomassa.wa_campanhas) = 0;
  r := r || format('%s 28 usuário desativado perde o acesso', case when v_ok then 'ok    ' else 'FALHOU' end);
  reset role;
  update imobenviomassa.usuarios set ativo = true where id = c_a2;

  -- ----- Troca de senha pendente -----
  update imobenviomassa.usuarios set trocar_senha = true where id = c_a2;
  set local role authenticated;
  v_ok := (select count(*) from imobenviomassa.wa_campanhas) = 0;
  r := r || format('%s 29 troca de senha pendente bloqueia os dados', case when v_ok then 'ok    ' else 'FALHOU' end);
  perform imobenviomassa.concluir_troca_senha();
  v_ok := (select count(*) from imobenviomassa.wa_campanhas) = 1;
  r := r || format('%s 30 concluir_troca_senha libera de novo', case when v_ok then 'ok    ' else 'FALHOU' end);
  reset role;
  perform set_config('request.jwt.claims', '', true);

  -- ----- Servidor (papel do SQL Editor, equivalente ao service_role) -----
  perform imobenviomassa.rm_credenciais_salvar(c_a, 'https://rm.a.test/x', 'usuario.a', 'senha-teste', 'teste');
  v_ok := (select bool_and(configurado) from imobenviomassa.rm_status(c_a) where recurso = 'empreendimentos')
      and not coalesce((select bool_or(configurado) from imobenviomassa.rm_status(c_b)), false);
  r := r || format('%s 31 RM salvo e configurado só na A', case when coalesce(v_ok, false) then 'ok    ' else 'FALHOU' end);
  v_ok := (select senha <> '' from imobenviomassa.rm_credenciais(c_a));
  r := r || format('%s 32 rm_credenciais devolve a senha para o servidor', case when coalesce(v_ok, false) then 'ok    ' else 'FALHOU' end);
  v_ok := (select count(*) from imobenviomassa.wa_titular_ocorrencias(c_a, '11122233344')) = 1;
  r := r || format('%s 33 titular na A: 1 ocorrência (a da B não aparece)', case when v_ok then 'ok    ' else 'FALHOU' end);
  v_ok := imobenviomassa.wa_anonimizar_titular(c_a, null, null, '21 99999-0000') = 1
      and (select cpf from imobenviomassa.wa_campanha_destinatarios where imobiliaria_id = c_b) is not null;
  r := r || format('%s 34 anonimizar titular na A não toca a B', case when coalesce(v_ok, false) then 'ok    ' else 'FALHOU' end);

  for i in 1..6 loop
    v_json := imobenviomassa.auth_pre_login('alvo@x.test', '10.0.0.1');
    perform imobenviomassa.auth_registrar_resultado('alvo@x.test', '10.0.0.1', false);
  end loop;
  v_ok := (imobenviomassa.auth_pre_login('alvo@x.test', '10.0.0.2')->>'permitido')::boolean = false;
  r := r || format('%s 35 limite de login bloqueia a conta após 5 falhas', case when coalesce(v_ok, false) then 'ok    ' else 'FALHOU' end);

  -- ----- Resultado: o erro abaixo é proposital e desfaz tudo o que o teste criou -----
  select string_agg(x, E'\n') into v_txt from unnest(r) x;
  raise exception E'TESTE CONCLUÍDO — nada foi gravado. passaram: %, falharam: %\n%',
    (select count(*) from unnest(r) x where x like 'ok%'),
    (select count(*) from unnest(r) x where x like 'FALHOU%'),
    v_txt
    using errcode = 'P0001';
end
$teste$;
