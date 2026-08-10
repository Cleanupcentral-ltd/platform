-- Prevent the RLS event-trigger function from being exposed as a Data API RPC.
-- The ensure_rls event trigger remains enabled and invokes this function internally.

revoke execute on function public.rls_auto_enable()
from public, anon, authenticated;
