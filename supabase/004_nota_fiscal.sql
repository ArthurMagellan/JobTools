-- ============================================================================
-- JobTools — data de emissão da nota fiscal
-- Rode no SQL Editor do Supabase. Seguro rodar mais de uma vez.
--
-- Muita empresa só começa a contar o prazo a partir da emissão da nota: emitiu
-- dia 20 com prazo de 30 dias, o dinheiro cai dia 20 do mês seguinte, não 30
-- dias depois de o trabalho ter sido entregue. Guardar a data da emissão é o
-- que permite recalcular o vencimento sozinho.
-- ============================================================================

alter table public.parcelas
  add column if not exists data_nf date;

create index if not exists idx_parcelas_nf on public.parcelas(dono, nf_emitida);
