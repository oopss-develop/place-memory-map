# 우뚜막

커플과 작은 그룹이 함께 방문한 장소를 지도에 남기는 비공개 여행 기록 웹앱입니다.

‘우뚜막’은 우삼과 뚜냥의 첫 글자를 합친 이름입니다. 우삼은 동그란 안경을 쓴 다람쥐이고, 뚜냥은 오두막에 올라간 고양이를 뜻합니다. 두 캐릭터와 오두막, 부뚜막의 포근함을 브랜드에 담습니다.

## 기록 댓글

지도와 모아보기의 기록 상세 화면에서 그룹 멤버끼리 댓글을 남길 수 있습니다. 댓글은 최대 1000자이며 작성자 이름과 작성 시각을 표시합니다. 본인 댓글만 삭제할 수 있고, 새로고침으로 다른 멤버의 댓글을 확인합니다. 기록을 휴지통으로 보내면 댓글도 숨겨지며 기록 복원 시 다시 표시됩니다.

배포 전에 `supabase/migrations/202610100001_visit_comments.sql`을 Supabase에 적용해야 합니다. Supabase CLI 프로젝트가 연결되어 있으면 `supabase db push`를 사용하거나, Supabase SQL Editor에서 이 마이그레이션을 실행하세요. 댓글 작성은 클라이언트 UUID로 재시도 중복을 방지하며, 데이터베이스에서 그룹 권한과 작성자 권한을 검사합니다.

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

- `npm run quality:app`: 타입, 린트, 단위 테스트, 내장 PostgreSQL 검사, 모바일·데스크톱 E2E, 프로덕션 빌드
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

데모 모드는 지도별 `place-memory-trips-v1:<groupId>` 로컬 저장소를 사용하며 다른 기기와 공유하지 않습니다. PC에서는 날짜별 열과 지도, 모바일에서는 일별 일정 목록을 기본으로 시간표·지도 탭을 사용합니다. 구간 생성·이동·길이 조절은 15분 단위이며 모바일은 400ms 길게 눌러 드래그합니다. 짧은 일정은 제목을 표시하고 상세 선택 후 날짜·시간 입력으로 길이를 조절할 수 있습니다. 지도 로딩 실패 시 장소 목록과 좌표 입력으로 계속 작업할 수 있습니다.

앱 롤백이 필요하면 이전 앱 버전을 배포하고 추가 테이블은 유지합니다. 데이터를 가진 테이블을 삭제하는 롤백 SQL은 제공하지 않습니다. 운영 DB 적용·Vercel 배포는 로컬 코드 검증과 별개로 확인해야 합니다.

### 네 명의 이메일 등록

1. Vercel 프로젝트의 **Settings → Environment Variables**에서 `ALLOWED_MEMBERS_JSON`을 추가하고 위 JSON 형식으로 네 사람을 입력합니다. Production, Preview, Development에 필요한 범위를 선택한 뒤 재배포합니다.
2. Supabase의 **Authentication → URL Configuration**에서 Site URL을 실제 Vercel 주소로 지정하고 Redirect URLs에 `https://내-도메인/auth/callback`을 추가합니다. 로컬 개발에는 `http://localhost:3000/auth/callback`도 추가합니다.
3. Supabase의 **Authentication → Email**에서 이메일 로그인을 켜고, **SMTP Settings**에 Brevo SMTP를 연결합니다.
4. 등록된 네 명은 이메일과 키워드로 로그인합니다. 서버의 `SUPABASE_SERVICE_ROLE_KEY`로 네 명이 만든 기존 지도와 새 지도의 멤버를 자동 연결하며, 기록·사진·여행 계획을 모두 함께 보고 수정할 수 있습니다. 아직 계정이 없는 사람은 첫 로그인 후 기존 지도에 연결됩니다. 초대 링크를 만들 필요가 없으며, 지도 전체 삭제는 만든 사람만 할 수 있습니다.

각 사용자는 새 기기에서 처음 로그인하거나 직접 로그아웃했을 때만 이메일 링크를 다시 받으면 됩니다. 등록되지 않은 이메일은 앱과 초대 링크에 접근할 수 없습니다.

## 기록 저장·복구 및 사진 관리 (2026-10-02)

