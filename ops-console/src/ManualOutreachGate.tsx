import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ManualOutreachPanel,
} from "./ManualOutreachPanel";

import {
  assertEnabledConfig,
  readConfig,
} from "./config";

import {
  getSupabaseClient,
} from "./supabase";

export function ManualOutreachGate() {
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
    let active = true;

    async function refresh() {
      const session =
        await client.auth.getSession();
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
          client.auth.getUser(),
          client.auth.mfa
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
      client.auth.onAuthStateChange(
        () => void refresh(),
      );

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [client]);

  if (
    accessToken === null ||
    !config.enabled ||
    config.backendUrl === null
  ) {
    return null;
  }

  return (
    <main className="shell">
      <section className="card card-wide">
        <ManualOutreachPanel
          backendUrl={config.backendUrl}
          accessToken={accessToken}
        />
      </section>
    </main>
  );
}
