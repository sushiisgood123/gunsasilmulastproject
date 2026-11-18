-- =========================================================================
-- [밀리핏 트래커 - Supabase 테이블 생성 및 권한 설정 SQL (다중 사용자 지원)]
-- 
-- 📌 사용 방법:
-- 1. Supabase 대시보드(https://supabase.com/dashboard) 로그인 후 프로젝트 생성
-- 2. 좌측 메뉴에서 [SQL Editor] 클릭 -> [New Query] 클릭
-- 3. 아래 SQL 내용을 그대로 붙여넣고 우측 하단 [Run] 버튼 클릭!
-- =========================================================================

-- 1. 체력 측정 기록 테이블 생성 (개인별 user_name 컬럼 포함)
create table if not exists public.milifit_records (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  user_name text not null default '나의 기록',
  date text not null,
  weight numeric(4,1) not null,
  run_min integer not null default 0,
  run_sec_only integer not null default 0,
  run_sec integer not null,
  pushup integer not null default 0,
  situp integer not null default 0,
  overall_grade text,
  notes text
);

-- 기존 테이블이 이미 있는 경우 user_name 컬럼 안전하게 추가
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name='milifit_records' and column_name='user_name') then
    alter table public.milifit_records add column user_name text not null default '나의 기록';
  end if;
end $$;

-- 2. Row Level Security (RLS) 활성화
alter table public.milifit_records enable row level security;

-- 3. 익명(anon) 사용자 읽기/쓰기/삭제 허용 정책 생성 (개인 및 팀 대시보드용)
drop policy if exists "Allow anon full access" on public.milifit_records;
create policy "Allow anon full access"
  on public.milifit_records
  for all
  to anon
  using (true)
  with check (true);

-- 4. 사용자별 및 날짜별 빠른 검색 인덱스 생성
create index if not exists idx_milifit_records_user_date on public.milifit_records (user_name, date);