기록은 먼저 저장되며 사진별 업로드 결과를 별도로 안내합니다. 사진만 실패하면 같은 기록과 사진 요청 ID로 실패한 사진만 재시도합니다. 사진을 누르면 확대 화면이 열리고 이전·다음 버튼, 방향키, 개별 삭제를 사용할 수 있습니다.

방문 기록 삭제 후 10초 동안 실행 취소할 수 있고, 지도 메뉴의 휴지통에서 삭제 후 30일 이내 기록과 사진을 복원할 수 있습니다. 복원은 지도 멤버 권한과 버전을 확인하며 사진 링크를 새로 발급합니다. 개별 사진 삭제는 기록에서 즉시 숨기며 파일은 30일 보관합니다. 개별 사진 복원 UI, 여행 삭제 복구, 지도 전체 삭제 복구는 제공하지 않습니다. 이미 영구 삭제한 파일은 복구되지 않습니다.

기록·일정 초안은 변경 후 500ms에 사용자·지도·항목별로 기기에 저장하고 7일 뒤 만료합니다. 저장 성공, 초안 삭제, 항목 삭제, 로그아웃에 제거합니다. 업로드 전 사진 파일은 보관하지 않으며 복원 시 다시 선택해야 합니다. 저장 충돌에서는 내 입력을 보존한 채 최신 제목·메모를 확인하고 다시 저장합니다. 전체 오프라인 자동 동기화는 제공하지 않습니다.

저장된 기록 검색은 현재 불러온 데이터의 장소 이름·제목·메모·주소를 대상으로 합니다. 날짜·방문 상태·태그·참여자 조건은 서로 AND, 같은 조건의 다중 선택은 OR입니다. 기본 최신 방문순과 오래된 방문순·평점순을 지원하며 지도와 목록은 같은 결과를 사용합니다. 검색 조건과 여행·날짜·보기는 사용자별 기기에 보관합니다. 모바일 여행은 일별 일정 목록을 기본으로 시간표·지도 탭을 제공하며 추가·수정·상세·지도 보기 모두 버튼으로 사용할 수 있습니다.

### 적용 순서

1. Supabase에 기존 마이그레이션 다음으로 `supabase/migrations/202610020001_visit_reliability.sql`을 적용합니다. 기존 기록과 사진을 재생성하지 않습니다.
2. 로컬 Docker 엔진을 실행하고 `supabase start`, `supabase test db`로 권한·중복 방지·복구 테스트를 확인합니다. 저장 RPC는 참여자 변경까지 한 트랜잭션으로 처리합니다.
3. 서버에 기존 `SUPABASE_SERVICE_ROLE_KEY`와 새 `CRON_SECRET`을 설정한 뒤 앱을 배포합니다. `CRON_SECRET`은 임의의 긴 값으로 설정하고 브라우저에 노출하지 않습니다.
4. Vercel Cron은 매일 03:00 한국 시각(18:00 UTC)에 `/api/maintenance/purge-visits`를 호출합니다. 해당 경로는 Bearer 인증이 필요합니다. 만료 기록을 먼저 정리 대상으로 고정해 복원과 충돌하지 않게 한 뒤 Storage 파일 삭제 성공 후 DB 행을 삭제합니다. 실패 항목은 다음 실행에서 재시도합니다. 7일 넘게 방치한 미완료 사진 예약은 슬롯을 해제하고 30일 보관 후 정리합니다.
5. 배포 후 사진 일부 실패 재시도, 사진 포함 삭제·새로고침·복원, 접근 권한, Cron 실행 결과를 실제 비공개 지도에서 확인합니다. 503 또는 `failed`가 발생한 정리 작업은 서버 로그와 저장소 권한을 확인합니다.

첫 세 단계의 개선을 구현했으며 일정 복제·일정에서 방문 기록 만들기·장소별 이력·이동 시간 안내·최근 수정 내역은 후속 기능입니다.

Docker 없는 환경에서는 `npm run test:db:embedded`로 전체 마이그레이션과 PostgreSQL의 중복 요청·편집 버전·사진 보존·휴지통 권한·사진 접근·예약 만료를 검증할 수 있습니다. Auth 사용자와 Storage 메타데이터는 테스트용 스키마이며, 실제 Supabase JWT·Storage HTTP·Cron 배포 통합을 대신하지 않습니다. `supabase test db`는 실제 로컬 Supabase의 pgTAP 테스트입니다.


