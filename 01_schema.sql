-- SPORTIFANO / Supabase PostgreSQL — initial secure schema
-- Run once on a NEW Supabase project using SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.admins (
 user_id uuid primary key references auth.users(id) on delete cascade,
 created_at timestamptz not null default now()
);
create or replace function public.is_store_admin()
returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.admins where user_id = (select auth.uid()));
$$;
revoke all on function public.is_store_admin() from public;
grant execute on function public.is_store_admin() to authenticated;

create table if not exists public.categories (
 id uuid primary key default gen_random_uuid(),
 name text not null, slug text not null unique,
 image_url text, sort_order int not null default 0,
 active boolean not null default true,
 created_at timestamptz not null default now()
);
create table if not exists public.products (
 id uuid primary key default gen_random_uuid(),
 category_id uuid references public.categories(id) on delete set null,
 name text not null, slug text not null unique,
 description text not null default '',
 price numeric(12,3) not null check(price >= 0),
 compare_at_price numeric(12,3) check(compare_at_price is null or compare_at_price >= 0),
 images text[] not null default '{}',
 active boolean not null default true,
 featured boolean not null default false,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.product_variants (
 id uuid primary key default gen_random_uuid(),
 product_id uuid not null references public.products(id) on delete cascade,
 color text not null default '', size text not null default '',
 sku text unique,
 stock integer not null default 0 check(stock >= 0),
 price_override numeric(12,3) check(price_override is null or price_override >= 0),
 unique(product_id,color,size)
);
create table if not exists public.profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 full_name text not null default '', phone text not null default '',
 created_at timestamptz not null default now()
);
create table if not exists public.orders (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id),
 customer_name text not null, customer_phone text not null,
 delivery_address text not null, city text not null,
 notes text not null default '',
 status text not null default 'new' check(status in ('new','confirmed','preparing','shipped','delivered','cancelled')),
 payment_method text not null default 'cod' check(payment_method in ('cod')),
 subtotal numeric(12,3) not null default 0 check(subtotal >= 0),
 delivery_fee numeric(12,3) not null default 0 check(delivery_fee >= 0),
 total numeric(12,3) generated always as (subtotal + delivery_fee) stored,
 created_at timestamptz not null default now()
);
create table if not exists public.order_items (
 id uuid primary key default gen_random_uuid(),
 order_id uuid not null references public.orders(id) on delete cascade,
 product_id uuid references public.products(id) on delete set null,
 variant_id uuid references public.product_variants(id) on delete set null,
 product_name text not null, variant_label text not null default '',
 quantity integer not null check(quantity > 0),
 unit_price numeric(12,3) not null check(unit_price >= 0),
 line_total numeric(12,3) generated always as (quantity * unit_price) stored
);
create table if not exists public.blog_posts (
 id uuid primary key default gen_random_uuid(),
 title text not null, slug text not null unique,
 excerpt text not null default '', body text not null default '',
 image_url text, published boolean not null default false,
 created_at timestamptz not null default now()
);
create table if not exists public.site_settings (
 key text primary key, value jsonb not null default '{}'::jsonb,
 updated_at timestamptz not null default now()
);

alter table public.admins enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.profiles enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.blog_posts enable row level security;
alter table public.site_settings enable row level security;

create policy "admins see their own role" on public.admins for select to authenticated using (user_id = (select auth.uid()));
create policy "categories public visible" on public.categories for select to anon, authenticated using (active or (select public.is_store_admin()));
create policy "categories admin insert" on public.categories for insert to authenticated with check ((select public.is_store_admin()));
create policy "categories admin update" on public.categories for update to authenticated using ((select public.is_store_admin())) with check ((select public.is_store_admin()));
create policy "categories admin delete" on public.categories for delete to authenticated using ((select public.is_store_admin()));

create policy "products public visible" on public.products for select to anon, authenticated using (active or (select public.is_store_admin()));
create policy "products admin insert" on public.products for insert to authenticated with check ((select public.is_store_admin()));
create policy "products admin update" on public.products for update to authenticated using ((select public.is_store_admin())) with check ((select public.is_store_admin()));
create policy "products admin delete" on public.products for delete to authenticated using ((select public.is_store_admin()));

create policy "variants visible for active products" on public.product_variants for select to anon,authenticated using (
 exists(select 1 from public.products p where p.id=product_id and p.active) or (select public.is_store_admin())
);
create policy "variants admin insert" on public.product_variants for insert to authenticated with check ((select public.is_store_admin()));
create policy "variants admin update" on public.product_variants for update to authenticated using ((select public.is_store_admin())) with check ((select public.is_store_admin()));
create policy "variants admin delete" on public.product_variants for delete to authenticated using ((select public.is_store_admin()));

create policy "profiles owner select" on public.profiles for select to authenticated using (user_id=(select auth.uid()) or (select public.is_store_admin()));
create policy "profiles owner insert" on public.profiles for insert to authenticated with check (user_id=(select auth.uid()));
create policy "profiles owner update" on public.profiles for update to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));

