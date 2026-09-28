-- Run with supabase test db. All fixtures are rolled back.
begin;
select no_plan();
insert into auth.users(id, email, raw_user_meta_data) values
 ('10000000-0000-4000-8000-000000000001', 'trip-owner@example.test', '{}'),
 ('10000000-0000-4000-8000-000000000002', 'trip-member@example.test', '{}'),
 ('10000000-0000-4000-8000-000000000003', 'trip-outsider@example.test', '{}');
insert into public.groups(id,name,created_by) values
 ('20000000-0000-4000-8000-000000000001','Trip test','10000000-0000-4000-8000-000000000001'),
 ('20000000-0000-4000-8000-000000000002','Other group','10000000-0000-4000-8000-000000000003');
insert into public.group_members(group_id,user_id,role) values
 ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','owner'),
 ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','member'),
 ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000003','owner');
insert into public.places(id,group_id,provider,name,latitude,longitude,created_by) values
 ('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','manual','Saved place',37.5,127,'10000000-0000-4000-8000-000000000001'),
 ('30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','manual','Other place',35,129,'10000000-0000-4000-8000-000000000003');
insert into public.trips(id,group_id,name,start_date,end_date,created_by,updated_by) values
 ('40000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Fixture trip','2026-09-28','2026-09-30','10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001');
insert into public.visits(id,group_id,place_id,visited_on,title,rating,created_by,updated_by) values
 ('50000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','2026-09-01','Original memory',4,'10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001');

set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
select is((select count(*)::int from public.trips where id = '40000000-0000-4000-8000-000000000001'),1,'member can read shared trip');
select throws_ok($$insert into public.trips(group_id,name,start_date,end_date,created_by,updated_by) values ('20000000-0000-4000-8000-000000000001','Bypass','2026-09-28','2026-09-28',auth.uid(),auth.uid())$$,'42501',null,'direct writes are forbidden');
select lives_ok($$select public.save_trip('{"groupId":"20000000-0000-4000-8000-000000000001","name":"Member trip","startDate":"2026-10-01","endDate":"2026-10-02","timeZone":"Asia/Tokyo"}')$$,'member can create a trip');
select throws_ok($$select public.save_trip('{"groupId":"20000000-0000-4000-8000-000000000002","name":"Foreign","startDate":"2026-10-01","endDate":"2026-10-02"}')$$,'42501',null,'member cannot write another group');
select throws_ok($$select public.save_trip('{"groupId":"20000000-0000-4000-8000-000000000001","name":"Bad zone","startDate":"2026-10-01","endDate":"2026-10-02","timeZone":"Invalid/Zone"}')$$,'22023',null,'invalid timezone is rejected');
select set_config('test.item_id', public.save_schedule_item('40000000-0000-4000-8000-000000000001',
 '{"place":{"id":"30000000-0000-4000-8000-000000000001"},"startsAt":"2026-09-28T23:00","endsAt":"2026-09-29T01:00","title":"Overnight","note":"","markerStyle":"black-9"}')::text, true);
select is((select count(*)::int from public.schedule_items),1,'schedule saved');
select is((select created_by from public.schedule_items where id = current_setting('test.item_id')::uuid),auth.uid(),'author comes from auth');
select is((select visited_on::text from public.visits where id = '50000000-0000-4000-8000-000000000001'),'2026-09-01','original visit is untouched');
select is((select starts_at::text from public.schedule_items where id = current_setting('test.item_id')::uuid),'2026-09-28 23:00:00','local clock stored without conversion');
select throws_ok($$select public.save_schedule_item('40000000-0000-4000-8000-000000000001','{"place":{"id":"30000000-0000-4000-8000-000000000002"},"startsAt":"2026-09-29T09:00","endsAt":"2026-09-29T10:00","title":"Wrong group"}')$$,'42501',null,'foreign place is rejected');
select throws_ok($$select public.save_schedule_item('40000000-0000-4000-8000-000000000001','{"place":{"provider":"manual","name":"Must rollback","latitude":37,"longitude":127},"startsAt":"2026-10-01T09:00","endsAt":"2026-10-01T10:00","title":"Outside"}')$$,'22023',null,'outside-trip insert rejected');
select is((select count(*)::int from public.places where name = 'Must rollback'),0,'failed schedule leaves no orphan place');
select throws_ok($$select public.save_trip('{"id":"40000000-0000-4000-8000-000000000001","groupId":"20000000-0000-4000-8000-000000000001","name":"Shorten","startDate":"2026-09-28","endDate":"2026-09-28","timeZone":"Asia/Seoul","version":2}')$$,'22023',null,'trip shrink cannot strand items');
select throws_ok($$select public.save_trip('{"id":"40000000-0000-4000-8000-000000000001","name":"Stale","startDate":"2026-09-28","endDate":"2026-09-30","timeZone":"Asia/Seoul","version":1}')$$,'40001',null,'stale trip version rejected');
select throws_ok($$select public.delete_trip('40000000-0000-4000-8000-000000000001',1)$$,'40001',null,'child edit protects stale whole-trip deletion');
select throws_ok($$select public.save_schedule_item('40000000-0000-4000-8000-000000000001',jsonb_build_object('id',current_setting('test.item_id'),'version',99,'place',jsonb_build_object('id','30000000-0000-4000-8000-000000000001'),'startsAt','2026-09-29T09:00','endsAt','2026-09-29T10:00','title','Stale'))$$,'40001',null,'stale item version rejected');
select throws_ok($$select public.save_schedule_item('40000000-0000-4000-8000-000000000001','{"place":{"id":"30000000-0000-4000-8000-000000000001"},"startsAt":"2026-09-29T09:00","endsAt":"2026-09-29T09:00","title":"Zero"}')$$,'23514',null,'zero duration rejected');
select lives_ok($$select public.save_schedule_item('40000000-0000-4000-8000-000000000001','{"place":{"provider":"kakao","providerPlaceId":"timetable-test","name":"Search place","latitude":37,"longitude":127},"startsAt":"2026-09-29T09:00","endsAt":"2026-09-29T10:00","title":"Search"}')$$,'search creates place and item');
select lives_ok($$select public.save_schedule_item('40000000-0000-4000-8000-000000000001','{"place":{"provider":"kakao","providerPlaceId":"timetable-test","name":"Search place","latitude":37,"longitude":127},"startsAt":"2026-09-29T10:00","endsAt":"2026-09-29T11:00","title":"Revisit"}')$$,'same searched place can be revisited');
select is((select count(*)::int from public.places where provider_place_id = 'timetable-test'),1,'provider place is reused');
select lives_ok($$select public.save_trip_route(
 '40000000-0000-4000-8000-000000000001','2026-09-28','kakao',repeat('a',64),'road',
 '[{"latitude":37.5,"longitude":127.0},{"latitude":37.6,"longitude":127.1}]'::jsonb,12000,900)$$,
 'member can save a route cache');