## 2026-10-07 안정화 업데이트

운영 적용은 기존 마이그레이션 이후 `202610070001_workspace_reliability.sql`을 먼저 적용하고 앱을 배포하는 순서입니다. 이 마이그레이션은 저장 요청 중복 방지와 지도별 집계를 추가하며 기존 기록을 삭제하지 않습니다. 이번 작업에서는 운영 DB 적용과 배포를 수행하지 않습니다.

지도·여행·일정은 같은 제출의 재시도에 동일한 요청 ID를 사용합니다. 대시보드는 선택한 지도만 250행 단위로 끝까지 읽고, ETag가 같으면 사진 URL을 새로 발급하지 않습니다. 사진 URL은 만료 전에 갱신합니다. 지도 자동 공유는 첫 접속과 지도 생성 시 유지하며 여행 화면은 선택한 여행의 일정만 갱신합니다.

회귀 검증은 검색 응답 순서, 비정상 서버 응답, 1,001개 기록 조회, 저장 재시도, 권한 검사, 모바일 320/360/390px 팝업 버튼을 포함합니다. Docker/Supabase CLI가 없는 환경에서는 내장 PostgreSQL 검증을 실행하고 실제 Supabase 통합은 별도로 확인해야 합니다.

### 폴더별 댓글 이모티콘

[이모티콘 관리 안내](public/stickers/README.md)에 따라 `public/stickers/시리즈명/`에 PNG·WebP·GIF를 넣으면 빌드 시 자동 반영됩니다. 배포 전에 `supabase/migrations/202610100002_comment_stickers.sql`을 적용하세요. 기존 댓글을 유지하려면 사용 중인 파일 경로를 유지하세요.

### 댓글 소식과 알림

지도·여행·모아보기의 ‘댓글 알림’ 버튼에서 미확인 알림과 최근 댓글을 볼 수 있습니다. 상대의 댓글은 같은 지도 구성원에게 알림으로 생성되고, 본인 댓글은 최근 댓글에만 표시됩니다. 목록은 버튼을 열거나 새로고침할 때 갱신됩니다. 알림을 누르면 해당 기록의 댓글로 이동하며, 댓글이 실제로 화면에 표시되면 계정별로 읽음 처리됩니다. 확인한 알림은 미확인 목록에서 사라지고 최근 댓글 기록은 유지됩니다. 삭제된 댓글·기록 또는 접근 권한이 사라진 지도는 표시하지 않습니다. 최대 100개를 표시합니다. 브라우저 푸시 알림은 포함하지 않습니다.

배포 전 `supabase/migrations/202610100004_comment_notifications.sql`을 적용하세요. 기존 최근 30일 댓글도 목록에 추가됩니다. 원격 DB 적용은 별도로 필요합니다.

댓글 테이블이 이미 있는데 댓글 조회가 실패하는 경우 생성용 마이그레이션을 다시 실행하지 말고 `supabase/repair-comment-setup.sql`을 SQL Editor에서 실행하세요. 기존 댓글·즐겨찾기·읽음 상태를 유지하며 반복 실행할 수 있습니다. 복구 SQL은 `node scripts/generate-comment-repair.mjs`로 원본 마이그레이션에서 재생성합니다. 구조·권한 확인용 SQL은 `supabase/check-comment-setup.sql`입니다. API 오류의 DB 코드는 추가 진단에 사용할 수 있습니다.


### 전체 백업과 복원

지도·여행·모아보기의 **전체 백업**에서 사진 원본과 기록·댓글·여행 일정·이모티콘을 ZIP으로 내려받습니다. 파일 검사, 오프라인 기록보기, 기존 데이터를 덮어쓰지 않는 PC 복원 도구와 대용량 폴더 백업 도구를 제공합니다. 배포 전에 `supabase/migrations/202610110001_workspace_backup.sql`을 적용하세요. [백업·복원 안내](docs/backup/README.md)를 확인하세요. 실제 운영 백업은 배포 후 버튼으로 직접 내려받아 보관해야 합니다.
