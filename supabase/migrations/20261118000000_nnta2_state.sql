-- nnta2: estado compartido de la presentación (lámina y paso) para el control remoto.
-- Tablas propias, separadas de slideshow_state (AI-EXPO), para no interferir con ese proyecto.
--
-- Seguridad:
--   * Cualquiera puede LEER el estado (el proyector lo necesita), pero nadie puede escribir en la tabla directamente.
--   * El estado solo cambia con nnta2_set(), que compara la clave del panel con un hash bcrypt.
--   * La tabla de claves (nnta2_secret) no es accesible desde la API.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.nnta2_state (
  id          text primary key,
  slide       integer not null default 1 check (slide between 1 and 200),
  step        integer not null default 0 check (step between 0 and 50),
  steps       integer[],  -- pasos de cada lámina (para avanzar/retroceder desde la app Android)
  updated_at  timestamptz not null default now()
);

create table if not exists public.nnta2_secret (
  id        text primary key references public.nnta2_state (id) on delete cascade,
  pin_hash  text not null,
  recent    text[]  -- últimas pulsaciones aplicadas (evita repetirlas si la app reintenta)
);

-- Por si las tablas se crearon con una versión anterior de este archivo
alter table public.nnta2_state  add column if not exists steps integer[];
alter table public.nnta2_secret add column if not exists recent text[];

alter table public.nnta2_state  enable row level security;
alter table public.nnta2_secret enable row level security;

revoke all on public.nnta2_state  from anon, authenticated;
revoke all on public.nnta2_secret from anon, authenticated;
grant select on public.nnta2_state to anon, authenticated;

drop policy if exists "nnta2_state lectura publica" on public.nnta2_state;
create policy "nnta2_state lectura publica" on public.nnta2_state
  for select to anon, authenticated using (true);
-- nnta2_secret no tiene políticas: con RLS activo y sin permisos, la API no puede leerla.

-- ¿La clave es correcta? (la usa el panel antes de mostrar los controles)
create or replace function public.nnta2_check(p_deck text, p_pin text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  ok boolean;
begin
  select s.pin_hash = extensions.crypt(coalesce(p_pin, ''), s.pin_hash)
    into ok
    from public.nnta2_secret s
   where s.id = p_deck;
  if not coalesce(ok, false) then
    perform pg_sleep(0.8); -- frena los intentos por fuerza bruta
    return false;
  end if;
  return true;
end;
$$;

-- Cambia la lámina y el paso (solo con la clave correcta)
create or replace function public.nnta2_set(p_deck text, p_pin text, p_slide integer, p_step integer)
returns table (slide integer, step integer)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not public.nnta2_check(p_deck, p_pin) then
    raise exception 'Clave incorrecta' using errcode = '28P01';
  end if;
  return query
    update public.nnta2_state t
       set slide = greatest(1, least(coalesce(p_slide, 1), 200)),
           step = greatest(0, least(coalesce(p_step, 0), 50)),
           updated_at = now()
     where t.id = p_deck
    returning t.slide, t.step;
end;
$$;

-- Avanza (p_delta > 0) o retrocede (p_delta < 0) paso a paso, cruzando de lámina cuando hace falta.
-- La usa la app Android: cada pulsación manda +1 o −1 con un identificador único (p_req); si la app
-- reintenta una pulsación que ya se aplicó, no se aplica dos veces. Con p_delta = 0 solo devuelve el estado.
create or replace function public.nnta2_move(p_deck text, p_pin text, p_delta integer, p_req text default null)
returns table (slide integer, step integer, total integer, pasos integer)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_slide integer;
  v_step  integer;
  v_steps integer[];
  v_n     integer;
  v_seen  text[];
  i       integer;
begin
  if not public.nnta2_check(p_deck, p_pin) then
    raise exception 'Clave incorrecta' using errcode = '28P01';
  end if;

  select t.slide, t.step, t.steps into v_slide, v_step, v_steps
    from public.nnta2_state t
   where t.id = p_deck
     for update;
  if not found then
    raise exception 'No existe la presentación %', p_deck using errcode = 'P0002';
  end if;
  v_n := coalesce(cardinality(v_steps), 0);
  if v_n > 0 then
    v_slide := least(greatest(v_slide, 1), v_n);
    v_step := least(greatest(v_step, 0), v_steps[v_slide]);
  end if;

  select coalesce(s.recent, '{}'::text[]) into v_seen from public.nnta2_secret s where s.id = p_deck for update;
  if p_req is not null and p_req = any (v_seen) then
    return query select v_slide, v_step, v_n, coalesce(v_steps[v_slide], 0); -- reintento ya aplicado
    return;
  end if;

  for i in 1 .. least(abs(coalesce(p_delta, 0)), 100) loop
    if p_delta > 0 then
      if v_n = 0 then
        v_slide := least(v_slide + 1, 200); v_step := 0;
      elsif v_step < v_steps[v_slide] then
        v_step := v_step + 1;
      elsif v_slide < v_n then
        v_slide := v_slide + 1; v_step := 0;
      end if;
    else
      if v_step > 0 then
        v_step := v_step - 1;
      elsif v_slide > 1 then
        v_slide := v_slide - 1;
        v_step := case when v_n = 0 then 0 else v_steps[v_slide] end;
      end if;
    end if;
  end loop;

  update public.nnta2_state t set slide = v_slide, step = v_step, updated_at = now() where t.id = p_deck;
  if p_req is not null then
    update public.nnta2_secret s
       set recent = v_seen[greatest(1, cardinality(v_seen) - 18):] || p_req
     where s.id = p_deck;
  end if;
  return query select v_slide, v_step, v_n, coalesce(v_steps[v_slide], 0);
end;
$$;

revoke all on function public.nnta2_check(text, text) from public;
revoke all on function public.nnta2_set(text, text, integer, integer) from public;
revoke all on function public.nnta2_move(text, text, integer, text) from public;
grant execute on function public.nnta2_check(text, text) to anon, authenticated;
grant execute on function public.nnta2_set(text, text, integer, integer) to anon, authenticated;
grant execute on function public.nnta2_move(text, text, integer, text) to anon, authenticated;

-- Avisos en tiempo real para el proyector y los paneles
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'nnta2_state'
  ) then
    alter publication supabase_realtime add table public.nnta2_state;
  end if;
end;
$$;

-- Pasos por lámina según js/deck.js (si cambias el contenido, actualiza este arreglo)
insert into public.nnta2_state (id, steps) values ('ta2-caso4', '{1,4,3,3,3,2,4,5,15,5,6,4,4,5}')
on conflict (id) do update set steps = excluded.steps;

-- ---------------------------------------------------------------------------------------------
-- CLAVE DEL PANEL: ejecútalo tú en el SQL Editor de Supabase, cambiando TU_CLAVE por la clave del grupo.
-- No la guardes en el repositorio. Usa al menos 6 caracteres.
--
-- insert into public.nnta2_secret (id, pin_hash)
-- values ('ta2-caso4', extensions.crypt('TU_CLAVE', extensions.gen_salt('bf')))
-- on conflict (id) do update set pin_hash = excluded.pin_hash;
-- ---------------------------------------------------------------------------------------------
