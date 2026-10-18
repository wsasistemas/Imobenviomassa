-- =====================================================================================================
-- Teste a seco da estrutura do imobenviomassa (rodar no SQL Editor DEPOIS da 02). Tudo termina em ROLLBACK:
-- cria imobiliárias, usuários e campanhas fictícios, simula cada pessoa e desfaz no fim.
-- Esperado na última consulta: falharam = 0.
-- =====================================================================================================
begin;

create temp table resultado (n serial, teste text, ok boolean) on commit drop;
grant all on resultado to authenticated, anon;
grant usage on sequence resultado_n_seq to authenticated, anon;

-- Simula um usuário logado (ou anon quando p_uid é nulo).
create function pg_temp.como(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    case when p_uid is null then '{"role":"anon"}' else json_build_object('sub', p_uid, 'role', 'authenticated')::text end, true);
  execute case when p_uid is null then 'set local role anon' else 'set local role authenticated' end;
end $$;
create function pg_temp.volta() returns void language plpgsql as $$
begin execute 'reset role'; perform set_config('request.jwt.claims', '', true); end $$;
create function pg_temp.ok(p_teste text, p_ok boolean) returns void language sql as $$
  insert into resultado (teste, ok) values (p_teste, coalesce(p_ok, false)) $$;
grant execute on function pg_temp.ok(text, boolean) to authenticated, anon;

-- ----- Cenário -----
insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-0000000000a1', 'teste.a1@imobenviomassa.test'),
  ('a0000000-0000-0000-0000-0000000000a2', 'teste.a2@imobenviomassa.test'),
  ('b0000000-0000-0000-0000-0000000000b1', 'teste.b1@imobenviomassa.test'),
  ('c0000000-0000-0000-0000-0000000000c1', 'teste.semcadastro@imobenviomassa.test');

insert into imobenviomassa.imobiliarias (id, nome) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'Imobiliária Teste A'),
  ('bbbbbbbb-0000-0000-0000-000000000000', 'Imobiliária Teste B');

insert into imobenviomassa.usuarios (id, imobiliaria_id, email, nome, perfil) values
  ('a0000000-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-000000000000', 'TESTE.A1@imobenviomassa.test', 'A1', 'super_admin'),
  ('a0000000-0000-0000-0000-0000000000a2', 'aaaaaaaa-0000-0000-0000-000000000000', 'teste.a2@imobenviomassa.test', 'A2', 'analista'),
  ('b0000000-0000-0000-0000-0000000000b1', 'bbbbbbbb-0000-0000-0000-000000000000', 'teste.b1@imobenviomassa.test', 'B1', 'admin');

insert into imobenviomassa.wa_campanhas (id, imobiliaria_id, nome, criado_por, origem) values
  ('ca000000-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-000000000000', 'A por A1', 'a0000000-0000-0000-0000-0000000000a1', 'excel'),
  ('ca000000-0000-0000-0000-0000000000a2', 'aaaaaaaa-0000-0000-0000-000000000000', 'A por A2', 'a0000000-0000-0000-0000-0000000000a2', 'excel'),
  ('cb000000-0000-0000-0000-0000000000b1', 'bbbbbbbb-0000-0000-0000-000000000000', 'B por B1', 'b0000000-0000-0000-0000-0000000000b1', 'totvs');

insert into imobenviomassa.wa_campanha_destinatarios (imobiliaria_id, campanha_id, nome, cpf, email, telefone) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'ca000000-0000-0000-0000-0000000000a2', 'Comprador A', '111.222.333-44', 'comprador@x.test', '5521999990000'),
  ('bbbbbbbb-0000-0000-0000-000000000000', 'cb000000-0000-0000-0000-0000000000b1', 'Comprador B', '111.222.333-44', 'comprador@x.test', '21999990000');

-- ----- Estrutura -----
select pg_temp.ok('01 provisionou retenção e RM da imobiliária A',
  exists (select 1 from imobenviomassa.wa_retencao_config where imobiliaria_id = 'aaaaaaaa-0000-0000-0000-000000000000')
  and (select count(*) from imobenviomassa.integracao_rm_recurso where imobiliaria_id = 'aaaaaaaa-0000-0000-0000-000000000000') = 2);
select pg_temp.ok('02 regras iniciais: Analista com 6 liberações, Admin com 9',
  (select count(*) from imobenviomassa.perfil_permissoes where imobiliaria_id = 'aaaaaaaa-0000-0000-0000-000000000000' and perfil = 'analista') = 6
  and (select count(*) from imobenviomassa.perfil_permissoes where imobiliaria_id = 'aaaaaaaa-0000-0000-0000-000000000000' and perfil = 'admin') = 9);
select pg_temp.ok('03 e-mail gravado em minúsculas',
  (select email from imobenviomassa.usuarios where id = 'a0000000-0000-0000-0000-0000000000a1') = 'teste.a1@imobenviomassa.test');
