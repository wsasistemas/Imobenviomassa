create index if not exists wa_auditoria_created_at_desc_idx
  on public.wa_auditoria (created_at desc);

create index if not exists wa_auditoria_usuario_id_idx
  on public.wa_auditoria (usuario_id);

create index if not exists wa_auditoria_entidade_idx
  on public.wa_auditoria (entidade);

create index if not exists wa_project_users_ativo_idx
  on public.wa_project_users (ativo)
  where ativo = true;

create index if not exists wa_campanha_destinatarios_campanha_idx
  on public.wa_campanha_destinatarios (campanha_id);

create index if not exists wa_campanha_destinatarios_status_idx
  on public.wa_campanha_destinatarios (status);