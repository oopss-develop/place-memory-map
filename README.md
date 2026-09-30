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

새로 추가된 맵핀 모양을 저장하려면 Supabase SQL Editor에서 `202609190001_expand_visit_marker_styles.sql`도 실행해야 합니다. Vercel 재배포나 브라우저 캐시 삭제만으로는 DB의 기존 맵핀 제한 규칙이 바뀌지 않습니다.

### 여행 동선 캐시 DB 적용

`202609280001_trip_timetables.sql` 뒤에 `202609290001_trip_route_cache.sql`을 Supabase SQL Editor에서 실행하고 앱을 배포합니다. 동선은 지도의 **동선 확인** 버튼을 눌렀을 때만 계산합니다. 국내 지도에서 장소가 2~32곳이면 Kakao Mobility 다중 경유지 길찾기를 한 번 요청하고, 순서가 같은 경로 결과는 지도 멤버들과 공유해 DB에서 불러옵니다. 해외 지도, 32곳 초과, 또는 길찾기에 실패한 경우는 방문 순서 직선으로 저장합니다. 브라우저를 새로고침하거나 동선을 다시 열 때 Kakao 길찾기 API를 다시 호출하지 않습니다.

`KAKAO_REST_API_KEY`를 서버 환경 변수로 설정해야 국내 도로 경로를 만들 수 있습니다. 동선 계산은 사용자가 직접 요청한 경우에만 발생합니다. Kakao Mobility의 현재 공개 기준은 다중 경유지 API 일 5,000건 무료 제공량이며, 무료 제공량 초과 후 월 500,000건 구간은 요청당 16원입니다. 한 경로 계산은 최대 30개 경유지를 포함하는 단일 요청으로 제한합니다. ([공식 쿼터 및 가격](https://developers.kakaomobility.com/price/), [다중 경유지 API](https://developers.kakaomobility.com/guide/navi-api/waypoints.html))

```sql
select to_regclass('public.trip_route_cache') as trip_route_cache,
       has_table_privilege('authenticated', 'public.trip_route_cache', 'SELECT') as can_read,
       has_table_privilege('authenticated', 'public.trip_route_cache', 'INSERT') as direct_insert,
       has_function_privilege('authenticated', 'public.save_trip_route(uuid,date,text,text,text,jsonb,integer,integer)', 'EXECUTE') as can_save;
-- public.trip_route_cache, true, false, true
```

### 여행 시간표 DB 적용

1. 기존 마이그레이션이 `202609190001`까지 적용되었는지 확인합니다.
2. `supabase/migrations/202609280001_trip_timetables.sql` 전체를 Supabase **SQL Editor**에서 한 번 실행합니다. 파일은 `begin` / `commit`으로 묶여 있으며 실패하면 전체가 롤백됩니다. CLI를 사용하는 프로젝트는 `supabase db push`로 미적용 마이그레이션을 적용합니다. SQL Editor로 직접 적용한 파일은 CLI 배포와 혼용할 때 마이그레이션 이력도 맞춰야 합니다.
3. 아래 확인 쿼리를 실행한 다음 새 앱을 배포합니다. 새로운 테이블과 RPC를 추가하므로 기존 방문 기록은 변환하거나 삭제하지 않습니다.

```sql
select to_regclass('public.trips') as trips,
       to_regclass('public.schedule_items') as schedule_items;

select tablename, policyname, cmd
from pg_policies
where schemaname = 'public' and tablename in ('trips', 'schedule_items');
-- trips_read / schedule_items_read, SELECT 정책이어야 합니다.

select has_table_privilege('authenticated', 'public.trips', 'SELECT') as can_read,
       has_table_privilege('authenticated', 'public.trips', 'INSERT') as direct_insert,
       has_table_privilege('authenticated', 'public.schedule_items', 'UPDATE') as direct_update,
       has_function_privilege('authenticated', 'public.save_schedule_item(uuid,jsonb)', 'EXECUTE') as can_save,
       has_function_privilege('anon', 'public.save_trip(jsonb)', 'EXECUTE') as anon_save;
-- true, false, false, true, false
```

테스트 DB에서는 `supabase start` → `supabase db reset` → `supabase test db`로 `supabase/tests/timetables.sql`을 포함한 테스트를 실행합니다. **`db reset`은 로컬 테스트 DB 전용이며 운영 DB에 사용하지 않습니다.** 테스트용 사용자와 기록은 트랜잭션 종료 시 롤백됩니다.

새 API는 `/api/trips`와 `/api/trips/[tripId]/items`입니다. 읽기는 RLS, 쓰기는 인증·멤버십·버전을 확인하는 전용 RPC로 처리합니다. 새 장소와 일정은 함께 저장되거나 함께 롤백됩니다. 여행과 일정의 소속 지도는 복합 외래키로 일치시킵니다. 여행 기간 수정과 일정 저장은 같은 여행 행을 먼저 잠급니다. 충돌은 HTTP 409, 미적용 마이그레이션은 HTTP 503으로 안내합니다.

여행 시간대는 IANA 이름을 사용하며 기본은 `Asia/Seoul`입니다. 일정의 시작·종료는 `timestamp without time zone`으로 저장되는 **여행 현지 날짜·시각**입니다. UTC로 변환하지 않으며 시간대를 수정해도 입력 시각은 바뀌지 않습니다. 마지막 날짜의 다음 날 00:00까지 일정을 종료할 수 있습니다.

그룹 멤버는 여행과 일정을 함께 편집합니다. 서버 모드에서는 화면 활성화·온라인 복귀와 10초 간격으로 동기화합니다. 원본 방문 기록을 일정에 넣어도 원본 날짜·사진·방문 예정 여부는 바뀌지 않습니다. 여행과 일정 삭제는 소프트 삭제이며, 원본 방문 기록과 장소를 지우지 않습니다. 복구 UI와 자동 방문 완료 전환은 이번 버전에 포함하지 않습니다.

데모 모드는 지도별 `place-memory-trips-v1:<groupId>` 로컬 저장소를 사용하며 다른 기기와 공유하지 않습니다. PC에서는 날짜별 열과 지도, 모바일에서는 하루 시간표와 지도 탭을 사용합니다. 구간 생성·이동·길이 조절은 15분 단위이며 모바일은 400ms 길게 눌러 드래그합니다. 짧은 일정은 제목을 표시하고 상세 선택 후 날짜·시간 입력으로 길이를 조절할 수 있습니다. 지도 로딩 실패 시 장소 목록과 좌표 입력으로 계속 작업할 수 있습니다.

앱 롤백이 필요하면 이전 앱 버전을 배포하고 추가 테이블은 유지합니다. 데이터를 가진 테이블을 삭제하는 롤백 SQL은 제공하지 않습니다. 운영 DB 적용·Vercel 배포는 로컬 코드 검증과 별개로 확인해야 합니다.

### 네 명의 이메일 등록

1. Vercel 프로젝트의 **Settings → Environment Variables**에서 `ALLOWED_MEMBERS_JSON`을 추가하고 위 JSON 형식으로 네 사람을 입력합니다. Production, Preview, Development에 필요한 범위를 선택한 뒤 재배포합니다.
2. Supabase의 **Authentication → URL Configuration**에서 Site URL을 실제 Vercel 주소로 지정하고 Redirect URLs에 `https://내-도메인/auth/callback`을 추가합니다. 로컬 개발에는 `http://localhost:3000/auth/callback`도 추가합니다.
3. Supabase의 **Authentication → Email**에서 이메일 로그인을 켜고, **SMTP Settings**에 Brevo SMTP를 연결합니다.
4. 등록된 네 명은 이메일과 키워드로 로그인합니다. 서버의 `SUPABASE_SERVICE_ROLE_KEY`로 네 명이 만든 기존 지도와 새 지도의 멤버를 자동 연결하며, 기록·사진·여행 계획을 모두 함께 보고 수정할 수 있습니다. 아직 계정이 없는 사람은 첫 로그인 후 기존 지도에 연결됩니다. 초대 링크를 만들 필요가 없으며, 지도 전체 삭제는 만든 사람만 할 수 있습니다.

각 사용자는 새 기기에서 처음 로그인하거나 직접 로그아웃했을 때만 이메일 링크를 다시 받으면 됩니다. 등록되지 않은 이메일은 앱과 초대 링크에 접근할 수 없습니다.
