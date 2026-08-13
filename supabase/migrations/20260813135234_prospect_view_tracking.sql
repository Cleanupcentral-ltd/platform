create table lead_engine.prospect_views (
  founder_id uuid not null,
  prospect_id uuid not null
    references lead_engine.prospects(id)
    on delete cascade,
  first_viewed_at timestamptz not null
    default now(),
  last_viewed_at timestamptz not null
    default now(),
  primary key (founder_id, prospect_id),
  constraint prospect_views_founder_id_not_nil
    check (
      founder_id <>
        '00000000-0000-0000-0000-000000000000'::uuid
    ),
  constraint prospect_views_timestamp_order
    check (last_viewed_at >= first_viewed_at)
);

comment on table lead_engine.prospect_views is
  'Per-founder prospect view state. No row means unseen.';

create index prospect_views_prospect_id_idx
on lead_engine.prospect_views (prospect_id);

alter table lead_engine.prospect_views
enable row level security;

alter table lead_engine.prospect_views
force row level security;

revoke all on table lead_engine.prospect_views
from public, anon, authenticated;

grant select, insert, update, delete
on table lead_engine.prospect_views
to service_role;

create or replace function
lead_engine.set_prospect_view_state(
  p_founder_id uuid,
  p_prospect_id uuid,
  p_viewed boolean
)
returns table (
  viewed_at timestamptz
)
language plpgsql
security invoker
set search_path = ''
as $set_prospect_view_state$
begin
  if p_founder_id is null or
    p_founder_id =
      '00000000-0000-0000-0000-000000000000'::uuid or
    p_prospect_id is null or
    p_viewed is null
  then
    raise exception
      'valid founder, prospect and view state are required'
      using errcode = '22023';
  end if;

  if p_viewed then
    return query
    insert into lead_engine.prospect_views as view_state (
      founder_id,
      prospect_id
    ) values (
      p_founder_id,
      p_prospect_id
    )
    on conflict (founder_id, prospect_id)
    do update set
      last_viewed_at = greatest(
        view_state.last_viewed_at,
        clock_timestamp()
      )
    returning view_state.last_viewed_at;
  else
    delete from lead_engine.prospect_views
    where founder_id = p_founder_id
      and prospect_id = p_prospect_id;

    return query
    select null::timestamptz;
  end if;
end
$set_prospect_view_state$;

revoke all on function
lead_engine.set_prospect_view_state(
  uuid,
  uuid,
  boolean
)
from public, anon, authenticated;

grant execute on function
lead_engine.set_prospect_view_state(
  uuid,
  uuid,
  boolean
)
to service_role;
