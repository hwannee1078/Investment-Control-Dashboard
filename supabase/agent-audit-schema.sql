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

create policy "users can insert their own agent audit records"
  on public.agent_audit_logs for insert to authenticated
  with check (auth.uid() = user_id);

create policy "users can read their own agent audit records"
  on public.agent_audit_logs for select to authenticated
  using (auth.uid() = user_id);

create policy "admins can read all agent audit records"
  on public.agent_audit_logs for select to authenticated
  using (
    exists (
      select 1 from public.user_roles
      where user_id = auth.uid() and role = 'admin'
    )
  );
