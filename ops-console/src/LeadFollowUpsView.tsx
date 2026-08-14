import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  listManualFollowUps,
  type ManualFollowUpItem,
} from "./manual-follow-ups-api";

import {
  followUpLabel,
  latestActivityLabel,
  matchesFollowUpFilter,
  sectorLabel,
  type FollowUpFilter,
} from "./redesign-helpers";

interface LeadFollowUpsViewProps {
  readonly backendUrl: string;
  readonly accessToken: string;
  readonly refreshKey: number;
  readonly onOpenOutreach: (
    prospectId: string,
  ) => void;
  readonly onError: (
    message: string,
  ) => void;
}

const FILTERS: readonly {
  readonly value: FollowUpFilter;
  readonly label: string;
}[] = [
  { value: "all", label: "All activity" },
  { value: "due_today", label: "Due today" },
  { value: "overdue", label: "Overdue" },
  { value: "upcoming", label: "Upcoming" },
  { value: "awaiting_reply", label: "Awaiting reply" },
  { value: "replied", label: "Replied" },
  { value: "revisit_later", label: "Revisit later" },
];

function messageFrom(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Follow-up activity could not be loaded.";
}

function mostRecentTime(
  item: ManualFollowUpItem,
): number {
  return Math.max(
    ...item.activities.map(
      (activity) =>
        new Date(activity.createdAt).getTime(),
    ),
  );
}

export function LeadFollowUpsView({
  backendUrl,
  accessToken,
  refreshKey,
  onOpenOutreach,
  onError,
}: LeadFollowUpsViewProps) {
  const [items, setItems] =
    useState<readonly ManualFollowUpItem[]>([]);
  const [filter, setFilter] =
    useState<FollowUpFilter>(
      "awaiting_reply",
    );
  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void listManualFollowUps(
      backendUrl,
      accessToken,
    ).then((next) => {
      if (active) setItems(next);
    }).catch((error) => {
      if (active) onError(messageFrom(error));
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [
    accessToken,
    backendUrl,
    onError,
    refreshKey,
  ]);

  const counts = useMemo(
    () => new Map(
      FILTERS.map((item) => [
        item.value,
        items.filter((prospect) =>
          matchesFollowUpFilter(
            prospect,
            item.value,
          ),
        ).length,
      ]),
    ),
    [items],
  );

  const visible = useMemo(
    () => items
      .filter((item) =>
        matchesFollowUpFilter(
          item,
          filter,
        ),
      )
      .sort(
        (left, right) =>
          mostRecentTime(right) -
          mostRecentTime(left),
      ),
    [items, filter],
  );

  return (
    <section className="le-view">
      <div className="le-view-heading">
        <div>
          <p className="le-overline">
            OUTREACH FOLLOW-UP
          </p>
          <h2>
            Pick up where the real conversation left off.
          </h2>
          <p>
            This view is generated from recorded outreach activity and founder-scheduled follow-ups. It does not invent a contact cadence.
          </p>
        </div>
      </div>

      <div className="le-followup-filters">
        {FILTERS.map((item) => (
          <button
            type="button"
            key={item.value}
            className={
              filter === item.value
                ? "is-active"
                : ""
            }
            onClick={() =>
              setFilter(item.value)
            }
          >
            <span>{item.label}</span>
            <strong>
              {counts.get(item.value) ?? 0}
            </strong>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="le-empty-state">
          Loading outreach activity…
        </div>
      ) : visible.length === 0 ? (
        <div className="le-empty-state">
          No prospects currently match this follow-up filter.
        </div>
      ) : (
        <div className="le-followup-table">
          <div className="le-followup-head">
            <span>Prospect</span>
            <span>Latest activity</span>
            <span>Follow-up</span>
            <span />
          </div>
          {visible.map((item) => (
            <div
              className="le-followup-row"
              key={item.prospectId}
            >
              <div>
                <strong>
                  {item.businessName}
                </strong>
                <span>
                  {item.primaryPostcode ??
                    "Postcode not recorded"}
                  {" · "}
                  {sectorLabel(item.sector)}
                </span>
              </div>
              <span>
                {latestActivityLabel(item)}
              </span>
              <span className="le-followup-date">
                {followUpLabel(item)}
              </span>
              <button
                type="button"
                className="le-text-action"
                onClick={() =>
                  onOpenOutreach(
                    item.prospectId,
                  )
                }
              >
                Open outreach →
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
