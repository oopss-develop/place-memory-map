-- Run after all migrations with supabase test db. Fixtures are rolled back.
begin;
select no_plan();
insert into auth.users(id,email,raw_user_meta_data) values
 ('10000000-0000-4000-8000-000000000001','memory-owner@example.test','{}'),
 ('10000000-0000-4000-8000-000000000002','memory-outsider@example.test','{}');
insert into public.groups(id,name,created_by) values
 ('20000000-0000-4000-8000-000000000001','Memory fixtures','10000000-0000-4000-8000-000000000001');
insert into public.group_members(group_id,user_id,role) values
 ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','owner');
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
select set_config('test.visit_input','{"groupId":"20000000-0000-4000-8000-000000000001","place":{"provider":"manual","name":"Reliable memory","address":"Seoul","category":"walk","latitude":37,"longitude":127},"visitedOn":"2026-10-01","title":"Memory","note":"Note","rating":5,"tags":["walk"],"isPlanned":false,"markerStyle":"black-9","participantIds":["10000000-0000-4000-8000-000000000001"]}',true);
select set_config('test.visit_id',(public.save_visit(current_setting('test.visit_input')::jsonb,'40000000-0000-4000-8000-000000000001',true)->>'id'),true);
select is(public.save_visit(current_setting('test.visit_input')::jsonb,'40000000-0000-4000-8000-000000000001',true)->>'id',current_setting('test.visit_id'),'repeated create returns same record');
select is((select count(*)::int from public.visits),1,'no duplicate visit');
select is((select count(*)::int from public.places),1,'no duplicate place');
select is((select count(*)::int from public.visit_participants),1,'participants saved atomically');
select set_config('test.photo_id',(public.reserve_visit_photo(current_setting('test.visit_id')::uuid,'50000000-0000-4000-8000-000000000001','hash')->>'id'),true);
select is(public.reserve_visit_photo(current_setting('test.visit_id')::uuid,'50000000-0000-4000-8000-000000000001','hash')->>'id',current_setting('test.photo_id'),'photo retry reuses reservation');
select throws_ok($$select public.reserve_visit_photo(current_setting('test.visit_id')::uuid,'50000000-0000-4000-8000-000000000001','different')$$,'P0001',null,'same photo request cannot change bytes');
select lives_ok($$select public.complete_visit_photo(current_setting('test.visit_id')::uuid,'50000000-0000-4000-8000-000000000001')$$,'complete upload');
update public.visits set deleted_at=now(),version=2 where id=current_setting('test.visit_id')::uuid;
select is((select count(*)::int from public.visit_photos),1,'soft deletion retains photo metadata');
select throws_ok($$select public.restore_visit(current_setting('test.visit_id')::uuid,1)$$,'40001',null,'stale restore rejected');
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
select is((select count(*)::int from public.visits),0,'outsider cannot read trash');
select is((select count(*)::int from public.visit_photos),0,'outsider cannot read photos');
select throws_ok($$select public.restore_visit(current_setting('test.visit_id')::uuid,2)$$,'42501',null,'outsider cannot restore');
select throws_ok($$select public.reserve_visit_photo(current_setting('test.visit_id')::uuid,'50000000-0000-4000-8000-000000000002','hash')$$,'42501',null,'outsider cannot upload');
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
select is((public.restore_visit(current_setting('test.visit_id')::uuid,2)->>'version')::int,3,'restore increments version');
select is((select count(*)::int from public.visit_photos where upload_state='complete'),1,'restore retains completed photos');
select throws_ok($$select public.save_visit(current_setting('test.visit_input')::jsonb||jsonb_build_object('id',current_setting('test.visit_id'),'version',1),'40000000-0000-4000-8000-000000000002',false)$$,'40001',null,'stale edit rejected');
update public.visits set deleted_at=now()-interval '31 days',version=4 where id=current_setting('test.visit_id')::uuid;
select throws_ok($$select public.restore_visit(current_setting('test.visit_id')::uuid,4)$$,'P0002',null,'expired record cannot restore');
select throws_ok($$select public.claim_expired_visits()$$,'42501',null,'cleanup is service-role only');
select * from finish();
rollback;
