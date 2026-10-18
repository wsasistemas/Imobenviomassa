/**
 * Chave do Disparo em Massa na tela Permissões por aplicativo (Central de acessos Calper).
 *
 * O cadastro na Central é feito pela migração supabase/migrations/20261007100000_acessos_disparo_massa.sql:
 * aplicativo manual com chave `disparo_massa` e schema de dados `disparo_massa` (Contrato Calper: views
 * usuarios/perfis sobre public.wa_project_users e public.user_roles). Usada no navegador
 * (src/lib/app-access.ts) e no servidor (src/lib/authz.ts).
 */
export const APP_KEY = "disparo_massa";
