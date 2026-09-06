create extension if not exists pgcrypto;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  barcode text unique,
  category text default '',
  unit text not null default 'adet',
  notes text default '',
  min_stock integer not null default 0,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.batches (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  lot_no text default '',
  expiry_date date not null,
  quantity integer not null default 0 check (quantity >= 0),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.stock_movements (
  id bigint generated always as identity primary key,
  batch_id uuid references public.batches(id) on delete set null,
  product_id uuid references public.products(id) on delete set null,
  delta integer not null,
  user_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.push_subscriptions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create table if not exists public.notification_log (
  id bigint generated always as identity primary key,
  batch_id uuid not null references public.batches(id) on delete cascade,
  notification_type text not null,
  sent_on date not null default current_date,
  unique(batch_id, notification_type, sent_on)
);

alter table public.products enable row level security;
alter table public.batches enable row level security;
alter table public.stock_movements enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notification_log enable row level security;

create policy "auth users products read" on public.products for select to authenticated using (true);
create policy "auth users products insert" on public.products for insert to authenticated with check (true);
create policy "auth users products update" on public.products for update to authenticated using (true) with check (true);
create policy "auth users products delete" on public.products for delete to authenticated using (true);

create policy "auth users batches read" on public.batches for select to authenticated using (true);
create policy "auth users batches insert" on public.batches for insert to authenticated with check (true);
create policy "auth users batches update" on public.batches for update to authenticated using (true) with check (true);
create policy "auth users batches delete" on public.batches for delete to authenticated using (true);

create policy "auth users movements read" on public.stock_movements for select to authenticated using (true);
create policy "auth users movements insert" on public.stock_movements for insert to authenticated with check (true);

create policy "own subscriptions read" on public.push_subscriptions for select to authenticated using (auth.uid() = user_id);
create policy "own subscriptions insert" on public.push_subscriptions for insert to authenticated with check (auth.uid() = user_id);
create policy "own subscriptions update" on public.push_subscriptions for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own subscriptions delete" on public.push_subscriptions for delete to authenticated using (auth.uid() = user_id);

create or replace function public.change_batch_quantity(p_batch_id uuid, p_delta integer, p_user_id uuid)
returns void
language plpgsql
security invoker
as $$
declare
  v_product uuid;
  v_qty integer;
begin
  select product_id, quantity into v_product, v_qty from public.batches where id = p_batch_id for update;
  if v_product is null then raise exception 'Parti bulunamadı'; end if;
  if v_qty + p_delta < 0 then raise exception 'Stok 0 altına düşemez'; end if;
  update public.batches set quantity = quantity + p_delta where id = p_batch_id;
  insert into public.stock_movements(batch_id, product_id, delta, user_id) values (p_batch_id, v_product, p_delta, p_user_id);
end;
$$;

grant execute on function public.change_batch_quantity(uuid, integer, uuid) to authenticated;
