-- ============================================================================
-- JobTools — esquema da FASE 1 (núcleo)
--
-- Como rodar: painel do Supabase -> SQL Editor -> New query -> colar tudo -> Run.
-- É seguro rodar mais de uma vez (tudo é "if not exists" / "or replace").
--
-- REGRA INEGOCIÁVEL: toda tabela nasce com Row Level Security LIGADO.
-- A chave publicável fica visível dentro do código do site, por definição —
-- sem RLS, quem tiver essa chave lê o banco inteiro.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Utilitário: manter updated_at sempre correto
-- ----------------------------------------------------------------------------
create or replace function public.tocar_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- CLIENTES
-- Só "nome" é obrigatório (regra R4): o cadastro precisa caber em dez segundos,
-- no set, com o cliente esperando.
-- ----------------------------------------------------------------------------
create table if not exists public.clientes (
  id                       uuid primary key default gen_random_uuid(),
  dono                     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome                     text not null check (length(trim(nome)) > 0),
  empresa                  text,
  tipo                     text check (tipo in ('pf','pj')),
  cpf_cnpj                 text,
  endereco                 text,
  whatsapp                 text,
  email                    text,
  instagram                text,
  -- Em dias. 0 = à vista. É o que faz a parcela da fase 3 nascer com a data certa.
  prazo_pagamento_dias     integer check (prazo_pagamento_dias >= 0),
  observacoes              text,
  arquivado                boolean not null default false,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

-- Agências têm um produtor e um financeiro, e você fala com os dois.
create table if not exists public.contatos (
  id           uuid primary key default gen_random_uuid(),
  dono         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  cliente_id   uuid not null references public.clientes(id) on delete cascade,
  nome         text not null,
  papel        text,
  telefone     text,
  email        text,
  created_at   timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- JOBS
-- ----------------------------------------------------------------------------
create table if not exists public.jobs (
  id                 uuid primary key default gen_random_uuid(),
  dono               uuid not null default auth.uid() references auth.users(id) on delete cascade,
  cliente_id         uuid not null references public.clientes(id) on delete restrict,
  titulo             text not null check (length(trim(titulo)) > 0),
  tipo               text not null default 'video' check (tipo in ('video','foto','ambos')),

  -- Escopo: três marcações independentes em vez de taxonomia.
  escopo_captacao    boolean not null default true,
  escopo_edicao      boolean not null default true,
  escopo_tratamento  boolean not null default false,

  local              text,
  local_url          text,
  prazo_entrega      date,

  status             text not null default 'orcamento' check (status in (
                       'orcamento','aprovado','captacao','backup','edicao',
                       'com_cliente','ajustes','entregue','concluido',
                       'perdido','cancelado'
                     )),

  -- Fase 3 usa isto para o dinheiro. Fase 1 só guarda (regra R1).
  forma_cobranca     text not null default 'avulso'
                     check (forma_cobranca in ('avulso','incluso','extra')),

  -- O cachê. As parcelas da fase 3 somam contra este número; um job
  -- "incluso no contrato" fica nulo, porque o dinheiro dele já está
  -- na mensalidade e somar os dois contaria duas vezes (regra R1).
  valor_fechado      numeric(10,2) check (valor_fechado >= 0),

  equipe             text,
  briefing           text,

  -- Preenchido quando o job sai do quadro. Cancelado != perdido (regra R3).
  motivo_saida       text,
  saiu_em            timestamptz,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- Um job pode ter várias diárias: evento de dois dias, regravação, extra.
create table if not exists public.job_datas (
  id             uuid primary key default gen_random_uuid(),
  dono           uuid not null default auth.uid() references auth.users(id) on delete cascade,
  job_id         uuid not null references public.jobs(id) on delete cascade,
  data           date not null,
  hora_chamada   time,
  duracao_horas  numeric(4,1) check (duracao_horas > 0),
  observacao     text,
  created_at     timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- COMENTÁRIOS
-- tipo 'nota'      = escrito por você
-- tipo 'historico' = gerado pelo sistema (fase 4), some na mesma linha do tempo
-- ----------------------------------------------------------------------------
create table if not exists public.comentarios (
  id          uuid primary key default gen_random_uuid(),
  dono        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  job_id      uuid not null references public.jobs(id) on delete cascade,
  tipo        text not null default 'nota' check (tipo in ('nota','historico')),
  texto       text not null check (length(trim(texto)) > 0),
  created_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- LINKS
-- Separados dos comentários de propósito: link de backup não pode sumir no scroll.
-- ----------------------------------------------------------------------------
create table if not exists public.links (
  id          uuid primary key default gen_random_uuid(),
  dono        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  job_id      uuid not null references public.jobs(id) on delete cascade,
  rotulo      text not null check (length(trim(rotulo)) > 0),
  url         text not null,
  tipo        text not null default 'entrega'
              check (tipo in ('bruto','backup','entrega','referencia','contrato')),
  validade    date,
  created_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- COMPROMISSOS DE AGENDA (fase 2)
--
-- Seu tempo ocupado que não é captação: blocos de edição reservados para um job
-- e bloqueios pessoais. Todos são compromissos MACIOS (regra R2) — acordos seus
-- com você mesmo, que podem ser remarcados. Captação e prazo de entrega são
-- duros, moram em jobs/job_datas, e não se remarcam sozinhos.
-- ----------------------------------------------------------------------------
create table if not exists public.compromissos (
  id           uuid primary key default gen_random_uuid(),
  dono         uuid not null default auth.uid() references auth.users(id) on delete cascade,

  tipo         text not null default 'edicao'
               check (tipo in ('edicao','tratamento','pessoal','outro')),

  -- Obrigatório quando é edição ou tratamento; vazio quando é folga.
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

-- ============================================================================
-- MIGRAÇÕES
-- Para bancos criados antes de uma coluna existir. O bloco acima cobre bancos
-- novos; este cobre o seu, que já tem dados. Rodar de novo não faz nada.
-- ============================================================================
alter table public.jobs
  add column if not exists valor_fechado numeric(10,2);

-- ----------------------------------------------------------------------------
-- Índices
-- ----------------------------------------------------------------------------
create index if not exists idx_clientes_dono      on public.clientes(dono);
create index if not exists idx_contatos_cliente   on public.contatos(cliente_id);
create index if not exists idx_jobs_cliente       on public.jobs(cliente_id);
create index if not exists idx_jobs_status        on public.jobs(dono, status);
create index if not exists idx_jobs_prazo         on public.jobs(prazo_entrega);
create index if not exists idx_job_datas_job      on public.job_datas(job_id);
create index if not exists idx_job_datas_data     on public.job_datas(dono, data);
create index if not exists idx_comentarios_job    on public.comentarios(job_id);
create index if not exists idx_links_job          on public.links(job_id);
create index if not exists idx_compromissos_periodo on public.compromissos(dono, data_inicio);
create index if not exists idx_compromissos_job      on public.compromissos(job_id);

-- ----------------------------------------------------------------------------
-- Triggers de updated_at
-- ----------------------------------------------------------------------------
drop trigger if exists trg_clientes_updated on public.clientes;
create trigger trg_clientes_updated before update on public.clientes
  for each row execute function public.tocar_updated_at();

drop trigger if exists trg_jobs_updated on public.jobs;
create trigger trg_jobs_updated before update on public.jobs
  for each row execute function public.tocar_updated_at();

drop trigger if exists trg_compromissos_updated on public.compromissos;
create trigger trg_compromissos_updated before update on public.compromissos
  for each row execute function public.tocar_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY
-- Cada linha pertence a um dono. Ninguém enxerga nem grava linha de outro,
-- mesmo de posse da chave publicável.
-- ============================================================================
alter table public.clientes    enable row level security;
alter table public.contatos    enable row level security;
alter table public.jobs        enable row level security;
alter table public.job_datas   enable row level security;
alter table public.comentarios enable row level security;
alter table public.links       enable row level security;
alter table public.compromissos enable row level security;

drop policy if exists p_clientes_dono on public.clientes;
create policy p_clientes_dono on public.clientes
  for all to authenticated using (dono = auth.uid()) with check (dono = auth.uid());

drop policy if exists p_contatos_dono on public.contatos;
create policy p_contatos_dono on public.contatos
  for all to authenticated using (dono = auth.uid()) with check (dono = auth.uid());

drop policy if exists p_jobs_dono on public.jobs;
create policy p_jobs_dono on public.jobs
  for all to authenticated using (dono = auth.uid()) with check (dono = auth.uid());

drop policy if exists p_job_datas_dono on public.job_datas;
create policy p_job_datas_dono on public.job_datas
  for all to authenticated using (dono = auth.uid()) with check (dono = auth.uid());

drop policy if exists p_comentarios_dono on public.comentarios;
create policy p_comentarios_dono on public.comentarios
  for all to authenticated using (dono = auth.uid()) with check (dono = auth.uid());

drop policy if exists p_links_dono on public.links;
create policy p_links_dono on public.links
  for all to authenticated using (dono = auth.uid()) with check (dono = auth.uid());

drop policy if exists p_compromissos_dono on public.compromissos;
create policy p_compromissos_dono on public.compromissos
  for all to authenticated using (dono = auth.uid()) with check (dono = auth.uid());

-- ============================================================================
-- Conferência: rode isto depois e confirme que rls = true nas sete linhas.
--   select tablename, rowsecurity as rls
--   from pg_tables where schemaname = 'public' order by tablename;
-- ============================================================================
