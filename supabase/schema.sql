-- =========================================================
-- AYYARAPA TRADERS — Shop Management Database Schema
-- Run this whole file once in Supabase SQL Editor
-- (Project → SQL Editor → New query → paste → Run)
-- =========================================================

-- ---------- EXTENSIONS ----------
create extension if not exists "uuid-ossp";

-- ---------- PRODUCTS ----------
create table if not exists products (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  category text default 'General',
  unit text not null default 'KG',              -- Pack / KG / Ton / Piece etc (base display unit)
  pack_to_kg numeric default 0,                  -- 1 Pack = how many KG (0 = not applicable)
  kg_to_ton numeric default 1000,                -- 1 Ton = how many KG (default 1000)
  buying_price numeric not null default 0,
  selling_price numeric not null default 0,
  current_stock numeric not null default 0,      -- always stored in base unit = KG
  min_stock_level numeric not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- CUSTOMERS ----------
create table if not exists customers (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  area text,
  phone text,
  created_at timestamptz not null default now()
);

-- ---------- SUPPLIERS ----------
create table if not exists suppliers (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  area text,
  phone text,
  created_at timestamptz not null default now()
);

-- ---------- PURCHASES (stock loads from suppliers) ----------
create table if not exists purchases (
  id uuid primary key default uuid_generate_v4(),
  supplier_id uuid references suppliers(id) on delete set null,
  product_id uuid references products(id) on delete set null,
  quantity numeric not null,
  unit text not null default 'KG',
  quantity_in_kg numeric not null,               -- converted quantity actually added to stock
  purchase_price numeric not null default 0,     -- price per unit entered
  total_amount numeric not null default 0,
  paid_amount numeric not null default 0,
  pending_amount numeric not null default 0,
  purchase_date date not null default current_date,
  created_at timestamptz not null default now()
);

-- ---------- SALES ----------
create table if not exists sales (
  id uuid primary key default uuid_generate_v4(),
  customer_id uuid references customers(id) on delete set null,
  product_id uuid references products(id) on delete set null,
  quantity numeric not null,
  unit text not null default 'KG',
  quantity_in_kg numeric not null,               -- converted quantity actually removed from stock
  selling_price numeric not null default 0,      -- price per unit entered
  total_amount numeric not null default 0,
  paid_amount numeric not null default 0,
  pending_amount numeric not null default 0,
  sale_date date not null default current_date,
  created_at timestamptz not null default now()
);

-- ---------- CUSTOMER PAYMENTS (partial collections against pending) ----------
create table if not exists customer_payments (
  id uuid primary key default uuid_generate_v4(),
  customer_id uuid references customers(id) on delete cascade,
  sale_id uuid references sales(id) on delete set null,
  amount numeric not null,
  note text,
  payment_date date not null default current_date,
  created_at timestamptz not null default now()
);

-- ---------- SUPPLIER PAYMENTS (what we pay suppliers against pending) ----------
create table if not exists supplier_payments (
  id uuid primary key default uuid_generate_v4(),
  supplier_id uuid references suppliers(id) on delete cascade,
  purchase_id uuid references purchases(id) on delete set null,
  amount numeric not null,
  note text,
  payment_date date not null default current_date,
  created_at timestamptz not null default now()
);

-- ---------- EXPENSES ----------
create table if not exists expenses (
  id uuid primary key default uuid_generate_v4(),
  category text not null,
  amount numeric not null,
  description text,
  expense_date date not null default current_date,
  created_at timestamptz not null default now()
);

-- ---------- STOCK ADJUSTMENTS (manual increase/decrease + audit trail) ----------
create table if not exists stock_adjustments (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid references products(id) on delete cascade,
  change_type text not null check (change_type in ('increase','decrease')),
  quantity_kg numeric not null,
  reason text,
  adjustment_date date not null default current_date,
  created_at timestamptz not null default now()
);

-- ---------- STOCK CONVERSIONS (log of Pack<->KG<->Ton conversions, informational) ----------
create table if not exists stock_conversions (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid references products(id) on delete cascade,
  conversion_type text not null,                 -- 'pack_to_kg' | 'kg_to_ton' | 'ton_to_kg'
  input_quantity numeric not null,
  output_quantity numeric not null,
  conversion_date date not null default current_date,
  created_at timestamptz not null default now()
);

-- ---------- INDEXES ----------
create index if not exists idx_purchases_date on purchases(purchase_date);
create index if not exists idx_sales_date on sales(sale_date);
create index if not exists idx_expenses_date on expenses(expense_date);
create index if not exists idx_sales_customer on sales(customer_id);
create index if not exists idx_purchases_supplier on purchases(supplier_id);
create index if not exists idx_stock_adj_product on stock_adjustments(product_id);

-- =========================================================
-- TRIGGERS: keep stock, pending amounts in sync automatically
-- =========================================================

-- Update products.updated_at
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_products_updated_at on products;
create trigger trg_products_updated_at before update on products
  for each row execute function set_updated_at();

-- Sales: compute pending amount, reduce stock on insert, restore on delete
create or replace function handle_sale_insert() returns trigger as $$
begin
  new.pending_amount := new.total_amount - new.paid_amount;
  update products set current_stock = current_stock - new.quantity_in_kg where id = new.product_id;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_sale_insert on sales;
create trigger trg_sale_insert before insert on sales
  for each row execute function handle_sale_insert();

create or replace function handle_sale_delete() returns trigger as $$
begin
  update products set current_stock = current_stock + old.quantity_in_kg where id = old.product_id;
  return old;
end;
$$ language plpgsql;

drop trigger if exists trg_sale_delete on sales;
create trigger trg_sale_delete after delete on sales
  for each row execute function handle_sale_delete();

-- Purchases: compute pending amount, increase stock on insert, remove on delete
create or replace function handle_purchase_insert() returns trigger as $$
begin
  new.pending_amount := new.total_amount - new.paid_amount;
  update products set current_stock = current_stock + new.quantity_in_kg where id = new.product_id;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_purchase_insert on purchases;
create trigger trg_purchase_insert before insert on purchases
  for each row execute function handle_purchase_insert();

create or replace function handle_purchase_delete() returns trigger as $$
begin
  update products set current_stock = current_stock - old.quantity_in_kg where id = old.product_id;
  return old;
end;
$$ language plpgsql;

drop trigger if exists trg_purchase_delete on purchases;
create trigger trg_purchase_delete after delete on purchases
  for each row execute function handle_purchase_delete();

-- Stock adjustments: apply to product stock
create or replace function handle_stock_adjustment() returns trigger as $$
begin
  if new.change_type = 'increase' then
    update products set current_stock = current_stock + new.quantity_kg where id = new.product_id;
  else
    update products set current_stock = current_stock - new.quantity_kg where id = new.product_id;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_stock_adjustment on stock_adjustments;
create trigger trg_stock_adjustment after insert on stock_adjustments
  for each row execute function handle_stock_adjustment();

-- Customer payments: reduce pending_amount on the linked sale, and keep a running check
create or replace function handle_customer_payment() returns trigger as $$
begin
  if new.sale_id is not null then
    update sales set paid_amount = paid_amount + new.amount,
                      pending_amount = pending_amount - new.amount
    where id = new.sale_id;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_customer_payment on customer_payments;
create trigger trg_customer_payment after insert on customer_payments
  for each row execute function handle_customer_payment();

-- Supplier payments: reduce pending_amount on the linked purchase
create or replace function handle_supplier_payment() returns trigger as $$
begin
  if new.purchase_id is not null then
    update purchases set paid_amount = paid_amount + new.amount,
                          pending_amount = pending_amount - new.amount
    where id = new.purchase_id;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_supplier_payment on supplier_payments;
create trigger trg_supplier_payment after insert on supplier_payments
  for each row execute function handle_supplier_payment();

-- =========================================================
-- ROW LEVEL SECURITY
-- This app is for one shop's private staff (you + trusted helpers).
-- Rule: any logged-in (authenticated) user can read/write all shop data.
-- Nobody who is not logged in can see anything.
-- =========================================================

alter table products enable row level security;
alter table customers enable row level security;
alter table suppliers enable row level security;
alter table purchases enable row level security;
alter table sales enable row level security;
alter table customer_payments enable row level security;
alter table supplier_payments enable row level security;
alter table expenses enable row level security;
alter table stock_adjustments enable row level security;
alter table stock_conversions enable row level security;

do $$
declare
  t text;
begin
  for t in select unnest(array[
    'products','customers','suppliers','purchases','sales',
    'customer_payments','supplier_payments','expenses',
    'stock_adjustments','stock_conversions'
  ])
  loop
    execute format('drop policy if exists "authenticated_full_access" on %I;', t);
    execute format(
      'create policy "authenticated_full_access" on %I for all to authenticated using (true) with check (true);',
      t
    );
  end loop;
end $$;

-- =========================================================
-- REALTIME: allow the app to subscribe to live changes
-- =========================================================
alter publication supabase_realtime add table products, customers, suppliers, purchases, sales, customer_payments, supplier_payments, expenses, stock_adjustments;

-- =========================================================
-- Done. Next steps:
-- 1. Go to Authentication → Providers → make sure Email is enabled.
-- 2. Go to Authentication → Users → Add user (create a login for yourself/staff).
-- 3. Copy your Project URL and anon public key from Settings → API
--    into the app's .env file (see README.md).
-- =========================================================
