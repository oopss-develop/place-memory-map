# Place Memory Map

커플과 작은 그룹이 함께 방문한 장소를 지도에 남기는 비공개 여행 기록 웹앱입니다.

## Local development

1. `.env.example`을 `.env.local`로 복사하고 Supabase 및 Kakao 키를 입력합니다.
2. `ALLOWED_MEMBERS_JSON`에 로그인할 네 사람의 이메일과 표시 이름을 등록합니다.
   ```env
   ALLOWED_MEMBERS_JSON=[{"email":"first@example.com","displayName":"첫 번째 사람"},{"email":"second@example.com","displayName":"두 번째 사람"},{"email":"third@example.com","displayName":"세 번째 사람"},{"email":"fourth@example.com","displayName":"네 번째 사람"}]
   ```
   이메일은 대소문자를 구분하지 않으며 정확히 네 명을 등록해야 합니다. 이 값은 서버에서만 읽고 브라우저에는 전달하지 않습니다.
3. Supabase SQL Editor 또는 CLI로 `supabase/migrations` 안의 SQL 파일을 파일명 순서대로 모두 적용합니다. 초기 스키마만 적용하면 맵핀, 방문 예정, 0.5 단위 별점 같은 이후 기능의 컬럼이 누락됩니다.
4. Supabase Auth SMTP 설정에 Brevo SMTP 정보를 연결하고 Site URL 및 Redirect URL을 등록합니다.
5. `npm run dev`를 실행합니다.

공유 저장은 로그인한 사용자의 Supabase 세션과 RLS 정책으로 처리합니다. 테스트용 데모 모드는 `NEXT_PUBLIC_DEMO_MODE=true`일 때만 사용합니다.

## Verification

- `npm run quality:app`: 타입, 린트, 단위 테스트, 모바일·데스크톱 E2E, 프로덕션 빌드
- `npm run quality`: 위 검사에 로컬 Supabase 기반 RLS 통합 테스트까지 포함한 전체 품질 게이트
- `supabase start` 후 `npm run quality`를 실행하며, GitHub Actions에서는 필요한 CLI와 Chromium을 자동 준비합니다.

## Deployment

Vercel 프로젝트에 Git 저장소를 연결하고 `.env.example`의 값을 등록합니다. `NEXT_PUBLIC_APP_URL`은 실제 Vercel 도메인으로 설정하고, 같은 URL을 Supabase와 Kakao 개발자 콘솔의 허용 도메인에도 추가합니다.

앱 업데이트를 배포하기 전에 새로 추가된 `supabase/migrations` 파일도 운영 Supabase에 적용합니다. 현재 DB가 정수 별점만 받는 경우 `202609170003_repair_visit_rating_half_steps.sql`을 SQL Editor에서 실행하면 기존 기록을 유지하면서 0.5 단위 별점 저장이 활성화됩니다.

### 네 명의 이메일 등록

1. Vercel 프로젝트의 **Settings → Environment Variables**에서 `ALLOWED_MEMBERS_JSON`을 추가하고 위 JSON 형식으로 네 사람을 입력합니다. Production, Preview, Development에 필요한 범위를 선택한 뒤 재배포합니다.
2. Supabase의 **Authentication → URL Configuration**에서 Site URL을 실제 Vercel 주소로 지정하고 Redirect URLs에 `https://내-도메인/auth/callback`을 추가합니다. 로컬 개발에는 `http://localhost:3000/auth/callback`도 추가합니다.
3. Supabase의 **Authentication → Email**에서 이메일 로그인을 켜고, **SMTP Settings**에 Brevo SMTP를 연결합니다.
4. 등록된 첫 번째 사람이 로그인 링크로 접속해 첫 지도를 만든 뒤 그룹 메뉴에서 나머지 세 사람에게 각각 새 초대 링크를 보냅니다. 초대 링크는 한 번만 사용할 수 있으므로 세 개를 따로 생성합니다.

각 사용자는 새 기기에서 처음 로그인하거나 직접 로그아웃했을 때만 이메일 링크를 다시 받으면 됩니다. 등록되지 않은 이메일은 앱과 초대 링크에 접근할 수 없습니다.
