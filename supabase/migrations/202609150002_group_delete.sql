create policy groups_delete_owner on public.groups
  for delete to authenticated
  using (private.is_group_owner(id));
