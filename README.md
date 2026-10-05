# 나의 옷장

내 옷을 사진으로 등록하면 내 옷끼리 코디를 만들어 주고, 매일 입은 코디를 달력에 기록하고,
다른 사람의 코디를 탐색하는 개인 옷장 앱입니다. 웹(Vercel)으로 먼저 운영하고, 같은 코드로 iOS/Android 앱을 만들 예정입니다.

- **앱**: Expo SDK 57 + Expo Router + TypeScript (`src/`)
- **백엔드**: Supabase (DB · Auth · Storage) — 스키마는 `supabase/migrations/`
- **배포**: `main`에 푸시하면 Vercel이 웹을 자동 배포 (`vercel.json`)

## 화면 구성

| 탭 | 파일 | 하는 일 |
|---|---|---|
| 홈 | `src/app/(tabs)/index.tsx` | 오늘의 코디 3벌 추천 · 옷 하나 바꾸기 · 저장 · 게시 · "오늘 이거 입었어요" |
| 탐색 | `src/app/(tabs)/explore.tsx` | 공개 코디 벽돌형 목록 · 계절/스타일/색 필터 |
| 등록 | `src/app/(tabs)/add.tsx` | 옷 등록 / 코디 직접 만들기 |
| 캘린더 | `src/app/(tabs)/calendar.tsx` | 날짜별 OOTD · 많이 입은 옷 · 3달째 안 입은 옷 |
| 내 옷장 | `src/app/(tabs)/closet.tsx` | 옷 3열 격자 · 보드 · 내 공개 코디 |

그 밖의 화면: 로그인 `login.tsx`, 옷 등록/수정 `clothing/`, 코디 만들기/상세 `outfit/`, 날짜별 기록 `ootd/[date].tsx`, 설정 `settings.tsx`.

## 코드 구조

```
src/
  app/          화면 (Expo Router, 파일 = 화면)
  components/   UI 컴포넌트 (ui/ 기본 요소, closet/ 옷·코디 카드)
  domain/       순수 로직 — 코디 추천, 색 조합, 배경 제거, 통계 (테스트 있음)
  lib/          Supabase 연결, 데이터 API(api.ts), 로그인(auth.tsx), 이미지 처리, AI 배경 제거(segment.web.ts)
supabase/
  migrations/   DB 스키마 + 보안 규칙(RLS) + 사진 저장소
  tests/        보안 규칙 통합 테스트
e2e/            브라우저 E2E 테스트 (Playwright) — real/ 은 CC0 실제 옷 사진
public/models/  배경 제거 모델 (U²-Netp, Apache-2.0)
scripts/        copy-ort.mjs: 설치 시 onnxruntime-web 런타임을 public/ort로 복사
```

## 처음 설정 (클라우드 Supabase)

1. **DB 만들기**: `supabase/migrations/` 안의 SQL 파일을 순서대로 Supabase **SQL Editor**에서 한 번씩 실행
2. **이메일 인증 끄기**: Authentication → Sign In / Providers → Email → **Confirm email 끄기**
   (현재 전화번호 로그인이 내부적으로 이메일 계정을 쓰기 때문)
3. **Vercel 환경 변수**: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (anon / publishable 키만!)

> ⚠️ `sb_secret_...` / `service_role` 키는 절대 앱이나 Vercel의 `EXPO_PUBLIC_` 변수에 넣지 마세요.

## 지금 버전의 임시 구현 (나중에 바꿀 것)

| 기능 | 지금 | 나중에 |
|---|---|---|
| 로그인 | 전화번호만 입력 (번호 → 내부 이메일/비밀번호). **번호를 아는 사람은 누구나 로그인 가능** | Supabase 휴대폰 OTP(SMS) 인증 |
| 배경 제거 | 무료 오픈소스 AI(U²-Netp, 4.6MB)를 브라우저에서 실행 + 경계 보정 · 그림자 · 밝기 보정 (웹만). 모델을 못 불러오면 단색 배경 방식으로 대체 | 주름 펴기 등 '상품컷 재생성'은 유료 이미지 AI(예: Gemini) |
| 종류/색 자동 분류 | 색은 픽셀 분석, 종류는 옷 모양으로 추정 (웹만) | 이미지 인식 AI |
| 코디 추천 | 규칙 기반: 색 조합 · 계절 · 최근 착용 기록 (`src/domain/recommend.ts`) | 외부 AI API로 교체/보강 |

`recommendOutfits`, `processClothingPhoto`, `signInWithPhone` 함수만 바꾸면 화면은 그대로 둔 채 교체할 수 있게 분리해 두었습니다.

## 탐색 탭 초기 콘텐츠

출시 초기에 탐색 탭이 비지 않게 하려면 **운영자 계정**(별도 전화번호)으로 로그인해서 실제 옷을 등록하고
코디를 "공개"로 게시하면 됩니다. 일반 사용자와 같은 방식이라 별도 관리 도구가 필요 없습니다.

## 테스트

```bash
npm test             # 순수 로직 단위 테스트 (jest)
npm run typecheck    # 타입 검사
npm run lint         # 린트

# 아래 두 개는 Docker로 로컬 Supabase를 띄운 뒤 실행
npx supabase start
SUPABASE_ANON_KEY=<supabase status의 ANON_KEY> npm run test:db   # 보안 규칙(RLS) 테스트

# E2E: 로컬 Supabase를 바라보는 웹 빌드를 만든 뒤 실행
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<ANON_KEY> \
  npx expo export --platform web
npm run test:e2e
```

## DB 변경 방법

1. `npx supabase migration new <이름>` 으로 새 SQL 파일 생성 (기존 파일은 수정하지 않기)
2. 로컬에서 `npx supabase db reset`으로 확인하고 `npm run test:db` 실행
3. 클라우드 반영: SQL Editor에서 새 파일만 실행 (또는 `npx supabase link` 후 `npm run db:push`)

## 앱 전환 (추후)

같은 코드로 EAS를 이용해 iOS/Android 앱을 빌드합니다: `npx eas-cli@latest build`.
앱에서는 배경 제거·색 자동 인식이 아직 동작하지 않으므로(사용자가 직접 선택), 전환 전에 API 연동을 권장합니다.
