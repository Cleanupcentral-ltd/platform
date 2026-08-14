alter table lead_engine.search_runs
add column if not exists search_mode text
  not null default 'postcode',
add column if not exists borough text;

alter table lead_engine.search_runs
alter column postcode drop not null,
alter column radius_miles drop not null;

alter table lead_engine.search_runs
drop constraint if exists
  search_runs_search_mode_check;

alter table lead_engine.search_runs
add constraint
  search_runs_search_mode_check
check (
  search_mode in (
    'postcode',
    'borough'
  )
);

alter table lead_engine.search_runs
drop constraint if exists
  search_runs_location_mode_check;

alter table lead_engine.search_runs
add constraint
  search_runs_location_mode_check
check (
  (
    search_mode = 'postcode' and
    postcode is not null and
    radius_miles is not null and
    borough is null
  ) or
  (
    search_mode = 'borough' and
    borough is not null and
    postcode is null and
    radius_miles is null
  )
);

comment on column
  lead_engine.search_runs.search_mode is
  'Founder search provenance: postcode radius or verified London borough.';

comment on column
  lead_engine.search_runs.borough is
  'Canonical London borough for borough-mode discovery; null for postcode searches.';
