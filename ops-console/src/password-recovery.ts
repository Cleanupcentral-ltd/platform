const RECOVERY_QUERY_PARAMETER = "recovery";

export function buildPasswordRecoveryRedirect(
  origin: string,
): string {
  const redirect = new URL("/ops/leads", origin);
  redirect.searchParams.set(RECOVERY_QUERY_PARAMETER, "1");
  return redirect.toString();
}

export function isPasswordRecoveryReturn(url: string): boolean {
  return (
    new URL(url).searchParams.get(RECOVERY_QUERY_PARAMETER) === "1"
  );
}
