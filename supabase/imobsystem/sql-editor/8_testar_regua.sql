-- =====================================================================================================
-- Teste a seco da Régua de Cobrança (rodar no SQL Editor DEPOIS do 7_aplicar_regua.sql).
--
-- Um bloco só (do $$ … $$) que TERMINA COM ERRO DE PROPÓSITO: é isso que desfaz tudo o que o teste cria.
-- Resultado esperado (aparece como "Error" no painel, é normal):
--   TESTE CONCLUÍDO — nada foi gravado. passaram: 30, falharam: 0
-- =====================================================================================================
do $teste$
declare
  r text[] := '{}';
  v_ok boolean;
  v_txt text;
  v_j jsonb;
  v_n integer;
  c_a   constant uuid := 'aaaaaaaa-1111-0000-0000-000000000000';
  c_b   constant uuid := 'bbbbbbbb-1111-0000-0000-000000000000';
  c_ac  constant uuid := 'a1000000-0000-0000-0000-0000000000a1';  -- analista de cobrança A
  c_au  constant uuid := 'a1000000-0000-0000-0000-0000000000a2';  -- auditoria A
  c_an  constant uuid := 'a1000000-0000-0000-0000-0000000000a3';  -- analista (só DocuSign) A
  c_bg  constant uuid := 'b1000000-0000-0000-0000-0000000000b1';  -- gestor financeiro B
  v_lote_a uuid;
  v_lote_b uuid;
  v_b1 uuid; v_b2 uuid; v_b3 uuid; v_b4 uuid;
  v_tpl uuid;
