import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  LeadDiscoveryView,
} from "./LeadDiscoveryView";

import {
  LeadReviewView,
} from "./LeadReviewView";

import {
  LeadFollowUpsView,
} from "./LeadFollowUpsView";

import {
  OutreachDrawer,
} from "./OutreachDrawer";

import {
  downloadLeadExport,
} from "./lead-export-api";

import {
  listProspects,
  updateProspectViewState,
  type ProspectSummary,
} from "./lead-review-api";

import {
  queueKey,
} from "./redesign-helpers";

import "./redesign.css";

type Tab =
  | "discover"
  | "verify"
  | "followups";

interface LeadEngineRedesignProps {
  readonly backendUrl: string;
  readonly accessToken: string;
  readonly onSignOut: () => Promise<void>;
  readonly exportEnabled?: boolean;
}

function messageFrom(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "The operation could not be completed.";
}

export function LeadEngineRedesign({
  backendUrl,
  accessToken,
  onSignOut,
  exportEnabled = false,
}: LeadEngineRedesignProps) {
  const [activeTab, setActiveTab] =
    useState<Tab>("discover");
  const [prospects, setProspects] =
    useState<readonly ProspectSummary[]>([]);
  const [selectedId, setSelectedId] =
    useState<string | null>(null);
  const [outreachId, setOutreachId] =
    useState<string | null>(null);
  const [followUpRefreshKey,
    setFollowUpRefreshKey] =
      useState(0);
  const [message, setMessage] =
    useState<string | null>(null);
  const [error, setError] =
    useState<string | null>(null);
  const [exporting, setExporting] =
    useState(false);

  const showMessage = useCallback(
    (value: string) => {
      setError(null);
      setMessage(value);
    },
    [],
  );

  const showError = useCallback(
    (value: string) => {
      setMessage(null);
      setError(value);
    },
    [],
  );

  const refreshProspects = useCallback(
    async () => {
      try {
        const next = await listProspects(
          backendUrl,
          accessToken,
        );
        setProspects(next);
        return next;
      } catch (caught) {
        showError(messageFrom(caught));
        return [];
      }
    },
    [
      accessToken,
      backendUrl,
      showError,
    ],
  );

  useEffect(() => {
    void refreshProspects();
  }, [refreshProspects]);

  const selectReviewProspect = useCallback(
    (prospectId: string | null) => {
      setSelectedId(prospectId);

      if (
        prospectId === null ||
        typeof window === "undefined" ||
        !window.matchMedia(
          "(max-width: 1100px)",
        ).matches
      ) {
        return;
      }

      window.requestAnimationFrame(() => {
        const evidenceColumn =
          document.querySelector<HTMLElement>(
            ".le-evidence-column",
          );
        if (evidenceColumn === null) return;

        const reducedMotion =
          window.matchMedia(
            "(prefers-reduced-motion: reduce)",
          ).matches;
        const top =
          window.scrollY +
          evidenceColumn.getBoundingClientRect().top -
          88;

        window.scrollTo({
          top: Math.max(0, top),
          behavior: reducedMotion
            ? "auto"
            : "smooth",
        });
      });
    },
    [],
  );

  const markViewed = useCallback(
    async (prospectId: string) => {
      const current = prospects.find(
        (item) => item.id === prospectId,
      );
      if (
        current !== undefined &&
        current.viewedAt !== null
      ) {
        return;
      }
      try {
        const viewedAt =
          await updateProspectViewState(
            backendUrl,
            accessToken,
            prospectId,
            true,
          );
        setProspects((items) =>
          items.map((item) =>
            item.id === prospectId
              ? { ...item, viewedAt }
              : item,
          ),
        );
      } catch (caught) {
        showError(messageFrom(caught));
      }
    },
    [
      accessToken,
      backendUrl,
      prospects,
      showError,
    ],
  );

  async function openProspect(
    prospectId: string,
    ready: boolean,
  ) {
    await markViewed(prospectId);
    if (ready) {
      setOutreachId(prospectId);
      return;
    }
    selectReviewProspect(prospectId);
    setActiveTab("verify");
  }

  function openFollowUp(
    prospectId: string,
  ) {
    const prospect = prospects.find(
      (item) => item.id === prospectId,
    );
    if (
      prospect !== undefined &&
      queueKey(prospect) === "excluded"
    ) {
      selectReviewProspect(prospectId);
      setActiveTab("verify");
      showMessage(
        "This prospect is excluded. Its history remains available, but outreach is blocked.",
      );
      return;
    }
    setOutreachId(prospectId);
  }

  async function exportCsv() {
    setExporting(true);
    setMessage(null);
    setError(null);
    try {
      const file = await downloadLeadExport(
        backendUrl,
        accessToken,
      );
      const objectUrl =
        URL.createObjectURL(file.blob);
      const anchor =
        document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = file.filename;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
      showMessage(
        "Founder CSV fallback downloaded and recorded in the audit log.",
      );
    } catch (caught) {
      showError(messageFrom(caught));
    } finally {
      setExporting(false);
    }
  }

  return (
    <main className="le-app">
      <header className="le-header">
        <div className="le-header-inner">
          <div className="le-brand-lockup">
            <strong>CLEAN UP CENTRAL</strong>
            <span>Founder operations</span>
          </div>
          <div className="le-header-tools">
            <button
              type="button"
              className="le-header-button"
              onClick={() => void onSignOut()}
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="le-page">
        <section className="le-intro">
          <p className="le-overline">
            LEAD ENGINE LITE
          </p>
          <h1>
            Find the right businesses. Reach out with confidence.
          </h1>
          <p>
            Discover local prospects, verify the evidence and keep genuine outreach moving without losing founder control.
          </p>
        </section>

        <nav
          className="le-tabs"
          aria-label="Lead Engine sections"
        >
          <button
            type="button"
            className={
              activeTab === "discover"
                ? "is-active"
                : ""
            }
            onClick={() =>
              setActiveTab("discover")
            }
          >
            Find prospects
          </button>
          <button
            type="button"
            className={
              activeTab === "verify"
                ? "is-active"
                : ""
            }
            onClick={() =>
              setActiveTab("verify")
            }
          >
            Verify & score
          </button>
          <button
            type="button"
            className={
              activeTab === "followups"
                ? "is-active"
                : ""
            }
            onClick={() =>
              setActiveTab("followups")
            }
          >
            Follow-ups
          </button>
        </nav>

        {message !== null && (
          <div
            className="le-notice le-notice-success"
            role="status"
          >
            {message}
          </div>
        )}
        {error !== null && (
          <div
            className="le-notice le-notice-error"
            role="alert"
          >
            {error}
          </div>
        )}

        {activeTab === "discover" && (
          <LeadDiscoveryView
            backendUrl={backendUrl}
            accessToken={accessToken}
            prospects={prospects}
            refreshProspects={
              refreshProspects
            }
            onOpenProspect={
              (prospectId, ready) =>
                void openProspect(
                  prospectId,
                  ready,
                )
            }
            exportEnabled={exportEnabled}
            exporting={exporting}
            onExportCsv={() =>
              void exportCsv()
            }
            onMessage={showMessage}
            onError={showError}
          />
        )}

        {activeTab === "verify" && (
          <LeadReviewView
            backendUrl={backendUrl}
            accessToken={accessToken}
            prospects={prospects}
            selectedId={selectedId}
            setSelectedId={selectReviewProspect}
            refreshProspects={
              refreshProspects
            }
            markViewed={markViewed}
            onPrepareOutreach={
              setOutreachId
            }
            onMessage={showMessage}
            onError={showError}
          />
        )}

        {activeTab === "followups" && (
          <LeadFollowUpsView
            backendUrl={backendUrl}
            accessToken={accessToken}
            refreshKey={followUpRefreshKey}
            onOpenOutreach={openFollowUp}
            onError={showError}
          />
        )}
      </div>

      {outreachId !== null && (
        <OutreachDrawer
          backendUrl={backendUrl}
          accessToken={accessToken}
          prospectId={outreachId}
          onClose={() =>
            setOutreachId(null)
          }
          onActivitySaved={() => {
            setFollowUpRefreshKey(
              (value) => value + 1,
            );
            void refreshProspects();
          }}
          onMessage={showMessage}
          onError={showError}
        />
      )}
    </main>
  );
}
