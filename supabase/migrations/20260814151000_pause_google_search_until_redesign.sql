-- Temporary Stage 5 compliance gate.
-- Keep founder review/verification available while preventing new Google
-- discovery calls until the redesigned search UI includes required attribution
-- and the compliant Place-ID re-resolution flow is implemented.

create or replace function lead_engine.pause_google_search_until_redesign()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  raise exception
    'Lead search is temporarily paused until the compliant redesign is deployed.'
    using errcode = '55000';
end
$function$;

drop trigger if exists pause_google_search_until_redesign
  on lead_engine.search_runs;

create trigger pause_google_search_until_redesign
before insert on lead_engine.search_runs
for each row
execute function lead_engine.pause_google_search_until_redesign();
