alter table lead_engine.search_runs
drop constraint if exists
  search_runs_sector_check;

alter table lead_engine.search_runs
add constraint search_runs_sector_check
check (
  sector in (
    'short_let_serviced_accommodation',
    'offices_coworking',
    'community_halls_event_venues',
    'estate_letting_agents',
    'university_accommodation',
    'other_commercial_spaces'
  )
);

alter table lead_engine.prospects
drop constraint if exists
  prospects_sector_check;

alter table lead_engine.prospects
add constraint prospects_sector_check
check (
  sector in (
    'short_let_serviced_accommodation',
    'offices_coworking',
    'community_halls_event_venues',
    'estate_letting_agents',
    'university_accommodation',
    'other_commercial_spaces'
  )
);
