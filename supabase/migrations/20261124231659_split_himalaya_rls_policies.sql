-- Keep one SELECT policy per relevant role/action, while preserving admin management.
drop policy if exists "public reads available products" on public.products;
drop policy if exists "admins manage products" on public.products;
drop policy if exists "authenticated reads products" on public.products;
drop policy if exists "admins insert products" on public.products;
drop policy if exists "admins update products" on public.products;
drop policy if exists "admins delete products" on public.products;

create policy "public reads available products" on public.products
  for select to anon using (available);
create policy "authenticated reads products" on public.products
  for select to authenticated using (available or (select public.is_himalaya_admin()));
create policy "admins insert products" on public.products
  for insert to authenticated with check ((select public.is_himalaya_admin()));
create policy "admins update products" on public.products
  for update to authenticated using ((select public.is_himalaya_admin()))
  with check ((select public.is_himalaya_admin()));
create policy "admins delete products" on public.products
  for delete to authenticated using ((select public.is_himalaya_admin()));

drop policy if exists "admins manage shop settings" on public.shop_settings;
drop policy if exists "admins insert shop settings" on public.shop_settings;
drop policy if exists "admins update shop settings" on public.shop_settings;
drop policy if exists "admins delete shop settings" on public.shop_settings;
create policy "admins insert shop settings" on public.shop_settings
  for insert to authenticated with check ((select public.is_himalaya_admin()));
create policy "admins update shop settings" on public.shop_settings
  for update to authenticated using ((select public.is_himalaya_admin()))
  with check ((select public.is_himalaya_admin()));
create policy "admins delete shop settings" on public.shop_settings
  for delete to authenticated using ((select public.is_himalaya_admin()));
