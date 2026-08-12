begin;

select plan(5);

select has_function(
  'lead_engine',
  'record_companies_house_verification',
  array['uuid', 'uuid', 'text', 'jsonb'],
  'Companies House verification RPC exists'
);

select function_lang_is(
  'lead_engine',
  'record_companies_house_verification',
  array['uuid', 'uuid', 'text', 'jsonb'],
  'plpgsql',
  'Companies House verification RPC uses PL/pgSQL'
);

select function_privs_are(
  'lead_engine',
  'record_companies_house_verification',
  array['uuid', 'uuid', 'text', 'jsonb'],
  'anon',
  array[]::text[],
  'Anonymous users cannot execute Companies House verification'
);

select function_privs_are(
  'lead_engine',
  'record_companies_house_verification',
  array['uuid', 'uuid', 'text', 'jsonb'],
  'authenticated',
  array[]::text[],
  'Authenticated browser users cannot execute Companies House verification'
);

select function_privs_are(
  'lead_engine',
  'record_companies_house_verification',
  array['uuid', 'uuid', 'text', 'jsonb'],
  'service_role',
  array['EXECUTE'],
  'Only the backend service role can execute Companies House verification'
);

select * from finish();

rollback;
