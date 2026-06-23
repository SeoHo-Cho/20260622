# 로또 추첨기 + AI 행운번호 추천

로또 6/45 번호 추첨기와, Gemini 2.5 Flash 기반 AI 행운번호 추천 챗봇입니다.

## 기능
- 로또 6/45 무작위 번호 추첨 (보너스 번호 옵션, 다중 세트)
- 역대 회차 당첨번호 / 1등 당첨금 조회
- **AI 행운번호 추천**: 성별·생년월일 기반으로 번호 6개 + 보너스 추천 및 이유 설명, 후속 질문 가능
- **추첨 기록 저장**: 추첨한 번호를 Supabase 에 저장하고, 다음 방문 시 최근 기록을 다시 불러옴

## 구조
- `index.html`, `styles.css`, `app.js` — 정적 프론트엔드
- `chatbot.js` — AI 추천 챗봇 프론트 로직
- `api/chat.js` — Vercel 서버리스 함수 (Gemini API 호출, API 키 서버 측 보관)
- `api/draws.js` — Vercel 서버리스 함수 (Supabase 에 추첨 기록 저장/조회)
- `supabase/schema.sql` — 추첨 기록 테이블 스키마

## Supabase 설정
1. [supabase.com](https://supabase.com) 에서 프로젝트 생성
2. **SQL Editor** 에 `supabase/schema.sql` 내용을 붙여넣고 실행 → `lotto_draws` 테이블 생성
3. **Project Settings → API** 에서 아래 두 값을 확인:
   - `Project URL` → 환경변수 `SUPABASE_URL`
   - `service_role` 키 → 환경변수 `SUPABASE_SERVICE_ROLE_KEY` (⚠️ 절대 공개 금지)

## 배포 (Vercel)
1. 이 저장소를 Vercel 프로젝트로 import (프레임워크 없음 / Other)
2. **Settings → Environment Variables** 에 추가:
   - `GEMINI_API_KEY` = 발급받은 Google AI Studio API 키
     - 발급: https://aistudio.google.com/app/apikey
   - `SUPABASE_URL` = Supabase Project URL
   - `SUPABASE_SERVICE_ROLE_KEY` = Supabase service_role 키
3. 배포하면 `/api/chat`, `/api/draws` 엔드포인트가 자동 생성됩니다.

> 모든 키는 서버리스 함수에서만 사용되며 브라우저로 노출되지 않습니다.
> ⚠️ AI 추천 · 추첨 기록 저장 기능은 `/api/*` 호출이 필요하므로 로컬에서 파일을 직접 열면 동작하지 않습니다.
> 로컬 테스트는 `vercel dev` 를 사용하고, 환경변수는 `.env.local` (또는 `vercel env pull`) 로 주입하세요.

※ 본 서비스의 추천은 재미를 위한 것이며 당첨을 보장하지 않습니다.
