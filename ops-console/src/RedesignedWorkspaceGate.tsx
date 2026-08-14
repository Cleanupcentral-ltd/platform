import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  assertEnabledConfig,
  readConfig,
} from "./config";

import {
  getSupabaseClient,
} from "./supabase";

import {
  LeadEngineRedesign,
} from "./LeadEngineRedesign";

export function RedesignedWorkspaceGate() {
  const config = useMemo(readConfig, []);
  const [accessToken, setAccessToken] =
    useState<string | null>(null);
  const [exportEnabled, setExportEnabled] =
    useState(false);

  const client = useMemo(() => {
    if (!config.enabled) return null;
    assertEnabledConfig(config);
    return getSupabaseClient(
      config.supabaseUrl,
      config.supabasePublishableKey,
    );
  }, [config]);

  useEffect(() => {
    if (client === null) return;
    const activeClient = client;
    let active = true;

    async function refresh() {
      const session =
        await activeClient.auth.getSession();
      if (
        !active ||
        session.error ||
        session.data.session === null
      ) {
        if (active) {
          setAccessToken(null);
          setExportEnabled(false);
        }
        return;
      }

      const [user, assurance] =
        await Promise.all([
          activeClient.auth.getUser(),
          activeClient.auth.mfa
            .getAuthenticatorAssuranceLevel(),
        ]);

      if (
        !active ||
        user.error ||
        assurance.error ||
        user.data.user.app_metadata.role !==
          "founder" ||
        assurance.data.currentLevel !== "aal2"
      ) {
        if (active) {
          setAccessToken(null);
          setExportEnabled(false);
        }
        return;
      }

      const token =
        session.data.session.access_token;
      setAccessToken(token);

      if (config.backendUrl !== null) {
        try {
          const response = await fetch(
            `${config.backendUrl.replace(/\/$/, "")}/api/ops/leads/health`,
            {
              method: "GET",
              headers: {
                Authorization:
                  `Bearer ${token}`,
              },
              cache: "no-store",
            },
          );
          if (response.ok) {
            const body = await response.json() as {
              readonly capabilities?: {
                readonly export?: unknown;
              };
            };
            if (active) {
              setExportEnabled(
                body.capabilities?.export === true,
              );
            }
          }
        } catch {
          // CSV is a fallback utility. The core redesigned workspace
          // remains usable if its capability check is unavailable.
        }
      }
    }

    void refresh();
    const { data } =
      activeClient.auth.onAuthStateChange(
        () => void refresh(),
      );

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [client, config.backendUrl]);

  useEffect(() => {
    if (accessToken === null) {
      document.body.classList.remove(
        "lead-engine-redesign-active",
      );
      return;
    }
    document.body.classList.add(
      "lead-engine-redesign-active",
    );
    return () => {
      document.body.classList.remove(
        "lead-engine-redesign-active",
      );
    };
  }, [accessToken]);

  if (
    accessToken === null ||
    client === null ||
    !config.enabled ||
    config.backendUrl === null
  ) {
    return null;
  }

  async function signOut() {
    document.body.classList.remove(
      "lead-engine-redesign-active",
    );
    await client.auth.signOut();
    window.location.reload();
  }

  return (
    <LeadEngineRedesign
      backendUrl={config.backendUrl}
      accessToken={accessToken}
      onSignOut={signOut}
      exportEnabled={exportEnabled}
    />
  );
}