select pg_temp.ok('04 app registrado na Central',
  exists (select 1 from acessos.aplicativos where schema_name = 'imobenviomassa'));

do $$ begin
  begin
    insert into imobenviomassa.usuarios (id, email, perfil) values ('c0000000-0000-0000-0000-0000000000c1', 'x@x.test', 'analista');
    perform pg_temp.ok('05 usuário sem imobiliária (com 2 ativas) é recusado', false);
  exception when not_null_violation then
    perform pg_temp.ok('05 usuário sem imobiliária (com 2 ativas) é recusado', true);
  end;
end $$;

-- ----- Analista A2 -----
select pg_temp.como('a0000000-0000-0000-0000-0000000000a2');
select pg_temp.ok('06 A2: tenant_atual = imobiliária A', imobenviomassa.tenant_atual() = 'aaaaaaaa-0000-0000-0000-000000000000');
select pg_temp.ok('07 A2 (analista) vê só a própria campanha', (select count(*) from imobenviomassa.wa_campanhas) = 1);
select pg_temp.ok('08 A2 vê o destinatário da própria campanha (sem CPF)',
  (select count(*) from imobenviomassa.wa_campanha_destinatarios) = 1);
select pg_temp.ok('09 A2: meu_acesso traz o perfil e 6 regras',
  (select perfil = 'analista' and (select count(*) from jsonb_object_keys(regras)) = 6 from imobenviomassa.meu_acesso()));
select pg_temp.ok('10 A2 não tem manage_permissions', not imobenviomassa.tem_permissao('manage_permissions'));
select pg_temp.volta();

do $$ begin
  perform pg_temp.como('a0000000-0000-0000-0000-0000000000a2');
  begin
    perform cpf from imobenviomassa.wa_campanha_destinatarios;
    perform pg_temp.ok('11 navegador não lê CPF dos destinatários', false);
  exception when insufficient_privilege then
    perform pg_temp.ok('11 navegador não lê CPF dos destinatários', true);
  end;
  begin
    perform imobenviomassa.salvar_permissoes_perfil('analista', '[{"id":"manage_users","enabled":true}]');
    perform pg_temp.ok('12 analista não altera permissões', false);
  exception when others then
    perform pg_temp.ok('12 analista não altera permissões', true);
  end;
  begin
    insert into imobenviomassa.wa_campanhas (nome, criado_por, origem) values ('x', auth.uid(), 'excel');
    perform pg_temp.ok('13 navegador não grava campanha direto', false);
  exception when insufficient_privilege then
    perform pg_temp.ok('13 navegador não grava campanha direto', true);
  end;
  begin
    perform * from imobenviomassa.rm_credenciais('aaaaaaaa-0000-0000-0000-000000000000');
    perform pg_temp.ok('14 navegador não lê credenciais do RM', false);
  exception when insufficient_privilege then
    perform pg_temp.ok('14 navegador não lê credenciais do RM', true);
  end;
  perform pg_temp.volta();
end $$;

-- ----- Super Admin A1 -----
select pg_temp.como('a0000000-0000-0000-0000-0000000000a1');
select pg_temp.ok('15 A1 (super admin) vê as 2 campanhas da A e nenhuma da B',
  (select count(*) from imobenviomassa.wa_campanhas) = 2
  and not exists (select 1 from imobenviomassa.wa_campanhas where imobiliaria_id = 'bbbbbbbb-0000-0000-0000-000000000000'));
select pg_temp.ok('16 A1 tem qualquer permissão', imobenviomassa.tem_permissao('manage_permissions'));
select pg_temp.ok('17 A1 cria perfil "Jurídico" na A',
  imobenviomassa.criar_perfil('Jurídico', 'Só relatórios') like 'juridico_%');
select pg_temp.ok('18 A1 salva 2 permissões do perfil novo',
  imobenviomassa.salvar_permissoes_perfil((select chave from imobenviomassa.perfis where nome = 'Jurídico'),
    '[{"id":"ver_relatorios","enabled":true},{"id":"docusign","enabled":true}]') = 2);
select pg_temp.ok('19 listar_perfis da A traz 4 perfis', (select count(*) from imobenviomassa.listar_perfis()) = 4);
select pg_temp.ok('20 A1 vê os usuários da A (manage_users), não os da B',
  (select count(*) from imobenviomassa.usuarios) = 2);
select pg_temp.volta();

do $$ begin
  perform pg_temp.como('a0000000-0000-0000-0000-0000000000a1');
  begin
    perform imobenviomassa.salvar_permissoes_perfil('super_admin', '[{"id":"ver_dashboard","enabled":false}]');
    perform pg_temp.ok('21 Super Admin não é editável', false);
  exception when others then
    perform pg_temp.ok('21 Super Admin não é editável', true);
  end;
  begin
    perform imobenviomassa.salvar_permissoes_perfil('analista', '[{"id":"Inválido!","enabled":true}]');
    perform pg_temp.ok('22 id de permissão inválido é recusado', false);
  exception when others then
    perform pg_temp.ok('22 id de permissão inválido é recusado', true);
  end;
  perform pg_temp.volta();
