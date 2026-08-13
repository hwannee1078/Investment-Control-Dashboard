-- Run in Supabase SQL Editor after the user_roles table is available.
create table if not exists public.agent_audit_logs (
  id text primary key,
  user_id uuid not null references auth.users(id),
  employee_id text not null,
  role text not null check (role in ('viewer', 'staff', 'admin')),
  question text not null,
  tool_name text not null,
  target_project_id text,
  before_data jsonb not null,
  after_data jsonb not null,
  approved boolean not null default false,
  result_code text not null,
  created_at timestamptz not null default now()
);

alter table public.agent_audit_logs enable row level security;

-- Audit evidence is server-owned. No browser/client role may insert, update, or delete rows.
drop policy if exists "users can insert their own agent audit records" on public.agent_audit_logs;
revoke insert, update, delete on public.agent_audit_logs from anon, authenticated;

drop policy if exists "users can read their own agent audit records" on public.agent_audit_logs;
create policy "users can read their own agent audit records"
  on public.agent_audit_logs for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "admins can read all agent audit records" on public.agent_audit_logs;
create policy "admins can read all agent audit records"
  on public.agent_audit_logs for select to authenticated
  using (
    exists (
      select 1 from public.user_roles
      where user_id = auth.uid() and role = 'admin'
    )
  );
