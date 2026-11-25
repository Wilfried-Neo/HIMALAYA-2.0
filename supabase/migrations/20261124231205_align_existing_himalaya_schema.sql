-- Align the existing HIMALAYA project with the storefront integration.
-- Additive and data-preserving: keep the legacy public.settings table and
-- retain existing products, orders, and auth users.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.products (
  id text primary key,
  name text not null check (length(name) between 1 and 160),
  format text not null default '',
  price numeric not null default 0 check (price >= 0),
  stock integer not null default 0 check (stock >= 0),
  available boolean not null default true,
  img text not null default 'images/marque-eau.jpg',
  description text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.products
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.shop_settings (
  id boolean primary key default true check (id),
  shop_name text not null default 'Himalaya — Eau Minérale Naturelle',
  whatsapp text not null default '2250709607381',
  address text not null default 'Abidjan, Côte d’Ivoire',
  delivery_enabled boolean not null default true,
  zones jsonb not null default '[]'::jsonb check (jsonb_typeof(zones) = 'array'),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id text primary key default (gen_random_uuid())::text,
  code text,
  created_at timestamptz not null default now(),
  status text not null default 'attente',
  mode text not null,
  payment text not null default 'especes',
  customer jsonb not null,
  delivery_fee numeric not null default 0,
  items jsonb not null,
  total numeric not null default 0
);

-- The pre-existing orders table uses text IDs and has no public tracking code.
-- Keep the old IDs as codes for any legacy rows, then generate secure codes for new orders.
alter table public.orders alter column id set default (gen_random_uuid())::text;
alter table public.orders add column if not exists code text;
update public.orders set code = id where code is null;
alter table public.orders alter column code set default
  ('HLY-' || upper(substr(encode(extensions.gen_random_bytes(8), 'hex'), 1, 16)));
alter table public.orders alter column code set not null;
create unique index if not exists orders_code_idx on public.orders (code);
create index if not exists orders_created_at_idx on public.orders (created_at desc);

-- Preserve the existing function name for any already-connected admin UI,
-- but make the membership check SECURITY INVOKER and limited to the caller's own row.
create or replace function public.is_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1 from public.admin_users a where a.user_id = (select auth.uid())
  );
$$;

create or replace function public.is_himalaya_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1 from public.admin_users a where a.user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;
revoke all on function public.is_himalaya_admin() from public, anon;
grant execute on function public.is_himalaya_admin() to authenticated;

alter table public.products enable row level security;
alter table public.shop_settings enable row level security;
alter table public.admin_users enable row level security;
alter table public.orders enable row level security;

-- Replace the known legacy policies with narrowly scoped equivalents.
drop policy if exists "Produits publics disponibles" on public.products;
drop policy if exists "public reads available products" on public.products;
drop policy if exists "Gestion admin produits" on public.products;
drop policy if exists "admins manage products" on public.products;
create policy "public reads available products" on public.products
  for select to anon, authenticated using (available);
create policy "admins manage products" on public.products
  for all to authenticated using ((select public.is_himalaya_admin()))
  with check ((select public.is_himalaya_admin()));

drop policy if exists "public reads shop settings" on public.shop_settings;
drop policy if exists "admins manage shop settings" on public.shop_settings;
create policy "public reads shop settings" on public.shop_settings
  for select to anon, authenticated using (true);
create policy "admins manage shop settings" on public.shop_settings
  for all to authenticated using ((select public.is_himalaya_admin()))
  with check ((select public.is_himalaya_admin()));

drop policy if exists "Gestion admin commandes" on public.orders;
drop policy if exists "admins read orders" on public.orders;
create policy "admins read orders" on public.orders
  for select to authenticated using ((select public.is_himalaya_admin()));

drop policy if exists "Voir son propre compte admin" on public.admin_users;
drop policy if exists "admins read admin membership" on public.admin_users;
create policy "admins read admin membership" on public.admin_users
  for select to authenticated using (user_id = (select auth.uid()));

