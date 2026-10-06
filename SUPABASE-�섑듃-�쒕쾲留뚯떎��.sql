create table if not exists public.gratitude_likes (
  entry_id bigint primary key references public.gratitude_entries(id) on delete cascade,
  liked boolean not null default false
);
alter table public.gratitude_likes enable row level security;
grant select, insert, update, delete on table public.gratitude_likes to anon;
drop policy if exists "couple_likes_all" on public.gratitude_likes;
create policy "couple_likes_all" on public.gratitude_likes for all to anon using (true) with check (true);
