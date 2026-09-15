# Place Memory Map

커플과 작은 그룹이 함께 방문한 장소를 지도에 남기는 비공개 여행 기록 웹앱입니다.

## Local development

1. `.env.example`을 `.env.local`로 복사하고 Supabase 및 Kakao 키를 입력합니다.
2. Supabase SQL Editor 또는 CLI로 `supabase/migrations/202609150001_initial_schema.sql`을 적용합니다.
3. Supabase Auth SMTP 설정에 Brevo SMTP 정보를 연결하고 Site URL 및 Redirect URL을 등록합니다.
4. `npm run dev`를 실행합니다.

환경변수가 없으면 앱은 합성된 예시 기록과 지도 대체 화면으로 실행됩니다. 실제 데이터는 저장하지 않습니다.

## Verification

- `npm run quality:app`: 타입, 린트, 단위 테스트, 모바일·데스크톱 E2E, 프로덕션 빌드
- `npm run quality`: 위 검사에 로컬 Supabase 기반 RLS 통합 테스트까지 포함한 전체 품질 게이트
- `supabase start` 후 `npm run quality`를 실행하며, GitHub Actions에서는 필요한 CLI와 Chromium을 자동 준비합니다.

## Deployment

Vercel 프로젝트에 Git 저장소를 연결하고 `.env.example`의 값을 등록합니다. `NEXT_PUBLIC_APP_URL`은 실제 Vercel 도메인으로 설정하고, 같은 URL을 Supabase와 Kakao 개발자 콘솔의 허용 도메인에도 추가합니다.
