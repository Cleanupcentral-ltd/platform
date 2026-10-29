import { useEffect, useState } from "react";
import { readAnalyticsConsent, saveAnalyticsConsent, startAnalytics, stopAnalytics } from "./analyticsConsent.js";

export default function AnalyticsConsent() {
  const [choice, setChoice] = useState<string | null>(() => readAnalyticsConsent());
  const [open, setOpen] = useState(() => readAnalyticsConsent() === null);

  useEffect(() => {
    if (choice === "accepted") startAnalytics();
  }, [choice]);

  function decide(value: "accepted" | "rejected") {
    saveAnalyticsConsent(value);
    if (value === "rejected") stopAnalytics();
    setChoice(value);
    setOpen(false);
  }

  return (
    <>
      {open && (
        <aside role="dialog" aria-label="Cookie preferences" aria-modal="false"
          className="fixed bottom-4 left-4 right-4 z-[1000] mx-auto max-w-xl rounded-xl border border-[#D8D5CF] bg-white p-5 text-[#121212] shadow-xl">
          <h2 className="text-lg font-semibold">Your cookie choices</h2>
          <p className="mt-2 text-sm leading-6">
            We use essential website technology to operate this site. With your permission,
            we also use Google Analytics to understand visits and quote requests.
            You can refuse analytics and still use our services.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button type="button" onClick={() => decide("accepted")}
              className="rounded bg-[#7A5A1E] px-4 py-2 text-sm font-semibold text-white">Accept analytics</button>
            <button type="button" onClick={() => decide("rejected")}
              className="rounded border border-[#777] px-4 py-2 text-sm font-semibold">Reject analytics</button>
          </div>
        </aside>
      )}
      {!open && (
        <button type="button" onClick={() => setOpen(true)}
          className="fixed bottom-3 left-3 z-[999] rounded border border-[#D8D5CF] bg-white px-3 py-2 text-xs text-[#121212] shadow"
          aria-label="Manage cookie preferences">Cookie settings</button>
      )}
    </>
  );
}
