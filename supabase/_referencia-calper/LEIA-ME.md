# Referência: banco do Supabase da Calper (não usar)

Até 17/10/2026 este app rodava no Supabase da Calper (`cjofyxgcuvpeeslkfawu`, schema `public`).
Por decisão do Wagner, o Imobenviomassa passou a ser **independente**: tudo foi recriado no Supabase
ImobSystem (`ikvjaowvpvxojvcfwnct`), schema `imobenviomassa`, em `supabase/imobsystem/`.

Estes arquivos ficam só como consulta da lógica original, **sem nenhuma alteração**:

- `migrations/` e `pos-migracao/`: as migrations aplicadas no projeto da Calper;
- `config.toml`: a configuração original (com a seção `[auth]` da Calper).

Ficam fora de `supabase/migrations` de propósito: com o `project_id` do ikvj, um `supabase db push` os
aplicaria no banco compartilhado do ImobSystem.
