-- Final Google discovery re-enable gate.
-- Apply only after:
-- 1. 20260814210000_compliant_google_search_redesign.sql is live,
-- 2. the backend using claim_automatic_qualification_jobs_v2 is live,
-- 3. the redesigned founder console is live and verified.

-- This trigger was intentionally installed while the compliant UI and
-- Place-ID re-resolution path were incomplete.
drop trigger if exists pause_google_search_until_redesign
  on lead_engine.search_runs;

drop function if exists
lead_engine.pause_google_search_until_redesign();
