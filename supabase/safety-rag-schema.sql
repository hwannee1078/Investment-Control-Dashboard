-- Run in Supabase SQL Editor after reviewing for your project.
create extension if not exists vector with schema extensions;

create table if not exists public.safety_documents (
  id text primary key,
  title text not null,
  source_group text not null check (source_group in ('law', 'ministry', 'kosha', 'internal')),
  source_name text not null,
  url text not null,
  source_date date not null,
  status text not null default 'pending' check (status in ('pending', 'approved')),
  description text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.safety_document_chunks (
  id text primary key,
  document_id text not null references public.safety_documents(id) on delete cascade,
  content text not null,
  section text not null,
  page integer,
  keywords text[] not null default '{}',
  embedding extensions.vector(1536),
  created_at timestamptz not null default now()
);

alter table public.safety_documents enable row level security;
alter table public.safety_document_chunks enable row level security;

create policy "approved safety documents readable by signed in users" on public.safety_documents
  for select to authenticated using (status = 'approved');
create policy "approved safety chunks readable by signed in users" on public.safety_document_chunks
  for select to authenticated using (exists (select 1 from public.safety_documents d where d.id = document_id and d.status = 'approved'));

create or replace function public.match_safety_chunks(query_embedding extensions.vector(1536), match_count integer default 5)
returns table (id text, document_id text, content text, section text, page integer, similarity float)
language sql stable security invoker set search_path = public, extensions
as $$
  select c.id, c.document_id, c.content, c.section, c.page,
    1 - (c.embedding <=> query_embedding) as similarity
  from public.safety_document_chunks c
  join public.safety_documents d on d.id = c.document_id
  where d.status = 'approved' and c.embedding is not null
  order by c.embedding <=> query_embedding
  limit greatest(1, least(match_count, 20));
$$;

grant execute on function public.match_safety_chunks(extensions.vector(1536), integer) to authenticated;
