# Place Memory Map

커플과 작은 그룹이 함께 방문한 장소를 지도에 남기는 비공개 여행 기록 웹앱입니다.

## Local development

1. `.env.example`을 `.env.local`로 복사하고 Supabase 및 Kakao 키를 입력합니다. 서버 저장을 사용하려면 `SUPABASE_SERVICE_ROLE_KEY`도 추가합니다.
2. Supabase SQL Editor 또는 CLI로 `supabase/migrations` 안의 SQL 파일을 파일명 순서대로 모두 적용합니다. 초기 스키마만 적용하면 맵핀, 방문 예정, 0.5 단위 별점 같은 이후 기능의 컬럼이 누락됩니다.
3. Supabase Auth SMTP 설정에 Brevo SMTP 정보를 연결하고 Site URL 및 Redirect URL을 등록합니다.
4. `npm run dev`를 실행합니다.

`SUPABASE_SERVICE_ROLE_KEY`가 없으면 앱은 브라우저 안의 임시 모드로 실행됩니다. 이 모드의 기록은 다른 기기와 공유되지 않습니다.

## Verification

- `npm run quality:app`: 타입, 린트, 단위 테스트, 모바일·데스크톱 E2E, 프로덕션 빌드
- `npm run quality`: 위 검사에 로컬 Supabase 기반 RLS 통합 테스트까지 포함한 전체 품질 게이트
- `supabase start` 후 `npm run quality`를 실행하며, GitHub Actions에서는 필요한 CLI와 Chromium을 자동 준비합니다.

## Deployment

Vercel 프로젝트에 Git 저장소를 연결하고 `.env.example`의 값을 등록합니다. `NEXT_PUBLIC_APP_URL`은 실제 Vercel 도메인으로 설정하고, 같은 URL을 Supabase와 Kakao 개발자 콘솔의 허용 도메인에도 추가합니다.

앱 업데이트를 배포하기 전에 새로 추가된 `supabase/migrations` 파일도 운영 Supabase에 적용합니다. 현재 DB가 정수 별점만 받는 경우 `202609170003_repair_visit_rating_half_steps.sql`을 SQL Editor에서 실행하면 기존 기록을 유지하면서 0.5 단위 별점 저장이 활성화됩니다.

간편 코드 로그인으로 실제 공유 CRUD를 사용하려면 Supabase Dashboard → Project Settings → API Keys에서 `service_role` 키를 복사해 Vercel의 `SUPABASE_SERVICE_ROLE_KEY` 환경변수에 **Secret**으로 등록합니다. 이 값은 `NEXT_PUBLIC_` 접두어를 붙이지 않으며 브라우저에 노출되지 않습니다. 배포 후 네 개의 입장 코드가 처음 서버에 접근할 때 전용 프로필과 기본 공유 지도(`또나우쥐`)가 자동으로 준비됩니다.
