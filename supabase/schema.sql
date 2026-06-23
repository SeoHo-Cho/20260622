-- 로또 추첨 기록 저장 테이블
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 실행하세요.

create table if not exists public.lotto_draws (
  id          bigint generated always as identity primary key,
  numbers     int[]       not null,          -- 메인 번호 6개 (정렬됨)
  bonus       int,                            -- 보너스 번호 (없으면 null)
  created_at  timestamptz not null default now()  -- 저장 시 api/draws.js 가 KST(+09:00) 값으로 채움
);

-- 최근 기록 조회용 인덱스
create index if not exists lotto_draws_created_at_idx
  on public.lotto_draws (created_at desc);

-- RLS 활성화. 저장/조회는 service_role 키를 쓰는 서버리스 함수(api/draws.js)에서만
-- 수행하므로, 클라이언트(anon)용 정책은 따로 만들지 않습니다.
-- service_role 키는 RLS 를 우회하므로 별도 정책 없이도 동작합니다.
alter table public.lotto_draws enable row level security;
