-- JobTools — fase 2: tabela de compromissos de agenda.
-- Rode no SQL Editor do Supabase. Seguro rodar mais de uma vez.

create table if not exists public.compromissos (
  id           uuid primary key default gen_random_uuid(),
  dono         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  tipo         text not null default 'edicao'
               check (tipo in ('edicao','tratamento','pessoal','outro')),
  job_id       uuid references public.jobs(id) on delete cascade,
  data_inicio  date not null,
  data_fim     date,
  periodo      text not null default 'dia'
               check (periodo in ('dia','manha','tarde','horario')),
  hora_inicio  time,
  hora_fim     time,
  titulo       text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint compromisso_precisa_de_job check (
    (tipo in ('edicao','tratamento') and job_id is not null)
    or tipo in ('pessoal','outro')
  ),
  constraint compromisso_faixa_valida check (
    data_fim is null or data_fim >= data_inicio
  )
);

create index if not exists idx_compromissos_periodo on public.compromissos(dono, data_inicio);
create index if not exists idx_compromissos_job     on public.compromissos(job_id);

drop trigger if exists trg_compromissos_updated on public.compromissos;
create trigger trg_compromissos_updated before update on public.compromissos
  for each row execute function public.tocar_updated_at();

alter table public.compromissos enable row level security;

drop policy if exists p_compromissos_dono on public.compromissos;
create policy p_compromissos_dono on public.compromissos
  for all to authenticated using (dono = auth.uid()) with check (dono = auth.uid());
