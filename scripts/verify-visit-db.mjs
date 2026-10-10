// An in-memory PostgreSQL fallback for environments without Docker.
// Auth identities and Storage metadata are fixtures; Supabase JWT/Storage HTTP
// integration must still be checked with `supabase test db` and a staging app.
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { readFile, readdir } from "node:fs/promises";
import assert from "node:assert/strict";
const db=new PGlite({extensions:{pgcrypto}});
let checks=0;
const owner="10000000-0000-4000-8000-000000000001", outsider="10000000-0000-4000-8000-000000000002", group="20000000-0000-4000-8000-000000000001", requestId="40000000-0000-4000-8000-000000000001", fileId="50000000-0000-4000-8000-000000000001";
const query=async(sql,args=[])=> (await db.query(sql,args)).rows;
async function count(table){return Number((await query(`select count(*)::int as count from public.${table}`))[0].count);}
function check(actual,expected,message){assert.deepEqual(actual,expected,message);checks++;}
async function rejects(sql,args,code){await assert.rejects(()=>query(sql,args),error=>error.code===code);checks++;}
async function identity(id,role="authenticated"){
  await db.exec("reset role");await query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec(`set role ${role}`);
}
try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth,storage,public to anon,authenticated,service_role;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
    alter table storage.objects enable row level security;
    create function storage.foldername(name text) returns text[] language sql immutable as $$select string_to_array(name,'/')$$;
    grant select,insert,update,delete on storage.objects to authenticated;
  `);
  for(const name of (await readdir("supabase/migrations")).filter(name=>name.endsWith(".sql")).sort()){
    await db.exec(await readFile("supabase/migrations/"+name,"utf8"));
    console.log("Migration:",name);
  }
  await query("insert into auth.users(id,email) values ($1,'owner@example.test'),($2,'outsider@example.test')",[owner,outsider]);
  await query("insert into public.groups(id,name,created_by) values($1,'SQL verification',$2)",[group,owner]);
  await query("insert into public.group_members(group_id,user_id,role) values($1,$2,'owner')",[group,owner]);
  await identity(owner);
  const input={groupId:group,place:{provider:"manual",name:"Reliable memory",address:"Seoul",category:"walk",latitude:37,longitude:127},visitedOn:"2026-10-01",isPlanned:false,title:"Memory",note:"Note",rating:5,tags:["walk"],markerStyle:"black-9",participantIds:[owner],version:1};
  const save=async(body,key=requestId,creating=true)=>(await query("select public.save_visit($1::jsonb,$2::uuid,$3) as result",[JSON.stringify(body),key,creating]))[0].result;
  const visit=await save(input);
  const commentId="60000000-0000-4000-8000-000000000001";
  const addComment=(body="함께해서 좋았어요")=>query("select public.add_visit_comment($1,$2,$3) as comment",[visit.id,commentId,body]);
  await addComment(); await addComment();
  check(await count("visit_comments"),1,"comment retries create only one comment");
  await rejects("select public.add_visit_comment($1,$2,$3)",[visit.id,commentId,"changed"],"40001");
  await rejects("select public.add_visit_comment($1,$2,$3)",[visit.id,"60000000-0000-4000-8000-000000000002"," "],"22023");
  await rejects("select public.add_visit_comment($1,$2,$3)",[visit.id,"60000000-0000-4000-8000-000000000002","x".repeat(1001)],"22023");
  await identity(outsider);
  check(await count("visit_comments"),0,"outsider cannot read comments");
  await rejects("select public.add_visit_comment($1,$2,$3)",[visit.id,"60000000-0000-4000-8000-000000000002","no access"],"42501");
  await rejects("select public.delete_visit_comment($1,$2)",[visit.id,commentId],"42501");
  await identity(owner);
  await db.exec("reset role");
  await query("insert into public.group_members(group_id,user_id,role) values($1,$2,'member')",[group,outsider]);
  await identity(outsider);
  check(await count("visit_comments"),1,"group member can read comments");
  await rejects("select public.delete_visit_comment($1,$2)",[visit.id,commentId],"42501");
  await rejects("insert into public.visit_comments(id,visit_id,author_id,body) values($1,$2,$3,'spoof')",["60000000-0000-4000-8000-000000000002",visit.id,owner],"42501");
  await identity(owner);
  await query("delete from public.group_members where group_id=$1 and user_id=$2",[group,outsider]);
  await query("select public.delete_visit_comment($1,$2)",[visit.id,commentId]);
  check(await count("visit_comments"),0,"author can delete own comment");
  await addComment();
  check((await save(input)).id,visit.id,"create replay returns the original ID");
  check(await count("visits"),1,"one visit after replay");check(await count("places"),1,"one place after replay");check(await count("visit_participants"),1,"participants saved atomically");
  const photo=(await query("select public.reserve_visit_photo($1,$2,'hash') as result",[visit.id,fileId]))[0].result;
  check((await query("select public.reserve_visit_photo($1,$2,'hash') as result",[visit.id,fileId]))[0].result.id,photo.id,"photo replay returns the original ID");
  await rejects("select public.reserve_visit_photo($1,$2,'different')",[visit.id,fileId],"P0001");
  await query("select public.complete_visit_photo($1,$2)",[visit.id,fileId]);
  const updateKey="40000000-0000-4000-8000-000000000002";
  check((await save({...input,id:visit.id},updateKey,false)).version,2,"update increments version");
  check((await save({...input,id:visit.id},updateKey,false)).version,2,"update replay does not increment again");
  await rejects("select public.save_visit($1::jsonb,$2,false)",[JSON.stringify({...input,id:visit.id}),"40000000-0000-4000-8000-000000000003"],"40001");
  await query("update public.visits set deleted_at=now(),version=3 where id=$1",[visit.id]);
  check(await count("visit_comments"),0,"comments are hidden on deleted visits");
  await rejects("select public.add_visit_comment($1,$2,$3)",[visit.id,"60000000-0000-4000-8000-000000000002","deleted"],"42501");
  check(await count("visit_photos"),1,"deleting a record retains its photos");
  await rejects("select public.restore_visit($1,2)",[visit.id],"40001");
  await identity(outsider);
  check(await count("visits"),0,"outsider cannot read trash");check(await count("visit_photos"),0,"outsider cannot read photo metadata");
  await rejects("select public.restore_visit($1,3)",[visit.id],"42501");
  await rejects("select public.reserve_visit_photo($1,$2,'hash')",[visit.id,fileId],"42501");
  await rejects("select public.save_visit($1::jsonb,$2,true)",[JSON.stringify(input),requestId],"42501");
  await rejects("select public.claim_expired_visits()",[],"42501");
  await identity(owner);
  check((await query("select public.restore_visit($1,3) as result",[visit.id]))[0].result.version,4,"restore increments version");
  check(await count("visit_comments"),1,"restoring a visit restores comment visibility");
  check((await query("select upload_state from public.visit_photos where id=$1",[photo.id]))[0].upload_state,"complete","restore keeps the completed photo");
  await rejects("select public.save_visit($1::jsonb,$2,true)",[JSON.stringify({...input,participantIds:[outsider]}),"40000000-0000-4000-8000-000000000004"],"42501");
  check(await count("visits"),1,"invalid participants leave no extra visit");check(await count("places"),1,"invalid participants leave no orphan place");
  await query("update public.visits set deleted_at=now()-interval '31 days',version=5 where id=$1",[visit.id]);
  await rejects("select public.restore_visit($1,5)",[visit.id],"P0002");
  await identity(owner,"service_role");
  check((await query("select * from public.claim_expired_visits()")).length,1,"maintenance claims expired records");
  await identity(owner);
  await rejects("select public.restore_visit($1,5)",[visit.id],"P0002");
  const fresh=await save(input,"40000000-0000-4000-8000-000000000005");
  const fileIds=Array.from({length:6},(_,index)=>`50000000-0000-4000-8000-${String(index+10).padStart(12,"0")}`);
  for(const id of fileIds.slice(0,5)) await query("select public.reserve_visit_photo($1,$2,'hash')",[fresh.id,id]);
  await rejects("select public.reserve_visit_photo($1,$2,'hash')",[fresh.id,fileIds[5]],"P0001");
  await query("update public.visit_photos set created_at=now()-interval '8 days' where visit_id=$1 and client_file_id=$2",[fresh.id,fileIds[0]]);
  await identity(owner,"service_role");
  check((await query("select public.release_stale_photo_reservations() as count"))[0].count,1,"abandoned photo releases its slot");
  await identity(owner);
  await rejects("select public.complete_visit_photo($1,$2)",[fresh.id,fileIds[0]],"P0001");
  check((await query("select public.reserve_visit_photo($1,$2,'hash') as result",[fresh.id,fileIds[5]]))[0].result.upload_state,"pending","slot can be reused with a new request ID");
  await query("insert into storage.objects(bucket_id,name) values('visit-photos',$1)",[group+"/"+fresh.id+"/photo.webp"]);
  check((await query("select count(*)::int as count from storage.objects"))[0].count,1,"member can access their private Storage path");
  await identity(outsider);
  check((await query("select count(*)::int as count from storage.objects"))[0].count,0,"outsider cannot access private Storage paths");
  await identity(owner,"anon");
  await rejects("select public.save_visit($1::jsonb,$2,true)",[JSON.stringify(input),requestId],"42501");

  await identity(owner);
  const groupRequest="40000000-0000-4000-8000-000000000021";
  const newGroup=(await query("select public.create_group_once('Retry map',$1) as id",[groupRequest]))[0].id;
  check((await query("select public.create_group_once('Retry map',$1) as id",[groupRequest]))[0].id,newGroup,"map replay returns original ID");
  const tripInput={groupId:group,name:"Retry trip",startDate:"2026-10-01",endDate:"2026-10-02",timeZone:"Asia/Seoul",version:1,requestId:"40000000-0000-4000-8000-000000000022"};
  const savedTrip=(await query("select to_jsonb(public.save_trip($1::jsonb)) as trip",[JSON.stringify(tripInput)]))[0].trip;
  check((await query("select to_jsonb(public.save_trip($1::jsonb)) as trip",[JSON.stringify(tripInput)]))[0].trip.id,savedTrip.id,"trip replay returns original ID");
  const updateTrip={...tripInput,id:savedTrip.id,name:"Updated",requestId:"40000000-0000-4000-8000-000000000023"};
  check((await query("select to_jsonb(public.save_trip($1::jsonb)) as trip",[JSON.stringify(updateTrip)]))[0].trip.version,2,"trip update increments once");
  check((await query("select to_jsonb(public.save_trip($1::jsonb)) as trip",[JSON.stringify(updateTrip)]))[0].trip.version,2,"trip update replay does not increment");
  const scheduleInput={startsAt:"2026-10-01T09:00",endsAt:"2026-10-01T10:00",title:"Retry stop",note:"",version:1,place:{provider:"manual",name:"Stop",latitude:37,longitude:127},requestId:"40000000-0000-4000-8000-000000000024"};
  const scheduleId=(await query("select public.save_schedule_item($1,$2::jsonb) as id",[savedTrip.id,JSON.stringify(scheduleInput)]))[0].id;
  const placeCount=await count("places");
  check((await query("select public.save_schedule_item($1,$2::jsonb) as id",[savedTrip.id,JSON.stringify(scheduleInput)]))[0].id,scheduleId,"schedule replay returns original ID");
  check(await count("places"),placeCount,"schedule retry creates no extra manual place");
  const scheduleUpdate={...scheduleInput,id:scheduleId,title:"Updated stop",requestId:"40000000-0000-4000-8000-000000000025"};
  await query("select public.save_schedule_item($1,$2::jsonb)",[savedTrip.id,JSON.stringify(scheduleUpdate)]);
  await query("select public.save_schedule_item($1,$2::jsonb)",[savedTrip.id,JSON.stringify(scheduleUpdate)]);
  check((await query("select version from public.schedule_items where id=$1",[scheduleId]))[0].version,2,"schedule update replay increments once");
  const existingPlace=(await query("select place_id from public.schedule_items where id=$1",[scheduleId]))[0].place_id;
  const beforeReuse=await count("places");
  await save({...input,place:{...input.place,id:existingPlace}},"40000000-0000-4000-8000-000000000026");
  check(await count("places"),beforeReuse,"manual visit reuses an existing place");
  check(String((await query("select visit_count from public.dashboard_group_counts() where group_id=$1",[group]))[0].visit_count),String((await query("select count(*) as count from public.visits where group_id=$1 and deleted_at is null",[group]))[0].count),"dashboard counts use RLS-visible visits");
  await identity(outsider);
  await rejects("select public.save_trip($1::jsonb)",[JSON.stringify(tripInput)],"42501");
  await rejects("select public.save_schedule_item($1,$2::jsonb)",[savedTrip.id,JSON.stringify(scheduleInput)],"42501");
  check((await query("select count(*)::int as count from public.dashboard_group_counts()"))[0].count,0,"outsider cannot read map counts");
  console.log(`PostgreSQL verification: ${checks} checks passed (Auth/Storage fixtures).`);
} finally { await db.close(); }
