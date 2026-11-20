-- =============================================================================
-- Personaire — Financial tracking (income & expenses)
-- =============================================================================

alter table public.settings
  add column if not exists currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$');

-- ---------- Money categories (separate from life-area categories) -----------
create table if not exists public.money_categories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind        text not null check (kind in ('income', 'expense')),
  name        text not null check (char_length(name) between 1 and 50),
  icon        text not null default 'tag',
  sort_order  integer not null default 0,
  archived    boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, kind, name)
);

-- ---------- Transactions -----------------------------------------------------
create table if not exists public.transactions (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind               text not null check (kind in ('income', 'expense')),
  amount             numeric(12, 2) not null check (amount > 0),
  occurred_on        date not null default current_date,
  money_category_id  uuid references public.money_categories (id) on delete set null,
  note               text check (note is null or char_length(note) <= 300),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists money_categories_user on public.money_categories (user_id, kind, sort_order);
create index if not exists transactions_user_date on public.transactions (user_id, occurred_on);
create index if not exists transactions_category on public.transactions (money_category_id);

drop trigger if exists set_updated_at on public.money_categories;
create trigger set_updated_at before update on public.money_categories for each row execute function public.set_updated_at();
drop trigger if exists set_updated_at on public.transactions;
create trigger set_updated_at before update on public.transactions for each row execute function public.set_updated_at();

alter table public.money_categories enable row level security;
alter table public.transactions enable row level security;

drop policy if exists "own money categories" on public.money_categories;
create policy "own money categories" on public.money_categories
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "own transactions" on public.transactions;
create policy "own transactions" on public.transactions
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.money_categories, public.transactions to authenticated, service_role;
revoke all on public.money_categories, public.transactions from anon;

-- ---------- Default categories ----------------------------------------------
create or replace function public.seed_money_categories(uid uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.money_categories (user_id, kind, name, icon, sort_order) values
    (uid, 'expense', 'Food',          'utensils',       1),
    (uid, 'expense', 'Transport',     'bus',            2),
    (uid, 'expense', 'Housing',       'house',          3),
    (uid, 'expense', 'Bills',         'receipt',        4),
    (uid, 'expense', 'Shopping',      'shopping-bag',   5),
    (uid, 'expense', 'Health',        'heart-pulse',    6),
    (uid, 'expense', 'Education',     'graduation-cap', 7),
    (uid, 'expense', 'Entertainment', 'music',          8),
    (uid, 'expense', 'Other',         'tag',            9),
    (uid, 'income',  'Salary',        'briefcase',      1),
    (uid, 'income',  'Freelance',     'laptop',         2),
    (uid, 'income',  'Gift',          'gift',           3),
    (uid, 'income',  'Other',         'tag',            4)
  on conflict (user_id, kind, name) do nothing;
$$;
revoke execute on function public.seed_money_categories(uuid) from public, anon, authenticated;

-- Existing users
select public.seed_money_categories(id) from auth.users;

-- New users: extend the sign-up trigger.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.settings (user_id) values (new.id);
  insert into public.categories (user_id, name, icon, sort_order) values
    (new.id, 'Career',    'briefcase',      1),
    (new.id, 'Education', 'graduation-cap', 2),
    (new.id, 'Health',    'heart-pulse',    3),
    (new.id, 'Finance',   'wallet',         4),
    (new.id, 'Personal',  'user',           5);
  perform public.seed_money_categories(new.id);
  return new;
end;
$$;
