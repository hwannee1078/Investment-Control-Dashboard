-- Offline phase-1 schema. The API layer will own all access in the next phase.
create extension if not exists pgcrypto;

create table if not exists app_users (
  id uuid primary key default gen_random_uuid(),
  employee_id text not null unique,
  password_hash text not null,
  role text not null default 'viewer' check (role in ('viewer', 'staff', 'admin')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists projects (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists investment_transactions (
  source_id text not null,
  row_id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (source_id, row_id)
);

create table if not exists order_mappings (
  order_id text primary key,
  project_id text not null references projects(id) on delete cascade,
  updated_at timestamptz not null default now()
);

create table if not exists project_finalizations (
  project_id text primary key references projects(id) on delete cascade,
  finalized boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists safety_documents (
  id text primary key,
  title text not null,
  source_group text not null,
  source_name text not null,
  url text,
  source_date date,
  status text not null default 'pending',
  description text,
  created_at timestamptz not null default now()
);

create table if not exists safety_document_chunks (
  id text primary key,
  document_id text not null references safety_documents(id) on delete cascade,
  content text not null,
  section text,
  page integer,
  keywords text[] not null default '{}'
);

create index if not exists investment_transactions_source_idx
  on investment_transactions (source_id);
create index if not exists order_mappings_project_idx
  on order_mappings (project_id);
create index if not exists safety_chunks_document_idx
  on safety_document_chunks (document_id);
