import { FormEvent, useEffect, useMemo, useState } from "react";
import type { Session, SupabaseClient } from "@supabase/supabase-js";

import {
  determineAccessGate,
  normalizeAssuranceLevel,
} from "./access-gate";
import { assertEnabledConfig, readConfig } from "./config";
import { getSupabaseClient } from "./supabase";

type Screen =
  | "loading"
  | "signed_out"
  | "founder_role_required"
  | "mfa_enrollment_required"
  | "mfa_challenge_required"
  | "foundation_check"
  | "ready"
  | "error";

interface Enrollment {
  readonly factorId: string;
  readonly qrCode: string;
  readonly secret: string;
}

interface FoundationResponse {
  readonly success?: unknown;
  readonly foundation?: {
    readonly ready?: unknown;
    readonly access?: unknown;
    readonly mfa?: unknown;
  };
}

function messageFrom(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "The operation could not be completed.";
}

export function LeadEngineFoundation() {
  const config = useMemo(readConfig, []);
  const [screen, setScreen] = useState<Screen>("loading");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [factorId, setFactorId] = useState<string | null>(null);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const client = useMemo<SupabaseClient | null>(() => {
    if (!config.enabled) {
      return null;
    }

    assertEnabledConfig(config);
    return getSupabaseClient(
      config.supabaseUrl,
      config.supabasePublishableKey,
    );
  }, [config]);

  async function verifyFoundation(session: Session): Promise<void> {
    assertEnabledConfig(config);
    setScreen("foundation_check");

    const response = await fetch(
      `${config.backendUrl.replace(/\/$/, "")}/api/ops/leads/health`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        cache: "no-store",
      },
    );

    let body: FoundationResponse = {};
    try {
      body = (await response.json()) as FoundationResponse;
    } catch {
      // The status-specific message below remains the useful result.
    }

    if (response.status === 404) {
      throw new Error(
        "The Lead Engine backend feature flag is still disabled.",
      );
    }

    if (!response.ok) {
      throw new Error(
        `The protected foundation check failed with status ${response.status}.`,
      );
    }

    if (
      body.success !== true ||
      body.foundation?.ready !== true ||
      body.foundation.access !== "founder" ||
      body.foundation.mfa !== "verified"
    ) {
      throw new Error(
        "The backend returned an invalid foundation response.",
      );
    }

    setScreen("ready");
  }

  async function inspectSession(session: Session | null): Promise<void> {
    if (client === null || session === null) {
      setScreen("signed_out");
      return;
    }

    const [{ data: userData, error: userError }, assurance] =
      await Promise.all([
        client.auth.getUser(),
        client.auth.mfa.getAuthenticatorAssuranceLevel(),
      ]);

    if (userError) {
      throw userError;
    }
    if (assurance.error) {
      throw assurance.error;
    }

    const gate = determineAccessGate({
      hasSession: true,
      role: userData.user.app_metadata.role,
      currentLevel: normalizeAssuranceLevel(
        assurance.data.currentLevel,
      ),
      nextLevel: normalizeAssuranceLevel(assurance.data.nextLevel),
    });

    if (gate === "founder_role_required") {
      setScreen(gate);
      return;
    }

    if (gate === "mfa_enrollment_required") {
      setScreen(gate);
      return;
    }

    if (gate === "mfa_challenge_required") {
      const factors = await client.auth.mfa.listFactors();
      if (factors.error) {
        throw factors.error;
      }

      const verifiedTotp = factors.data.totp.find(
        (factor) => factor.status === "verified",
      );
      if (verifiedTotp === undefined) {
        throw new Error("No verified authenticator factor was found.");
      }

      setFactorId(verifiedTotp.id);
      setScreen(gate);
      return;
    }

    await verifyFoundation(session);
  }

  useEffect(() => {
    if (!config.enabled || client === null) {
      return;
    }

    void client.auth
      .getSession()
      .then(({ data, error: sessionError }) => {
        if (sessionError) {
          throw sessionError;
        }
        return inspectSession(data.session);
      })
      .catch((caught) => {
        setError(messageFrom(caught));
        setScreen("error");
      });
    // The configured client is stable for the lifetime of the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, config.enabled]);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (client === null) return;

    setError(null);
    setScreen("loading");
    const result = await client.auth.signInWithPassword({ email, password });
    setPassword("");

    if (result.error) {
      setError("The email address or password was not accepted.");
      setScreen("signed_out");
      return;
    }

    try {
      await inspectSession(result.data.session);
    } catch (caught) {
      setError(messageFrom(caught));
      setScreen("error");
    }
  }

  async function beginEnrollment() {
    if (client === null) return;

    setError(null);
    try {
      const result = await client.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Clean Up Central founder",
      });
      if (result.error) throw result.error;

      setEnrollment({
        factorId: result.data.id,
        qrCode: result.data.totp.qr_code,
        secret: result.data.totp.secret,
      });
      setFactorId(result.data.id);
    } catch (caught) {
      setError(messageFrom(caught));
    }
  }

  async function verifyMfa(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (client === null || factorId === null) return;

    setError(null);
    try {
      const challenge = await client.auth.mfa.challenge({ factorId });
      if (challenge.error) throw challenge.error;

      const verification = await client.auth.mfa.verify({
        factorId,
        challengeId: challenge.data.id,
        code: code.trim(),
      });
      if (verification.error) throw verification.error;

      setCode("");
      setEnrollment(null);
      const session = await client.auth.getSession();
      if (session.error) throw session.error;
      await inspectSession(session.data.session);
    } catch (caught) {
      setError(messageFrom(caught));
    }
  }

  async function signOut() {
    if (client === null) return;
    await client.auth.signOut();
    setEnrollment(null);
    setFactorId(null);
    setCode("");
    setError(null);
    setScreen("signed_out");
  }

  if (!config.enabled) {
    return (
      <main className="shell">
        <section className="card">
          <p className="eyebrow">Clean Up Central</p>
          <h1>Operations console unavailable</h1>
          <p>The Lead Engine founder interface is currently disabled.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <section className="card" aria-live="polite">
        <p className="eyebrow">Clean Up Central · Founder operations</p>
        <h1>Lead Engine Lite</h1>

        {screen === "loading" && <p>Checking your secure session…</p>}

        {screen === "signed_out" && (
          <form onSubmit={signIn} className="stack">
            <p>Sign in with the founder account.</p>
            <label>
              Email address
              <input
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>
            <label>
              Password
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </label>
            <button type="submit">Sign in</button>
          </form>
        )}

        {screen === "founder_role_required" && (
          <div className="stack">
            <p>Access denied: this account does not have the founder role.</p>
            <button type="button" className="secondary" onClick={signOut}>
              Sign out
            </button>
          </div>
        )}

        {screen === "mfa_enrollment_required" && (
          <div className="stack">
            <p>Authenticator verification must be enabled before access.</p>
            {enrollment === null ? (
              <button type="button" onClick={beginEnrollment}>
                Set up authenticator
              </button>
            ) : (
              <>
                <img
                  className="qr"
                  src={enrollment.qrCode}
                  alt="Authenticator setup QR code"
                />
                <details>
                  <summary>Enter a setup key instead</summary>
                  <code className="secret">{enrollment.secret}</code>
                </details>
                <MfaForm code={code} setCode={setCode} onSubmit={verifyMfa} />
              </>
            )}
            <button type="button" className="secondary" onClick={signOut}>
              Sign out
            </button>
          </div>
        )}

        {screen === "mfa_challenge_required" && (
          <div className="stack">
            <p>Enter the current code from your authenticator app.</p>
            <MfaForm code={code} setCode={setCode} onSubmit={verifyMfa} />
            <button type="button" className="secondary" onClick={signOut}>
              Sign out
            </button>
          </div>
        )}

        {screen === "foundation_check" && (
          <p>Verifying founder access with the protected backend…</p>
        )}

        {screen === "ready" && (
          <div className="stack">
            <p className="success">Founder access and MFA are verified.</p>
            <p>
              The Stage 2 foundation is ready. Search and outreach capabilities
              remain disabled.
            </p>
            <button type="button" className="secondary" onClick={signOut}>
              Sign out
            </button>
          </div>
        )}

        {screen === "error" && (
          <div className="stack">
            <p>The secure foundation check could not be completed.</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
            >
              Try again
            </button>
            <button type="button" className="secondary" onClick={signOut}>
              Sign out
            </button>
          </div>
        )}

        {error !== null && <p className="error">{error}</p>}
      </section>
    </main>
  );
}

function MfaForm({
  code,
  setCode,
  onSubmit,
}: {
  readonly code: string;
  readonly setCode: (value: string) => void;
  readonly onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}) {
  return (
    <form onSubmit={onSubmit} className="stack">
      <label>
        Six-digit code
        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          value={code}
          onChange={(event) =>
            setCode(event.target.value.replace(/\D/g, ""))
          }
          required
        />
      </label>
      <button type="submit">Verify</button>
    </form>
  );
}
