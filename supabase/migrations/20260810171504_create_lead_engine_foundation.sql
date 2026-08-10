create schema if not exists lead_engine;

revoke all on schema lead_engine
from public, anon, authenticated;

grant usage on schema lead_engine
to service_role;

create table lead_engine.search_runs (
  id uuid primary key default gen_random_uuid(),
  postcode text not null,
  radius_miles numeric(6, 2) not null
    check (radius_miles > 0),
  sector text not null
    check (
      sector in (
        'short_let_serviced_accommodation',
        'offices_coworking',
        'community_halls_event_venues',
        'estate_letting_agents',
        'other_commercial_spaces'
      )
    ),
  status text not null default 'created'
    check (
      status in (
        'created',
        'running',
        'completed',
        'failed'
      )
    ),
  result_count integer not null default 0
    check (result_count >= 0),
  created_by uuid not null,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  check (
    completed_at is null or
    completed_at >= created_at
  )
);

create table lead_engine.prospects (
  id uuid primary key default gen_random_uuid(),
  dedupe_key text not null unique,
  business_name text not null,
  sector text not null
    check (
      sector in (
        'short_let_serviced_accommodation',
        'offices_coworking',
        'community_halls_event_venues',
        'estate_letting_agents',
        'other_commercial_spaces'
      )
    ),
  website_url text,
  primary_postcode text,
  company_number text,
  contact_status text not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table lead_engine.search_run_prospects (
  search_run_id uuid not null
    references lead_engine.search_runs(id)
    on delete restrict,
  prospect_id uuid not null
    references lead_engine.prospects(id)
    on delete restrict,
  source_rank integer
    check (
      source_rank is null or
      source_rank > 0
    ),
  created_at timestamptz not null default now(),
  primary key (
    search_run_id,
    prospect_id
  )
);

create table lead_engine.evidence (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null
    references lead_engine.prospects(id)
    on delete restrict,
  source_url text not null
    check (
      source_url ~* '^https?://'
    ),
  source_type text not null,
  field_name text not null,
  field_value text not null,
  source_excerpt text,
  content_sha256 text
    check (
      content_sha256 is null or
      content_sha256 ~ '^[0-9a-f]{64}$'
    ),
  verification_status text not null default 'unverified'
    check (
      verification_status in (
        'unverified',
        'verified',
        'rejected'
      )
    ),
  captured_at timestamptz not null default now(),
  verified_at timestamptz,
  verified_by uuid,
  check (
    (
      verification_status = 'verified' and
      verified_at is not null and
      verified_by is not null
    ) or
    (
      verification_status <> 'verified'
    )
  )
);

create table lead_engine.contacts (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null
    references lead_engine.prospects(id)
    on delete restrict,
  contact_type text not null
    check (
      contact_type in (
        'email',
        'phone',
        'contact_form'
      )
    ),
  contact_value text not null,
  normalized_value text not null,
  source_evidence_id uuid not null
    references lead_engine.evidence(id)
    on delete restrict,
  verification_status text not null default 'unverified'
    check (
      verification_status in (
        'unverified',
        'verified',
        'rejected'
      )
    ),
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  unique (
    prospect_id,
    contact_type,
    normalized_value
  )
);

create table lead_engine.assessments (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null
    references lead_engine.prospects(id)
    on delete restrict,
  total_score smallint not null
    check (
      total_score between 0 and 10
    ),
  rules_version text not null,
  score_breakdown jsonb not null
    check (
      jsonb_typeof(score_breakdown) = 'object'
    ),
  rationale text not null,
  assessed_by uuid not null,
  assessed_at timestamptz not null default now()
);

create table lead_engine.outreach_drafts (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null
    references lead_engine.prospects(id)
    on delete restrict,
  subject text not null,
  body text not null,
  status text not null default 'draft',
  outlook_draft_id text,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table lead_engine.outreach_draft_evidence (
  outreach_draft_id uuid not null
    references lead_engine.outreach_drafts(id)
    on delete restrict,
  evidence_id uuid not null
    references lead_engine.evidence(id)
    on delete restrict,
  created_at timestamptz not null default now(),
  primary key (
    outreach_draft_id,
    evidence_id
  )
);

create table lead_engine.activities (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null
    references lead_engine.prospects(id)
    on delete restrict,
  activity_type text not null,
  outcome text,
  notes text,
  follow_up_at timestamptz,
  created_by uuid not null,
  created_at timestamptz not null default now()
);

create table lead_engine.suppressions (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid
    references lead_engine.prospects(id)
    on delete restrict,
  suppression_type text not null
    check (
      suppression_type in (
        'business',
        'email',
        'domain',
        'phone'
      )
    ),
  normalized_value text not null,
  reason text not null,
  source text not null,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  lifted_at timestamptz,
  lifted_by uuid,
  check (
    (
      lifted_at is null and
      lifted_by is null
    ) or
    (
      lifted_at is not null and
      lifted_by is not null and
      lifted_at >= created_at
    )
  )
);

create index search_runs_created_cursor_idx
on lead_engine.search_runs (
  created_at desc,
  id desc
);

create index prospects_created_cursor_idx
on lead_engine.prospects (
  created_at desc,
  id desc
);

create index prospects_sector_status_idx
on lead_engine.prospects (
  sector,
  contact_status,
  created_at desc
);

create index search_run_prospects_prospect_idx
on lead_engine.search_run_prospects (
  prospect_id
);

create index evidence_prospect_captured_idx
on lead_engine.evidence (
  prospect_id,
  captured_at desc
);

create index contacts_source_evidence_idx
on lead_engine.contacts (
  source_evidence_id
);

create index contacts_prospect_primary_idx
on lead_engine.contacts (
  prospect_id,
  is_primary
)
where is_primary;

create index assessments_prospect_created_idx
on lead_engine.assessments (
  prospect_id,
  assessed_at desc
);

create index outreach_drafts_prospect_created_idx
on lead_engine.outreach_drafts (
  prospect_id,
  created_at desc
);

create index outreach_draft_evidence_evidence_idx
on lead_engine.outreach_draft_evidence (
  evidence_id
);

create index activities_prospect_created_idx
on lead_engine.activities (
  prospect_id,
  created_at desc
);

create index activities_follow_up_idx
on lead_engine.activities (
  follow_up_at,
  id
)
where follow_up_at is not null;

create index suppressions_prospect_idx
on lead_engine.suppressions (
  prospect_id
)
where prospect_id is not null;

create unique index suppressions_active_value_uidx
on lead_engine.suppressions (
  suppression_type,
  normalized_value
)
where lifted_at is null;

do $lead_engine_rls$
declare
  table_name text;
begin
  foreach table_name in array array[
    'search_runs',
    'prospects',
    'search_run_prospects',
    'evidence',
    'contacts',
    'assessments',
    'outreach_drafts',
    'outreach_draft_evidence',
    'activities',
    'suppressions'
  ]
  loop
    execute format(
      'alter table lead_engine.%I enable row level security',
      table_name
    );

    execute format(
      'alter table lead_engine.%I force row level security',
      table_name
    );

    execute format(
      'create policy founder_mfa_guard on lead_engine.%I for all to authenticated using (((select auth.jwt()) ->> ''aal'') = ''aal2'' and ((select auth.jwt()) -> ''app_metadata'' ->> ''role'') = ''founder'') with check (((select auth.jwt()) ->> ''aal'') = ''aal2'' and ((select auth.jwt()) -> ''app_metadata'' ->> ''role'') = ''founder'')',
      table_name
    );
  end loop;
end
$lead_engine_rls$;

revoke all on all tables in schema lead_engine
from public, anon, authenticated;

grant select, insert, update, delete
on all tables in schema lead_engine
to service_role;

alter default privileges in schema lead_engine
revoke all on tables
from public, anon, authenticated;

alter default privileges in schema lead_engine
grant select, insert, update, delete
on tables
to service_role;

comment on schema lead_engine is
  'Private Lead Engine Lite data. Browser roles have no schema or table privileges.';

comment on table lead_engine.outreach_drafts is
  'Founder-reviewed initial drafts only. Lean v1 does not send email.';

comment on table lead_engine.suppressions is
  'Durable do-not-contact records. Rollback must preserve this table and its data.';
