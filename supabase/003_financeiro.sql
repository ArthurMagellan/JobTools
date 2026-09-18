-- ============================================================================
-- JobTools — fase 3: contratos e parcelas
-- Rode no SQL Editor do Supabase. Seguro rodar mais de uma vez.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- CONTRATOS (mensalistas)
-- A fonte da receita previsível: o que entra todo mês antes de você fechar
-- qualquer trabalho novo.
-- ----------------------------------------------------------------------------
create table if not exists public.contratos (
  id              uuid primary key default gen_random_uuid(),
  dono            uuid not null default auth.uid() references auth.users(id) on delete cascade,
  cliente_id      uuid not null references public.clientes(id) on delete restrict,

  descricao       text not null check (length(trim(descricao)) > 0),
  valor_mensal    numeric(10,2) not null check (valor_mensal >= 0),
  dia_vencimento  integer not null default 10 check (dia_vencimento between 1 and 28),

  data_inicio     date not null,
  data_fim        date,

  escopo_incluso  text,
  status          text not null default 'ativo'
                  check (status in ('ativo','pausado','encerrado')),

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint contrato_faixa_valida check (data_fim is null or data_fim >= data_inicio)
);

-- ----------------------------------------------------------------------------
-- PARCELAS
--
-- Registro próprio porque a DATA MUDA: a previsão nasce estimada pelo prazo
-- padrão do cliente e vira confirmada quando o financeiro avisa (regra R5).
--
-- Cada parcela vem de um job avulso OU de um contrato, nunca dos dois — é o
-- que impede contar o mesmo dinheiro duas vezes (regra R1).
-- ----------------------------------------------------------------------------
create table if not exists public.parcelas (
  id             uuid primary key default gen_random_uuid(),
  dono           uuid not null default auth.uid() references auth.users(id) on delete cascade,

  job_id         uuid references public.jobs(id) on delete cascade,
  contrato_id    uuid references public.contratos(id) on delete cascade,

  -- Primeiro dia do mês de referência. Só para mensalidade: é o que impede
  -- gerar a mesma parcela duas vezes.
  competencia    date,

  descricao      text,
  valor          numeric(10,2) not null check (valor >= 0),

  data_prevista  date not null,

  -- Estimada -> confirmada pelo financeiro -> paga. Estimativa e confirmação
  -- nunca aparecem somadas num número só (regra R5).
  confianca      text not null default 'estimada'
                 check (confianca in ('estimada','confirmada','paga')),

  data_efetiva   date,
  forma          text check (forma in ('pix','boleto','transferencia','dinheiro','outro')),
  nota           text,

  nf_emitida     boolean not null default false,
  nf_numero      text,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint parcela_origem_unica check (
    (job_id is not null and contrato_id is null)
    or (job_id is null and contrato_id is not null)
  ),
  constraint parcela_paga_tem_data check (
    confianca <> 'paga' or data_efetiva is not null
  )
);

-- Uma mensalidade por contrato por mês. É o que torna a geração automática
-- segura de repetir: rodar de novo não duplica nada.
create unique index if not exists uq_parcela_contrato_competencia
  on public.parcelas(contrato_id, competencia)
  where contrato_id is not null;

create index if not exists idx_contratos_cliente   on public.contratos(cliente_id);
create index if not exists idx_contratos_status    on public.contratos(dono, status);
create index if not exists idx_parcelas_prevista   on public.parcelas(dono, data_prevista);
create index if not exists idx_parcelas_job        on public.parcelas(job_id);
create index if not exists idx_parcelas_contrato   on public.parcelas(contrato_id);

drop trigger if exists trg_contratos_updated on public.contratos;
create trigger trg_contratos_updated before update on public.contratos
  for each row execute function public.tocar_updated_at();

drop trigger if exists trg_parcelas_updated on public.parcelas;
create trigger trg_parcelas_updated before update on public.parcelas
  for each row execute function public.tocar_updated_at();

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table public.contratos enable row level security;
alter table public.parcelas  enable row level security;

drop policy if exists p_contratos_dono on public.contratos;
create policy p_contratos_dono on public.contratos
  for all to authenticated using (dono = auth.uid()) with check (dono = auth.uid());

drop policy if exists p_parcelas_dono on public.parcelas;
create policy p_parcelas_dono on public.parcelas
  for all to authenticated using (dono = auth.uid()) with check (dono = auth.uid());

-- ----------------------------------------------------------------------------
-- Vínculo do job com o contrato
-- Um job "incluso no contrato" não tem valor próprio: o dinheiro dele já está
-- na mensalidade (regra R1).
-- ----------------------------------------------------------------------------
alter table public.jobs
  add column if not exists contrato_id uuid references public.contratos(id) on delete set null;

create index if not exists idx_jobs_contrato on public.jobs(contrato_id);
