begin;
select plan(4);
select has_table('public', 'visits', 'visits table exists');
select has_table('public', 'group_members', 'group membership table exists');
select policies_are('public', 'visits', array['visits_read','visits_insert','visits_update'], 'visits has explicit policies');
select policies_are('storage', 'objects', array['storage_group_read','storage_group_insert','storage_group_delete'], 'visit photos are group-private');
select * from finish();
rollback;
