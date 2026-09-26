-- Invitaciones por link: el jefe/admin de un centro genera un link para que un
-- especialista, secretaria o padre cree su cuenta YA dentro de ese centro.
-- Solo el service role la toca (API del admin y la página pública /invitar/[token]).

create table if not exists public.invitaciones (
  id          uuid primary key default gen_random_uuid(),
  centro_id   uuid not null references public.centros(id) on delete cascade,
  role        text not null check (role in ('especialista', 'secretaria', 'padre')),
  token       text not null unique check (length(token) >= 32),
  email       text,                                           -- si se fija, solo ese correo puede usarla
  child_id    uuid references public.children(id) on delete set null, -- padre: se vincula a este paciente
  specialty   text,
  max_uses    integer not null default 1 check (max_uses between 1 and 50),
  uses        integer not null default 0 check (uses >= 0),
  accepted    jsonb not null default '[]'::jsonb,             -- [{user_id, email, at}]
  expires_at  timestamptz not null,
  revoked_at  timestamptz,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists invitaciones_centro_idx on public.invitaciones (centro_id, created_at desc);

alter table public.invitaciones enable row level security;
revoke all on public.invitaciones from anon, authenticated;

-- Consume un uso de forma atómica (evita que dos registros simultáneos pasen el límite).
create or replace function public.consume_invitacion(p_token text, p_user uuid, p_email text)
returns public.invitaciones
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  r public.invitaciones;
begin
  update public.invitaciones
     set uses = uses + 1,
         accepted = accepted || jsonb_build_array(jsonb_build_object('user_id', p_user, 'email', p_email, 'at', now()))
   where token = p_token
     and revoked_at is null
     and expires_at > now()
     and uses < max_uses
  returning * into r;
  return r;
end;
$$;

revoke execute on function public.consume_invitacion(text, uuid, text) from public, anon, authenticated;
