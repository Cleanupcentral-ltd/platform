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
        if (active) setAccessToken(null);
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
        if (active) setAccessToken(null);
        return;
      }

      setAccessToken(
        session.data.session.access_token,
      );
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
  }, [client]);

  if (
    accessToken === null ||
    client === null ||
    !config.enabled ||
    config.backendUrl === null
  ) {
    return null;
  }

  async function signOut() {
    await client.auth.signOut();
    window.location.reload();
  }

  return (
    <LeadEngineRedesign
      backendUrl={config.backendUrl}
      accessToken={accessToken}
      onSignOut={signOut}
    />
  );
}
