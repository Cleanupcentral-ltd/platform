import { FormEvent, useEffect, useMemo, useState } from "react";
import type { Session, SupabaseClient } from "@supabase/supabase-js";

import {
  determineAccessGate,
  normalizeAssuranceLevel,
} from "./access-gate";
import { assertEnabledConfig, readConfig } from "./config";
import {
  buildPasswordRecoveryRedirect,
  isPasswordRecoveryReturn,
} from "./password-recovery";
import { getSupabaseClient } from "./supabase";
import {
  LeadSearchWorkspace,
} from "./LeadSearchWorkspace";

type Screen =
  | "loading"
  | "signed_out"
  | "password_reset_request"
  | "password_reset_sent"
  | "password_update_required"
  | "password_updated"
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
  readonly capabilities?: {
    readonly search?: unknown;
    readonly manualCapture?: unknown;
    readonly reviewAndScoring?: unknown;
    readonly companiesHouseVerification?:
      unknown;
    readonly automaticCompanyEnrichment?:
      unknown;
    readonly automaticQualification?:
      unknown;
    readonly outlookDrafts?: unknown;
    readonly export?: unknown;
  };
}

interface Capabilities {
  readonly search: boolean;
  readonly manualCapture: boolean;
  readonly reviewAndScoring: boolean;
  readonly companiesHouseVerification:
    boolean;
  readonly automaticCompanyEnrichment:
    boolean;
  readonly automaticQualification:
    boolean;
  readonly outlookDrafts: boolean;
  readonly export: boolean;
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
  const [newPassword, setNewPassword] = useState("");
  const [confirmedPassword, setConfirmedPassword] = useState("");
  const [code, setCode] = useState("");
  const [factorId, setFactorId] = useState<string | null>(null);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [accessToken, setAccessToken] =
    useState<string | null>(null);
  const [capabilities, setCapabilities] =
    useState<Capabilities>({
      search: false,
      manualCapture: false,
      reviewAndScoring: false,
      companiesHouseVerification: false,
      automaticCompanyEnrichment: false,
      automaticQualification: false,
      outlookDrafts: false,
      export: false,
    });

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

    setCapabilities({
      search:
        body.capabilities?.search ===
        true,
      manualCapture:
        body.capabilities
          ?.manualCapture === true,
      reviewAndScoring:
        body.capabilities
          ?.reviewAndScoring === true,
      companiesHouseVerification:
        body.capabilities
          ?.companiesHouseVerification ===
        true,
      automaticCompanyEnrichment:
        body.capabilities
          ?.automaticCompanyEnrichment ===
        true,
      automaticQualification:
        body.capabilities
          ?.automaticQualification === true,
      outlookDrafts:
        body.capabilities
          ?.outlookDrafts === true,
      export:
        body.capabilities
          ?.export === true,
    });
    setAccessToken(
      session.access_token,
    );
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

