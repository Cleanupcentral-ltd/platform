begin;

insert into lead_engine.search_runs (
  postcode,
  radius_miles,
  sector,
  created_by
)
values (
  'BR1 1AA',
  5,
  'university_accommodation',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
);

insert into lead_engine.prospects (
  dedupe_key,
  business_name,
  sector
)
values (
  'university-accommodation-test',
  'University Accommodation Test',
  'university_accommodation'
);

select 1 / case
  when (
    select count(*)
    from lead_engine.search_runs
    where sector =
      'university_accommodation'
  ) = 1 and (
    select count(*)
    from lead_engine.prospects
    where sector =
      'university_accommodation'
  ) = 1
  then 1
  else 0
end as university_sector_passed;

rollback;
