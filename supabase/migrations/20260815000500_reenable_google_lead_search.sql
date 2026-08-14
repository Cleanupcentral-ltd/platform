-- The Figma discovery UI, Google attribution, transient rich-result handling,
-- Place-ID-only persistence and saved-prospect Place Details bridge are live.
-- Remove the temporary production gate so founder Google lead discovery can
-- resume through the compliant redesigned flow.

drop trigger if exists pause_google_search_until_redesign
  on lead_engine.search_runs;

drop function if exists
lead_engine.pause_google_search_until_redesign();
