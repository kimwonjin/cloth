# cloth

Expo (React Native) + Supabase 앱. iOS / Android / Web을 하나의 코드베이스로 개발합니다.

## 기술 스택

- **Expo SDK 57** + Expo Router (`src/app/` 파일 기반 라우팅)
- **TypeScript**
- **Supabase** (DB · Auth · Storage) — `@supabase/supabase-js`
- **Supabase CLI** (devDependency) — 마이그레이션/타입 생성

## 시작하기

```bash
npm install
cp .env.example .env.local   # Supabase URL / key 입력
npm start                    # Expo 개발 서버 (QR 코드를 Expo Go 앱으로 스캔)
```

- `npm run web` / `npm run android` / `npm run ios` 로 플랫폼별 실행
- 홈 화면의 **Supabase** 행에서 연결 상태(`connected` / `failed` / `env not set`)를 확인할 수 있습니다.

## Supabase 연결

1. [Supabase Dashboard](https://supabase.com/dashboard)에서 프로젝트 선택 → **Connect** (또는 Project Settings → API)
2. `.env.local`에 입력
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
   EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable 또는 anon key>
   ```
   > `EXPO_PUBLIC_` 변수는 앱 번들에 포함됩니다. **service_role / secret key는 절대 넣지 마세요.**
   > 데이터 보호는 테이블의 RLS(Row Level Security) 정책으로 합니다.
3. 클라이언트 사용: `import { supabase } from '@/lib/supabase';`

## 데이터베이스 마이그레이션 (Supabase CLI)

```bash
npx supabase login               # 최초 1회 (Access Token 필요)
npm run db:link -- --project-ref <project-ref>
npm run db:new -- create_products   # supabase/migrations/에 SQL 파일 생성
npm run db:push                     # 클라우드 DB에 마이그레이션 적용
npm run db:types                    # src/lib/database.types.ts 타입 생성
```

## 주요 경로

| 경로 | 설명 |
|---|---|
| `src/app/` | 화면(라우트) |
| `src/lib/supabase.ts` | Supabase 클라이언트 |
| `supabase/config.toml` | Supabase CLI 설정 |
| `supabase/migrations/` | DB 마이그레이션 SQL |

## 웹 배포 (Vercel)

현재는 웹 버전을 Vercel로 배포하며 개발합니다. 설정은 `vercel.json`에 있습니다.

- `main`에 푸시 → 프로덕션 자동 배포
- PR 생성 → PR별 미리보기 URL 자동 생성
- 환경 변수는 Vercel Project Settings → Environment Variables에 등록
  (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`)

## 앱 전환 (추후)

웹으로 기능이 어느 정도 갖춰지면 같은 코드로 EAS를 이용해 iOS/Android 앱을 빌드합니다:
`npx eas-cli@latest build`. 자세한 내용은 [EAS 문서](https://docs.expo.dev/eas/) 참고.
