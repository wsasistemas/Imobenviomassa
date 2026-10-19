-- =====================================================================================================
-- Imobenviomassa — 04: Régua de Cobrança — faixa de atraso personalizada (19/10/2026)
-- Pedido do Wagner: além das faixas prontas (30/60/90/>90), o usuário monta a própria faixa (de X a Y dias)
-- e filtros por campo da API do TOTVS RM. Os filtros por campo e os dias da faixa personalizada ficam em
-- regua_lote.filtros (jsonb), sem coluna nova.
-- Só amplia a regra: a lista de faixas aceitas ganha 'personalizada' (nenhum dado muda).
-- =====================================================================================================
do $$
begin
  if to_regclass('imobenviomassa.regua_lote') is null then
    raise exception 'Rode antes a 03 (Régua de Cobrança).';
  end if;
end $$;

alter table imobenviomassa.regua_lote drop constraint if exists regua_lote_faixa_atraso_check;
alter table imobenviomassa.regua_lote add constraint regua_lote_faixa_atraso_check
  check (faixa_atraso is null or faixa_atraso in ('30', '60', '90', '90+', 'personalizada'));

-- Faixa personalizada precisa dos dias (mínimo e máximo, ou só o mínimo) em filtros.
alter table imobenviomassa.regua_lote drop constraint if exists regua_lote_faixa_personalizada_dias;
alter table imobenviomassa.regua_lote add constraint regua_lote_faixa_personalizada_dias
  check (faixa_atraso is distinct from 'personalizada' or (filtros ? 'dias_min'));

-- Painel: o filtro "régua/faixa" passa a reconhecer 'personalizada' (mesma função, comparação já é por texto).
notify pgrst, 'reload schema';