-- Use a singleton shop settings row; do not overwrite administrator edits on reruns.
insert into public.products (id, name, format, price, stock, available, img, description)
values
  ('p50cl', 'Bouteille 50cl', '50 cl', 100, 50, true, 'images/bouteille-50cl.jpg', 'Format individuel, idéal pour les déplacements.'),
  ('p15l', 'Bouteille 1,5L', '1,5 L', 800, 50, true, 'images/bouteille-15l.jpg', 'Le format familial pour tous les jours.'),
  ('p6x15l', 'Pack 6 × 1,5L', '6 × 1,5 L', 4000, 30, true, 'images/pack-6x15l.jpg', 'L’économique : une semaine d’eau pour la famille.'),
  ('p5l', 'Bonbonne 5L', '5 L', 3500, 20, true, 'images/bonbonne-5l.jpg', 'Avec robinet : parfaite pour la maison et le bureau.')
on conflict (id) do nothing;

insert into public.shop_settings (id, shop_name, whatsapp, address, delivery_enabled, zones)
values (
  true,
  'Himalaya — Eau Minérale Naturelle',
  '2250709607381',
  'Abidjan, Côte d’Ivoire',
  true,
  '[{"name":"Plateau – Adjamé – Attécoubé","fee":1000},{"name":"Cocody – Riviera","fee":1000},{"name":"Marcory – Treichville – Koumassi","fee":1000},{"name":"Yopougon","fee":1500},{"name":"Abobo – Anyama","fee":1500},{"name":"Port-Bouët – Vridi","fee":1500},{"name":"Bingerville – Grand Abidjan","fee":2000}]'::jsonb
) on conflict (id) do nothing;

-- The browser supplies product IDs and quantities only. Prices, delivery fees,
-- totals, stock and order references are derived and locked in PostgreSQL.
create or replace function public.create_himalaya_order(
  p_customer jsonb,
  p_mode text,
  p_zone text,
  p_date text,
  p_slot text,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_product public.products%rowtype;
  v_items jsonb := '[]'::jsonb;
  v_qty integer;
  v_total numeric := 0;
  v_fee numeric := 0;
  v_code text;
  v_order public.orders%rowtype;
  v_name text;
  v_phone text;
  v_phone_digits text;
  v_address text;
  v_zone_count integer;
  v_delivery_enabled boolean;
  v_item_count integer;
  v_distinct_count integer;
begin
  if p_customer is null or p_items is null or
     jsonb_typeof(p_customer) <> 'object' or jsonb_typeof(p_items) <> 'array' then
    raise exception 'Données de commande invalides';
  end if;
  v_item_count := jsonb_array_length(p_items);
  select count(distinct value->>'id') into v_distinct_count from jsonb_array_elements(p_items);
  if v_item_count < 1 or v_item_count > 50 or v_distinct_count <> v_item_count then
    raise exception 'Panier invalide';
  end if;

  v_name := btrim(coalesce(p_customer->>'name', ''));
  v_phone := btrim(coalesce(p_customer->>'phone', ''));
  v_phone_digits := regexp_replace(v_phone, '[^0-9]', '', 'g');
  v_address := btrim(coalesce(p_customer->>'address', ''));
  if length(v_name) < 2 or length(v_name) > 160 or
     v_phone_digits !~ '^(0[0-9]{9}|2250[0-9]{9})$' then
    raise exception 'Coordonnées invalides';
  end if;
  if length(coalesce(p_date, '')) < 1 or length(p_date) > 80 or
     coalesce(p_slot, '') not in ('09h – 12h', '12h – 15h', '15h – 18h', '18h – 20h') then
    raise exception 'Date ou créneau invalide';
  end if;
  if coalesce(p_mode, '') not in ('livraison', 'retrait') then
    raise exception 'Mode de réception invalide';
  end if;

  select delivery_enabled into v_delivery_enabled
  from public.shop_settings where id = true;
  if p_mode = 'livraison' then
    if not coalesce(v_delivery_enabled, false) or length(v_address) < 3 or length(v_address) > 500 then
      raise exception 'Livraison indisponible ou adresse invalide';
    end if;
    select count(*), coalesce(max((z->>'fee')::numeric), 0)
      into v_zone_count, v_fee
      from public.shop_settings s, jsonb_array_elements(s.zones) z
      where s.id = true and z->>'name' = p_zone;
    if v_zone_count <> 1 then raise exception 'Zone de livraison invalide'; end if;
  elsif coalesce(p_zone, '') <> '' then
    raise exception 'Zone inattendue pour un retrait';
  end if;

  for v_item in
    select value from jsonb_array_elements(p_items) order by value->>'id'
  loop
    if coalesce(v_item->>'id', '') = '' or coalesce(v_item->>'qty', '') !~ '^[1-9][0-9]{0,3}$' then
      raise exception 'Article ou quantité invalide';
    end if;
    v_qty := (v_item->>'qty')::integer;
    select * into v_product from public.products
      where id = v_item->>'id' and available = true for update;
    if not found then raise exception 'Un produit n’est plus disponible'; end if;
    if v_product.stock < v_qty then raise exception 'Stock insuffisant pour: %', v_product.name; end if;

    update public.products set stock = stock - v_qty, updated_at = now() where id = v_product.id;
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'id', v_product.id, 'name', v_product.name, 'format', v_product.format,
      'price', v_product.price, 'qty', v_qty
    ));
    v_total := v_total + v_product.price * v_qty;
  end loop;

  v_code := 'HLY-' || upper(substr(encode(extensions.gen_random_bytes(8), 'hex'), 1, 16));
  insert into public.orders (code, mode, payment, customer, delivery_fee, items, total)
  values (
    v_code, p_mode, 'especes',
    jsonb_build_object('name', v_name, 'phone', v_phone, 'address', v_address,
      'zone', coalesce(p_zone, ''), 'date', p_date, 'slot', p_slot),
    case when p_mode = 'livraison' then v_fee else 0 end,
    v_items,
    v_total + case when p_mode = 'livraison' then v_fee else 0 end
  ) returning * into v_order;

  return jsonb_build_object(
    'id', v_order.id, 'code', v_order.code, 'created_at', v_order.created_at, 'status', v_order.status,
    'mode', v_order.mode, 'payment', v_order.payment, 'customer', v_order.customer,
    'delivery_fee', v_order.delivery_fee, 'items', v_order.items, 'total', v_order.total
  );
