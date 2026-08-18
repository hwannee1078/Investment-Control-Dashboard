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

create table if not exists import_batches (
  id text primary key,
  uploaded_at timestamptz not null,
  data jsonb not null,
  created_at timestamptz not null default now()
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
create index if not exists import_batches_uploaded_idx
  on import_batches (uploaded_at desc);
create index if not exists safety_chunks_document_idx
  on safety_document_chunks (document_id);

insert into safety_documents (id, title, source_group, source_name, url, source_date, status, description)
values
  ('law-occupational-safety', '산업안전보건법', 'law', '국가법령정보센터', 'https://www.law.go.kr/법령/산업안전보건법', '2026-01-01', 'approved', '사업주의 안전보건 조치와 위험성평가 관련 법령'),
  ('kosha-chemical-guide', '화학물질 취급 작업 안전보건 기술지침', 'kosha', '한국산업안전보건공단', 'https://www.kosha.or.kr/kosha/data/guidance.do', '2025-10-20', 'approved', '화학물질 취급 작업의 기본 안전조치'),
  ('ministry-risk-assessment', '위험성평가 지침', 'ministry', '고용노동부', 'https://www.moel.go.kr/info/lawinfo/instruction/list.do', '2025-12-15', 'approved', '위험성평가 절차와 기록 관리 기준')
on conflict (id) do nothing;

insert into safety_document_chunks (id, document_id, content, section, page, keywords)
values
  ('law-occupational-safety-1', 'law-occupational-safety', '사업주는 유해·위험요인을 확인하고 근로자의 안전과 건강을 보호하기 위한 조치를 마련해야 합니다.', '위험성평가', null, array['위험성평가', '유해위험요인', '안전보건']),
  ('kosha-chemical-guide-1', 'kosha-chemical-guide', '화학물질 취급 작업 전에는 물질의 유해성을 확인하고 적절한 보호구를 착용하며 누출·비산을 예방하는 조치를 확인해야 합니다.', '화학물질 취급 안전', 7, array['화학물질', '보호구', '누출']),
  ('ministry-risk-assessment-1', 'ministry-risk-assessment', '위험성평가는 유해·위험요인 파악, 위험성 결정, 감소대책 수립과 실행, 결과 기록의 순서로 진행합니다.', '위험성평가 절차', 4, array['위험성평가', '감소대책', '기록'])
on conflict (id) do nothing;
