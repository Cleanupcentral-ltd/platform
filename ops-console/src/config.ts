export interface OpsConsoleConfig {
  readonly enabled: boolean;
  readonly supabaseUrl: string | null;
  readonly supabasePublishableKey: string | null;
  readonly backendUrl: string | null;
}

function clean(value: string | undefined): string | null {
  const result = value?.trim() ?? "";
  return result.length > 0 ? result : null;
}

export function readConfig(): OpsConsoleConfig {
  const enabled =
    import.meta.env.VITE_LEAD_ENGINE_UI_V1 === "true";

  return {
    enabled,
    supabaseUrl: clean(import.meta.env.VITE_SUPABASE_URL),
    supabasePublishableKey: clean(
      import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    ),
    backendUrl: clean(import.meta.env.VITE_BACKEND_URL),
  };
}

export function assertEnabledConfig(
  config: OpsConsoleConfig,
): asserts config is OpsConsoleConfig & {
  readonly supabaseUrl: string;
  readonly supabasePublishableKey: string;
  readonly backendUrl: string;
} {
  const missing = [
    ["VITE_SUPABASE_URL", config.supabaseUrl],
    [
      "VITE_SUPABASE_PUBLISHABLE_KEY",
      config.supabasePublishableKey,
    ],
    ["VITE_BACKEND_URL", config.backendUrl],
  ]
    .filter(([, value]) => value === null)
    .map(([name]) => name);

  if (missing.length > 0) {
    throw new Error(
      `Missing required operations console configuration: ${missing.join(
        ", ",
      )}`,
    );
  }
}