end;
$$;

create or replace function public.track_himalaya_order(p_code text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', o.id, 'code', o.code, 'created_at', o.created_at, 'status', o.status, 'mode', o.mode,
    'customer', jsonb_build_object('date', o.customer->>'date', 'slot', o.customer->>'slot'),
    'items', o.items, 'total', o.total
  )
  from public.orders o
  where o.code = upper(btrim(coalesce(p_code, '')))
  limit 1;
$$;

create or replace function public.admin_set_himalaya_order_status(p_order_id text, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_item jsonb;
begin
  if not coalesce(public.is_himalaya_admin(), false) then raise exception 'Non autorisé'; end if;
  if p_status not in ('attente', 'preparation', 'livraison', 'prete', 'terminee', 'annulee') then
    raise exception 'Statut invalide';
  end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Commande introuvable'; end if;
  if v_order.status = 'annulee' then raise exception 'Une commande annulée ne peut plus être modifiée'; end if;
  if p_status = 'annulee' then
    for v_item in select value from jsonb_array_elements(v_order.items) order by value->>'id' loop
      update public.products set stock = stock + (v_item->>'qty')::integer, updated_at = now()
        where id = v_item->>'id';
    end loop;
  end if;
  update public.orders set status = p_status where id = p_order_id;
end;
$$;

revoke all on function public.create_himalaya_order(jsonb, text, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.create_himalaya_order(jsonb, text, text, text, text, jsonb) to service_role;
revoke all on function public.track_himalaya_order(text) from public;
grant execute on function public.track_himalaya_order(text) to anon, authenticated;
revoke all on function public.admin_set_himalaya_order_status(text, text) from public, anon;
grant execute on function public.admin_set_himalaya_order_status(text, text) to authenticated;

-- Explicit table privileges complement RLS and keep orders/admin rows private.
revoke all on public.products, public.shop_settings, public.orders, public.admin_users from public;
revoke all on public.products, public.shop_settings, public.orders, public.admin_users from anon;
grant select on public.products, public.shop_settings to anon, authenticated;
grant insert, update, delete on public.products, public.shop_settings to authenticated;
grant select on public.orders, public.admin_users to authenticated;