create policy "orders owner or admin see" on public.orders for select to authenticated using (user_id=(select auth.uid()) or (select public.is_store_admin()));
create policy "orders admin change" on public.orders for update to authenticated using ((select public.is_store_admin())) with check ((select public.is_store_admin()));
create policy "order items owner or admin see" on public.order_items for select to authenticated using (
 (select public.is_store_admin()) or exists(select 1 from public.orders o where o.id=order_id and o.user_id=(select auth.uid()))
);
-- Orders are created only via secure RPC: no browser INSERT permissions on orders/order_items.

create policy "posts public published" on public.blog_posts for select to anon, authenticated using (published or (select public.is_store_admin()));
create policy "posts admin insert" on public.blog_posts for insert to authenticated with check ((select public.is_store_admin()));
create policy "posts admin update" on public.blog_posts for update to authenticated using ((select public.is_store_admin())) with check ((select public.is_store_admin()));
create policy "posts admin delete" on public.blog_posts for delete to authenticated using ((select public.is_store_admin()));
create policy "settings public read" on public.site_settings for select to anon,authenticated using (true);
create policy "settings admin insert" on public.site_settings for insert to authenticated with check ((select public.is_store_admin()));
create policy "settings admin update" on public.site_settings for update to authenticated using ((select public.is_store_admin())) with check ((select public.is_store_admin()));
create policy "settings admin delete" on public.site_settings for delete to authenticated using ((select public.is_store_admin()));

-- Safe order placement: client may be authenticated or Supabase anonymous sign-in (auth.uid required).
-- No client-supplied unit prices or totals are accepted.
create or replace function public.place_order(
 p_customer_name text, p_customer_phone text, p_delivery_address text,
 p_city text, p_items jsonb, p_notes text default ''
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
 v_uid uuid := (select auth.uid());
 v_order uuid;
 v_subtotal numeric(12,3) := 0;
 v_row jsonb;
 v_variant record;
 v_product record;
 v_qty integer;
 v_count integer := 0;
 v_unit numeric(12,3);
begin
 if v_uid is null then raise exception 'Connexion requise (compte ou session anonyme)'; end if;
 if length(trim(coalesce(p_customer_name,''))) < 2 or length(trim(coalesce(p_customer_phone,''))) < 6
    or length(trim(coalesce(p_delivery_address,''))) < 5 or length(trim(coalesce(p_city,''))) < 2 then
  raise exception 'Coordonnees de livraison incompletes';
 end if;
 if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 30 then
  raise exception 'Panier invalide';
 end if;
 insert into public.orders(user_id,customer_name,customer_phone,delivery_address,city,notes)
 values (v_uid,trim(p_customer_name),trim(p_customer_phone),trim(p_delivery_address),trim(p_city),left(coalesce(p_notes,''),500))
 returning id into v_order;
 for v_row in select value from jsonb_array_elements(p_items) loop
  v_count := v_count + 1;
  if (v_row->>'quantity') !~ '^[0-9]{1,3}$' then raise exception 'Quantite invalide'; end if;
  v_qty := (v_row->>'quantity')::integer;
  if v_qty < 1 or v_qty > 20 then raise exception 'Quantite hors limites'; end if;
  select v.id, v.product_id, v.color, v.size, v.price_override, v.stock
    into v_variant from public.product_variants v
    where v.id = (v_row->>'variant_id')::uuid for update;
  if not found then raise exception 'Variante introuvable'; end if;
  select p.id,p.name,p.price,p.active into v_product
    from public.products p where p.id=v_variant.product_id;
  if not found or not v_product.active then raise exception 'Produit indisponible'; end if;
  if v_variant.stock < v_qty then raise exception 'Stock insuffisant'; end if;
  v_unit := coalesce(v_variant.price_override,v_product.price);
  update public.product_variants set stock=stock-v_qty where id=v_variant.id;
  insert into public.order_items(order_id,product_id,variant_id,product_name,variant_label,quantity,unit_price)
  values (v_order,v_product.id,v_variant.id,v_product.name,concat_ws(' / ',nullif(v_variant.color,''),nullif(v_variant.size,'')),v_qty,v_unit);
  v_subtotal := v_subtotal+(v_unit*v_qty);
 end loop;
 update public.orders set subtotal=v_subtotal where id=v_order;
 return v_order;
end;
$$;
revoke all on function public.place_order(text,text,text,text,jsonb,text) from public;
grant execute on function public.place_order(text,text,text,text,jsonb,text) to authenticated;

create index if not exists products_category_idx on public.products(category_id);
create index if not exists variants_product_idx on public.product_variants(product_id);
create index if not exists orders_user_created_idx on public.orders(user_id,created_at desc);
create index if not exists order_items_order_idx on public.order_items(order_id);

-- After creating your OWN Supabase Auth account, promote its UID in SQL Editor:
-- insert into public.admins(user_id) values ('YOUR-REAL-AUTH-USER-UUID');
-- Never place a password or service_role key in GitHub.