begin
  -- ----- Cenário -----
  insert into auth.users (id, email) values
    (c_ac, 'ac@regua.test'), (c_au, 'au@regua.test'), (c_an, 'an@regua.test'), (c_bg, 'bg@regua.test');
  insert into imobenviomassa.imobiliarias (id, nome) values (c_a, 'Régua Teste A'), (c_b, 'Régua Teste B');
  insert into imobenviomassa.usuarios (id, imobiliaria_id, email, nome, perfil) values
    (c_ac, c_a, 'ac@regua.test', 'AC', 'analista_cobranca'),
    (c_au, c_a, 'au@regua.test', 'AU', 'auditoria'),
    (c_an, c_a, 'an@regua.test', 'AN', 'analista'),
    (c_bg, c_b, 'bg@regua.test', 'BG', 'gestor_financeiro');

  v_ok := (select count(*) from imobenviomassa.perfis where chave in ('gestor_financeiro', 'analista_cobranca', 'auditoria') and sistema) = 3;
  r := r || format('%s 01 perfis do PRD existem', case when v_ok then 'ok    ' else 'FALHOU' end);

  v_ok := (select count(*) from imobenviomassa.perfil_permissoes where imobiliaria_id = c_a and perfil = 'gestor_financeiro') = 7
      and (select count(*) from imobenviomassa.perfil_permissoes where imobiliaria_id = c_a and perfil = 'analista_cobranca') = 5
      and (select count(*) from imobenviomassa.perfil_permissoes where imobiliaria_id = c_a and perfil = 'auditoria') = 4
      and (select count(*) from imobenviomassa.perfil_permissoes where imobiliaria_id = c_a and perfil = 'admin' and permission_id like 'regua%') = 8;
  r := r || format('%s 02 regras iniciais da régua por perfil', case when v_ok then 'ok    ' else 'FALHOU' end);

  v_ok := exists (select 1 from imobenviomassa.regua_config where imobiliaria_id = c_a)
      and exists (select 1 from imobenviomassa.email_provedor where imobiliaria_id = c_a)
      and exists (select 1 from imobenviomassa.integracao_zenvia where imobiliaria_id = c_a);
  r := r || format('%s 03 provisionamento cria config, e-mail e Zenvia', case when v_ok then 'ok    ' else 'FALHOU' end);

  v_ok := imobenviomassa.segredo_nome_valido('zenvia_token_abc') and imobenviomassa.segredo_nome_valido('resend_apikey_abc')
      and imobenviomassa.segredo_nome_valido('rm_senha_abc') and not imobenviomassa.segredo_nome_valido('outro_x');
  r := r || format('%s 04 Vault aceita zenvia_/resend_/smtp_ e mantém rm_', case when v_ok then 'ok    ' else 'FALHOU' end);

  insert into imobenviomassa.regua_template (imobiliaria_id, nome, canal, assunto, corpo)
  values (c_a, 'E-mail 60', 'email', 'Assunto {{nome}}', 'Olá {{nome}}') returning id into v_tpl;

  insert into imobenviomassa.regua_lote (imobiliaria_id, titulo, origem, tipo_regua, faixa_atraso, canais, template_email_id, usuario_id, status, iniciado_em)
  values (c_a, 'Atraso 60 · A', 'planilha', 'atraso', '60', array['whatsapp', 'email'], v_tpl, c_ac, 'em_processamento', now()) returning id into v_lote_a;
  insert into imobenviomassa.regua_lote (imobiliaria_id, titulo, origem, tipo_regua, faixa_atraso, canais, usuario_id)
  values (c_b, 'Atraso 30 · B', 'rm', 'atraso', '30', array['email'], c_bg) returning id into v_lote_b;

  insert into imobenviomassa.regua_boleto (imobiliaria_id, lote_id, cliente_nome, cpf_cnpj, numero, valor, status_geral, status_registro_banco)
  values (c_a, v_lote_a, 'Cliente 1', '12345678909', 'B1', 100, 'elegivel', 'registrado') returning id into v_b1;
  insert into imobenviomassa.regua_boleto (imobiliaria_id, lote_id, cliente_nome, cpf_cnpj, numero, valor, status_geral)
  values (c_a, v_lote_a, 'Cliente 2', '12345678909', 'B2', 100, 'elegivel') returning id into v_b2;
  insert into imobenviomassa.regua_boleto (imobiliaria_id, lote_id, cliente_nome, numero, status_geral)
  values (c_a, v_lote_a, 'Cliente 3', 'B3', 'excecao_contato') returning id into v_b3;
  insert into imobenviomassa.regua_boleto (imobiliaria_id, lote_id, cliente_nome, numero, status_geral, status_registro_banco)
  values (c_a, v_lote_a, 'Cliente 4', 'B4', 'excecao_registro', 'nao_registrado') returning id into v_b4;

  -- B1: WhatsApp e e-mail enviados → sucesso. B2: WhatsApp falhou e e-mail ok → parcial.
  insert into imobenviomassa.regua_tentativa (imobiliaria_id, lote_id, boleto_id, canal, status, tentado_em) values
    (c_a, v_lote_a, v_b1, 'whatsapp', 'entregue', now()), (c_a, v_lote_a, v_b1, 'email', 'enviado', now()),
    (c_a, v_lote_a, v_b2, 'whatsapp', 'falha', now()), (c_a, v_lote_a, v_b2, 'email', 'enviado', now());
  perform imobenviomassa.regua_recalcular_lote(v_lote_a);
  v_ok := (select status_geral from imobenviomassa.regua_boleto where id = v_b1) = 'sucesso'
      and (select status_geral from imobenviomassa.regua_boleto where id = v_b2) = 'parcial'
      and (select status_geral from imobenviomassa.regua_boleto where id = v_b3) = 'excecao_contato';
  r := r || format('%s 05 status do boleto: sucesso, parcial, exceção intacta', case when v_ok then 'ok    ' else 'FALHOU' end);

  -- Reenvio com sucesso cobre a falha anterior do mesmo canal.
  insert into imobenviomassa.regua_tentativa (imobiliaria_id, lote_id, boleto_id, canal, status, tentado_em, criado_em)
  values (c_a, v_lote_a, v_b2, 'whatsapp', 'enviado', now(), now() + interval '1 second');
  v_ok := imobenviomassa.regua_recalcular_boleto(v_b2) = 'sucesso';
  r := r || format('%s 06 reenvio com sucesso vira sucesso', case when v_ok then 'ok    ' else 'FALHOU' end);

  v_j := imobenviomassa.regua_contadores(v_lote_a);
  v_ok := (v_j->>'no_lote')::int = 4 and (v_j->>'elegiveis')::int = 2 and (v_j->>'nao_registrados')::int = 1
      and (v_j->>'sem_contato')::int = 1 and (v_j->>'sucesso')::int = 2
      and (v_j->'whatsapp'->>'enviados')::int = 2 and (v_j->'whatsapp'->>'falhas')::int = 1 and (v_j->'email'->>'enviados')::int = 2;
  r := r || format('%s 07 contadores do lote', case when v_ok then 'ok    ' else 'FALHOU' end);

  v_ok := imobenviomassa.regua_enviado_24h(c_a, 'B1', 'email') and not imobenviomassa.regua_enviado_24h(c_b, 'B1', 'email')
      and not imobenviomassa.regua_enviado_24h(c_a, 'B9', 'email');
  r := r || format('%s 08 trava 24 h por boleto, canal e imobiliária', case when v_ok then 'ok    ' else 'FALHOU' end);

  v_ok := (select array_agg(x order by x) from imobenviomassa.regua_numeros_enviados_24h(c_a, array['B1', 'B2', 'B3'], 'email') x) = array['B1', 'B2'];
  r := r || format('%s 09 trava 24 h em lote (vários números)', case when v_ok then 'ok    ' else 'FALHOU' end);

  insert into imobenviomassa.regua_tentativa (imobiliaria_id, lote_id, boleto_id, canal, status)
  select c_a, v_lote_a, v_b3, 'email', 'pendente' from generate_series(1, 5);
  select count(*) into v_n from imobenviomassa.regua_reservar_tentativas(c_a, v_lote_a, 3);
  v_ok := v_n = 3 and (select count(*) from imobenviomassa.regua_tentativa where lote_id = v_lote_a and status = 'processando') = 3;
  select count(*) into v_n from imobenviomassa.regua_reservar_tentativas(c_a, v_lote_a, 3);
  v_ok := v_ok and v_n = 2;
  r := r || format('%s 10 reserva da fila sem repetir tentativas', case when v_ok then 'ok    ' else 'FALHOU' end);

  update imobenviomassa.regua_tentativa set tentado_em = now() - interval '11 minutes' where lote_id = v_lote_a and status = 'processando';
  v_ok := imobenviomassa.regua_liberar_presas(c_a, v_lote_a) = 5;
  r := r || format('%s 11 tentativas presas voltam para a fila', case when v_ok then 'ok    ' else 'FALHOU' end);

  v_j := imobenviomassa.regua_painel(c_a, current_date - 30, current_date);
  v_ok := v_j ? 'por_dia' and v_j ? 'por_empreendimento' and (v_j->>'boletos')::int = 4;
  r := r || format('%s 12 painel devolve os indicadores', case when v_ok then 'ok    ' else 'FALHOU' end);

  -- ----- Regras de integridade -----
  begin
    insert into imobenviomassa.regua_lote (imobiliaria_id, titulo, origem, tipo_regua, canais, usuario_id) values (c_a, 'Sem faixa', 'rm', 'atraso', array['email'], c_ac);
    v_ok := false;
    raise exception using errcode = 'P0099';
  exception when check_violation then v_ok := true; when sqlstate 'P0099' then v_ok := false;
  end;
  r := r || format('%s 13 lote em atraso exige faixa', case when v_ok then 'ok    ' else 'FALHOU' end);

  begin
    insert into imobenviomassa.regua_lote (imobiliaria_id, titulo, origem, tipo_regua, faixa_atraso, canais, usuario_id, tipo)
    values (c_a, 'Extra', 'rm', 'atraso', '30', array['email'], c_ac, 'extraordinario');
    v_ok := false;
    raise exception using errcode = 'P0099';
  exception when check_violation then v_ok := true; when sqlstate 'P0099' then v_ok := false;
  end;
  r := r || format('%s 14 extraordinário exige justificativa', case when v_ok then 'ok    ' else 'FALHOU' end);

  begin
    insert into imobenviomassa.regua_lote (imobiliaria_id, titulo, origem, tipo_regua, faixa_atraso, canais, usuario_id)
    values (c_a, 'Canal x', 'rm', 'atraso', '30', array['sms'], c_ac);
    v_ok := false;
    raise exception using errcode = 'P0099';
  exception when check_violation then v_ok := true; when sqlstate 'P0099' then v_ok := false;
  end;
  r := r || format('%s 15 canal só whatsapp/email', case when v_ok then 'ok    ' else 'FALHOU' end);

  begin
    insert into imobenviomassa.regua_lote (imobiliaria_id, titulo, origem, tipo_regua, faixa_atraso, canais, usuario_id, template_email_id)
    values (c_b, 'Template de outra imob', 'rm', 'atraso', '30', array['email'], c_bg, v_tpl);
    v_ok := false;
    raise exception using errcode = 'P0099';
  exception when foreign_key_violation then v_ok := true; when sqlstate 'P0099' then v_ok := false;
  end;
  r := r || format('%s 16 lote não usa template de outra imobiliária', case when v_ok then 'ok    ' else 'FALHOU' end);

  begin
    insert into imobenviomassa.regua_boleto (imobiliaria_id, lote_id, cliente_nome, numero) values (c_a, v_lote_a, 'Dup', 'B1');
    v_ok := false;
    raise exception using errcode = 'P0099';
  exception when unique_violation then v_ok := true; when sqlstate 'P0099' then v_ok := false;
  end;
  r := r || format('%s 17 boleto repetido no mesmo lote é recusado', case when v_ok then 'ok    ' else 'FALHOU' end);

  -- ----- RLS: analista de cobrança A -----
  perform set_config('request.jwt.claims', json_build_object('sub', c_ac, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_ok := (select count(*) from imobenviomassa.regua_lote) = 1 and (select imobiliaria_id from imobenviomassa.regua_lote limit 1) = c_a;
  r := r || format('%s 18 analista de cobrança vê só o lote da A', case when v_ok then 'ok    ' else 'FALHOU' end);
  v_ok := (select count(*) from imobenviomassa.regua_template) = 1;
  r := r || format('%s 19 templates da própria imobiliária', case when v_ok then 'ok    ' else 'FALHOU' end);
  begin
    perform 1 from imobenviomassa.regua_boleto;
    v_ok := false;
  exception when insufficient_privilege then v_ok := true;
  end;
  r := r || format('%s 20 navegador não lê boletos (CPF, contatos)', case when v_ok then 'ok    ' else 'FALHOU' end);
  begin
    perform 1 from imobenviomassa.regua_tentativa;
    v_ok := false;
  exception when insufficient_privilege then v_ok := true;
  end;
  r := r || format('%s 21 navegador não lê tentativas (payload e resposta)', case when v_ok then 'ok    ' else 'FALHOU' end);
  begin
    perform 1 from imobenviomassa.email_provedor;
    v_ok := false;
  exception when insufficient_privilege then v_ok := true;
  end;
  r := r || format('%s 22 navegador não lê o provedor de e-mail', case when v_ok then 'ok    ' else 'FALHOU' end);
  begin
    insert into imobenviomassa.regua_lote (imobiliaria_id, titulo, origem, tipo_regua, faixa_atraso, canais, usuario_id)
    values (c_a, 'Direto', 'rm', 'atraso', '30', array['email'], c_ac);
    v_ok := false;
    raise exception using errcode = 'P0099';
  exception when insufficient_privilege then v_ok := true; when sqlstate 'P0099' then v_ok := false;
  end;
  r := r || format('%s 23 navegador não grava lote direto', case when v_ok then 'ok    ' else 'FALHOU' end);
  begin
    perform imobenviomassa.regua_contadores(v_lote_a);
    v_ok := false;
  exception when insufficient_privilege then v_ok := true;
  end;
  r := r || format('%s 24 navegador não chama funções internas da régua', case when v_ok then 'ok    ' else 'FALHOU' end);
  begin
    perform imobenviomassa.wa_segredo_ler('zenvia_token_x');
    v_ok := false;
  exception when insufficient_privilege then v_ok := true;
  end;
  r := r || format('%s 25 navegador não lê o Vault', case when v_ok then 'ok    ' else 'FALHOU' end);
  reset role;

  -- ----- RLS: auditoria A, analista (DocuSign) A e gestor B -----
  perform set_config('request.jwt.claims', json_build_object('sub', c_au, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_ok := (select count(*) from imobenviomassa.regua_lote) = 1;
  r := r || format('%s 26 auditoria vê os lotes', case when v_ok then 'ok    ' else 'FALHOU' end);
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', c_an, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_ok := (select count(*) from imobenviomassa.regua_lote) = 0 and (select count(*) from imobenviomassa.regua_template) = 0;
  r := r || format('%s 27 analista sem permissão da régua não vê nada', case when v_ok then 'ok    ' else 'FALHOU' end);
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', c_bg, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_ok := (select count(*) from imobenviomassa.regua_lote) = 1 and (select titulo from imobenviomassa.regua_lote limit 1) = 'Atraso 30 · B';
  r := r || format('%s 28 gestor da B vê só o lote da B', case when v_ok then 'ok    ' else 'FALHOU' end);
  reset role;

  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
  begin
    perform 1 from imobenviomassa.regua_lote;
    v_ok := false;
  exception when insufficient_privilege then v_ok := true;
  end;
  r := r || format('%s 29 anon não lê lotes', case when v_ok then 'ok    ' else 'FALHOU' end);
  reset role;
  perform set_config('request.jwt.claims', '', true);

  -- Webhook (service_role): evento repetido não duplica.
  insert into imobenviomassa.zenvia_eventos (imobiliaria_id, tipo, zenvia_id, status, payload) values (c_a, 'MESSAGE_STATUS', 'z1', 'DELIVERED', '{}');
  begin
    insert into imobenviomassa.zenvia_eventos (imobiliaria_id, tipo, zenvia_id, status, payload) values (c_a, 'MESSAGE_STATUS', 'z1', 'DELIVERED', '{}');
    v_ok := false;
    raise exception using errcode = 'P0099';
  exception when unique_violation then v_ok := true; when sqlstate 'P0099' then v_ok := false;
  end;
  r := r || format('%s 30 evento repetido da Zenvia é ignorado', case when v_ok then 'ok    ' else 'FALHOU' end);

  -- ----- Resultado: o erro abaixo é proposital e desfaz tudo o que o teste criou -----
  select string_agg(x, E'\n') into v_txt from unnest(r) x;
  raise exception E'TESTE CONCLUÍDO — nada foi gravado. passaram: %, falharam: %\n%',
    (select count(*) from unnest(r) x where x like 'ok%'),
    (select count(*) from unnest(r) x where x like 'FALHOU%'),
    v_txt
    using errcode = 'P0001';
end
$teste$;