select is((select count(*)::int from public.trip_route_cache where trip_id = '40000000-0000-4000-8000-000000000001'),1,'member can read the shared route cache');
select throws_ok($$insert into public.trip_route_cache(trip_id,route_date,provider,signature,route_kind,route_points,created_by) values ('40000000-0000-4000-8000-000000000001','2026-09-28','kakao',repeat('b',64),'road','[{"latitude":37,"longitude":127},{"latitude":38,"longitude":128}]','10000000-0000-4000-8000-000000000002')$$,'42501',null,'direct route cache writes are forbidden');

select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',true);
select is((select count(*)::int from public.trips),0,'outsider cannot read trips');
select is((select count(*)::int from public.schedule_items),0,'outsider cannot read items');
select is((select count(*)::int from public.trip_route_cache),0,'outsider cannot read route cache');
select throws_ok($$select public.delete_trip('40000000-0000-4000-8000-000000000001',4)$$,'42501',null,'outsider cannot delete');
select throws_ok($$select public.save_schedule_item('40000000-0000-4000-8000-000000000001','{}')$$,'42501',null,'outsider cannot add items');
select throws_ok($$select public.save_trip_route('40000000-0000-4000-8000-000000000001','2026-09-28','kakao',repeat('c',64),'road','[{"latitude":37,"longitude":127},{"latitude":38,"longitude":128}]'::jsonb)$$,'42501',null,'outsider cannot save route cache');
set local role anon;
select throws_ok($$select * from public.trips$$,'42501',null,'anonymous reads forbidden');
select throws_ok($$select public.save_trip('{}')$$,'42501',null,'anonymous RPC forbidden');

set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
select lives_ok($$select public.delete_schedule_item('40000000-0000-4000-8000-000000000001',current_setting('test.item_id')::uuid,1)$$,'another member can delete an item');
select is((select count(*)::int from public.schedule_items where id = current_setting('test.item_id')::uuid),0,'deleted item hidden');
select lives_ok($$select public.delete_trip('40000000-0000-4000-8000-000000000001',5)$$,'member can delete current trip');
select is((select count(*)::int from public.schedule_items where trip_id = '40000000-0000-4000-8000-000000000001'),0,'trip deletion hides all children');
select is((select count(*)::int from public.visits where id = '50000000-0000-4000-8000-000000000001'),1,'trip deletion preserves original visit');
reset role;
select is((select count(*)::int from public.schedule_items where trip_id = '40000000-0000-4000-8000-000000000001' and deleted_at is not null),3,'children soft-deleted');
select throws_ok($$insert into public.schedule_items(group_id,trip_id,place_id,starts_at,ends_at,title,created_by,updated_by) select group_id,id,'30000000-0000-4000-8000-000000000002','2026-10-01 09:00','2026-10-01 10:00','Foreign FK',created_by,updated_by from public.trips where name = 'Member trip'$$,'23503',null,'composite FK blocks cross-group place even for privileged writes');
delete from public.groups where id = '20000000-0000-4000-8000-000000000001';
select is((select count(*)::int from public.trips where group_id = '20000000-0000-4000-8000-000000000001'),0,'group deletion cascades trips');
select is((select count(*)::int from public.schedule_items where group_id = '20000000-0000-4000-8000-000000000001'),0,'group deletion cascades items');
select is((select count(*)::int from public.trip_route_cache),0,'group deletion cascades route cache');
select * from finish();
rollback;