end $$;

-- ----- Admin B1 (outra imobiliária) -----
select pg_temp.como('b0000000-0000-0000-0000-0000000000b1');
select pg_temp.ok('23 B1 vê só a campanha da B', (select count(*) from imobenviomassa.wa_campanhas) = 1
  and (select imobiliaria_id from imobenviomassa.wa_campanhas limit 1) = 'bbbbbbbb-0000-0000-0000-000000000000');
select pg_temp.ok('24 B1 não vê o perfil criado na A', not exists (select 1 from imobenviomassa.perfis where nome = 'Jurídico'));
select pg_temp.ok('25 B1 enxerga só a própria imobiliária', (select count(*) from imobenviomassa.imobiliarias) = 1);
select pg_temp.volta();

-- ----- Sem cadastro e anon -----
select pg_temp.como('c0000000-0000-0000-0000-0000000000c1');
select pg_temp.ok('26 usuário sem cadastro: tenant nulo e 0 campanhas',
  imobenviomassa.tenant_atual() is null and (select count(*) from imobenviomassa.wa_campanhas) = 0);
select pg_temp.volta();

do $$ begin
  perform pg_temp.como(null);
  begin
    perform 1 from imobenviomassa.wa_campanhas;
    perform pg_temp.ok('27 anon não lê tabelas', false);
  exception when insufficient_privilege then
    perform pg_temp.ok('27 anon não lê tabelas', true);
  end;
  perform pg_temp.volta();
end $$;

-- ----- Usuário desativado -----
update imobenviomassa.usuarios set ativo = false where id = 'a0000000-0000-0000-0000-0000000000a2';
select pg_temp.como('a0000000-0000-0000-0000-0000000000a2');
select pg_temp.ok('28 usuário desativado perde o acesso', imobenviomassa.tenant_atual() is null
  and (select count(*) from imobenviomassa.wa_campanhas) = 0);
select pg_temp.volta();
update imobenviomassa.usuarios set ativo = true where id = 'a0000000-0000-0000-0000-0000000000a2';

-- ----- Troca de senha pendente -----
update imobenviomassa.usuarios set trocar_senha = true where id = 'a0000000-0000-0000-0000-0000000000a2';
select pg_temp.como('a0000000-0000-0000-0000-0000000000a2');
select pg_temp.ok('29 troca de senha pendente bloqueia os dados', (select count(*) from imobenviomassa.wa_campanhas) = 0);
select imobenviomassa.concluir_troca_senha();
select pg_temp.ok('30 concluir_troca_senha libera de novo', (select count(*) from imobenviomassa.wa_campanhas) = 1);
select pg_temp.volta();

-- ----- Servidor (service_role) -----
select imobenviomassa.rm_credenciais_salvar('aaaaaaaa-0000-0000-0000-000000000000', 'https://rm.a.test/x', 'usuario.a', 'senha-teste', 'teste');
select pg_temp.ok('31 RM salvo e configurado só na A',
  (select bool_and(configurado) from imobenviomassa.rm_status('aaaaaaaa-0000-0000-0000-000000000000') where recurso = 'empreendimentos')
  and not coalesce((select bool_or(configurado) from imobenviomassa.rm_status('bbbbbbbb-0000-0000-0000-000000000000')), false));
select pg_temp.ok('32 rm_credenciais devolve a senha para o servidor',
  (select senha <> '' from imobenviomassa.rm_credenciais('aaaaaaaa-0000-0000-0000-000000000000')));
select pg_temp.ok('33 titular na A: 1 ocorrência (a da B não aparece)',
  (select count(*) from imobenviomassa.wa_titular_ocorrencias('aaaaaaaa-0000-0000-0000-000000000000', '11122233344')) = 1);
select pg_temp.ok('34 anonimizar titular na A não toca a B',
  imobenviomassa.wa_anonimizar_titular('aaaaaaaa-0000-0000-0000-000000000000', null, null, '21 99999-0000') = 1
  and (select cpf from imobenviomassa.wa_campanha_destinatarios where imobiliaria_id = 'bbbbbbbb-0000-0000-0000-000000000000') is not null);

do $$
declare i int; r jsonb;
begin
  for i in 1..6 loop
    r := imobenviomassa.auth_pre_login('alvo@x.test', '10.0.0.1');
    perform imobenviomassa.auth_registrar_resultado('alvo@x.test', '10.0.0.1', false);
  end loop;
  perform pg_temp.ok('35 limite de login bloqueia a conta após 5 falhas',
    (imobenviomassa.auth_pre_login('alvo@x.test', '10.0.0.2')->>'permitido')::boolean = false);
end $$;

-- ----- Resultado -----
select n, teste, ok from resultado order by n;
select count(*) filter (where ok) as passaram, count(*) filter (where not ok) as falharam from resultado;

rollback;