    const recoveryReturn = isPasswordRecoveryReturn(
      window.location.href,
    );
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setError(null);
        setScreen("password_update_required");
      }

      if (
        event === "TOKEN_REFRESHED" &&
        session !== null
      ) {
        setAccessToken(
          session.access_token,
        );
      }
    });

    void client.auth
      .getSession()
      .then(({ data, error: sessionError }) => {
        if (sessionError) {
          throw sessionError;
        }

        if (recoveryReturn) {
          if (data.session === null) {
            throw new Error(
              "This password reset link is invalid or has expired.",
            );
          }

          setScreen("password_update_required");
          return;
        }

        return inspectSession(data.session);
      })
      .catch((caught) => {
        setError(messageFrom(caught));
        setScreen("error");
      });

    return () => subscription.unsubscribe();
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

  async function requestPasswordReset(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    if (client === null) return;

    setError(null);
    const result = await client.auth.resetPasswordForEmail(email, {
      redirectTo: buildPasswordRecoveryRedirect(window.location.origin),
    });

    if (result.error) {
      setError(messageFrom(result.error));
      return;
    }

    setScreen("password_reset_sent");
  }

  async function updatePassword(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    if (client === null) return;

    setError(null);
    if (newPassword !== confirmedPassword) {
      setError("The two password entries do not match.");
      return;
    }

    const update = await client.auth.updateUser({
      password: newPassword,
    });
    if (update.error) {
      setError(messageFrom(update.error));
      return;
    }

    const signOutResult = await client.auth.signOut();
    if (signOutResult.error) {
      setError(messageFrom(signOutResult.error));
      return;
    }

    setNewPassword("");
    setConfirmedPassword("");
    window.history.replaceState({}, "", "/ops/leads");
    setScreen("password_updated");
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
    setAccessToken(null);
    setCapabilities({
      search: false,
      manualCapture: false,
      reviewAndScoring: false,
      companiesHouseVerification: false,
      automaticCompanyEnrichment: false,
      automaticQualification: false,
      outlookDrafts: false,
      export: false,
    });
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
      <section
        className={
          screen === "ready" &&
          (
            capabilities.search ||
            capabilities.reviewAndScoring
          )
            ? "card card-wide"
            : "card"
        }
        aria-live="polite"
      >
        <p className="eyebrow">Clean Up Central · Founder operations</p>
        <h1>Lead Engine Lite</h1>

        {screen === "loading" && <p>Checking your secure session…</p>}

        {screen === "signed_out" && (
          <div className="stack">
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
            <button
              type="button"
              className="secondary"
              onClick={() => {
                setError(null);
                setScreen("password_reset_request");
              }}
            >
              Reset password
            </button>
          </div>
        )}

        {screen === "password_reset_request" && (
          <form onSubmit={requestPasswordReset} className="stack">
            <p>Enter the founder account email address.</p>
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
            <button type="submit">Send password reset email</button>
            <button
              type="button"
              className="secondary"
              onClick={() => {
                setError(null);
                setScreen("signed_out");
              }}
            >
              Back to sign in
            </button>
          </form>
        )}

        {screen === "password_reset_sent" && (
          <div className="stack">
            <p className="success">
              If the founder account exists, a password reset email has been
              sent.
            </p>
            <button
              type="button"
              className="secondary"
              onClick={() => setScreen("signed_out")}
            >
              Back to sign in
            </button>
          </div>
        )}

        {screen === "password_update_required" && (
          <form onSubmit={updatePassword} className="stack">
            <p>Choose a new password for the founder account.</p>
            <label>
              New password
              <input
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                required
              />
            </label>
            <label>
              Confirm new password
              <input
                type="password"
                autoComplete="new-password"
                value={confirmedPassword}
                onChange={(event) =>
                  setConfirmedPassword(event.target.value)
                }
                required
              />
            </label>
            <button type="submit">Save new password</button>
          </form>
        )}

        {screen === "password_updated" && (
          <div className="stack">
            <p className="success">Your password has been updated.</p>
            <button type="button" onClick={() => setScreen("signed_out")}>
              Continue to sign in
            </button>
          </div>
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
          capabilities.search &&
          capabilities.manualCapture &&
          accessToken !== null &&
          config.backendUrl !== null
            ? (
                <LeadSearchWorkspace
                  backendUrl={
                    config.backendUrl
                  }
                  accessToken={
                    accessToken
                  }
                  onSignOut={signOut}
                  reviewEnabled={
                    capabilities
                      .reviewAndScoring
                  }
                  companiesHouseEnabled={
                    capabilities
                      .companiesHouseVerification
                  }
                  companyEnrichmentEnabled={
                    capabilities
                      .automaticCompanyEnrichment
                  }
                  automaticQualificationEnabled={
                    capabilities
                      .automaticQualification
                  }
                  outlookDraftEnabled={
                    capabilities.outlookDrafts
                  }
                  exportEnabled={
                    capabilities.export
                  }
                />
              )
            : (
                <div className="stack">
                  <p className="success">
                    Founder access and MFA are verified.
                  </p>
                  <p>
                    The Stage 2 foundation is ready. Stage 3 search remains disabled.
                  </p>
                  <button
                    type="button"
                    className="secondary"
                    onClick={signOut}
                  >
                    Sign out
                  </button>
                </div>
              )
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
