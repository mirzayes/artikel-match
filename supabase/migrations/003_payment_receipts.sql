-- VIP / mağaza: ödəniş çeki yükləmələri (Supabase Storage + bu cədvəl — admin paneldə görünür).
-- Tətbiqdən anon açar ilə POST (RLS söndürülmüş cədvəl + storage policy).

create table if not exists public.payment_receipts (
  id uuid primary key default gen_random_uuid(),
  device_id text not null,
  source text not null check (source in ('vip_modal', 'coin_shop')),
  currency text,
  storage_path text not null,
  file_mime text,
  created_at timestamptz not null default now()
);

create index if not exists payment_receipts_created_at_idx on public.payment_receipts (created_at desc);
create index if not exists payment_receipts_device_id_idx on public.payment_receipts (device_id);

alter table public.payment_receipts disable row level security;

-- Storage bucket (mövcuddursa toxunulmur)
insert into storage.buckets (id, name, public)
values ('payment-receipts', 'payment-receipts', false)
on conflict (id) do nothing;

drop policy if exists "payment_receipts_insert_anon" on storage.objects;
create policy "payment_receipts_insert_anon"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'payment-receipts');
