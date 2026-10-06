-- 감사 일기장 v26: 추가 일기 항목 + 공유 하트
alter table public.gratitude_entries
  add column if not exists extra_items jsonb not null default '[]'::jsonb,
  add column if not exists hearted boolean not null default false;
