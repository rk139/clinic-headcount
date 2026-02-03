"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

type SessionInfo = {
  dateLabel: string;
  timeLabel: string;
  programLabel: string;
  groupLabel: string;
  locationLabel?: string;
};

type Choice = "attending" | "not_attending";

export default function ResponsePage() {
  const params = useParams();
  const token = params.token as string;

  const [session, setSession] = useState<SessionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  // This is what the user most recently clicked in THIS visit
  const [status, setStatus] = useState<"idle" | Choice>("idle");

  // This is what the server says is currently saved (so reopening the link shows it)
  const [savedChoice, setSavedChoice] = useState<Choice | null>(null);

  const [message, setMessage] = useState<string>("");
  const [isError, setIsError] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [showSuccessAnim, setShowSuccessAnim] = useState(false);

  // ✅ Option A: after a successful submit, hide the choice buttons
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    if (!token) return;

    const run = async () => {
      try {
        setLoading(true);
        setError("");

        const res = await fetch(`/api/r/${token}`, { cache: "no-store" });
        const data = await res.json();

        if (!res.ok || !data.ok) {
          setError(data?.error ?? "Invalid or expired link");
          setSession(null);
          setSavedChoice(null);
          setLocked(false);
          return;
        }

        setSession(data.session ?? null);

        // ✅ If the API returns the most recent saved choice, show it
        const current = (data.currentChoice ?? null) as Choice | null;
        setSavedChoice(current);

        // If they already responded before, show the “done” state immediately
        setLocked(!!current);

        // Reset transient UI state on load
        setMessage("");
        setIsError(false);
        setShowSuccessAnim(false);
        setStatus("idle");
      } catch {
        setError("Something went wrong loading this link.");
        setSession(null);
        setSavedChoice(null);
        setLocked(false);
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [token]);

  const onChoose = async (choice: Choice) => {
    setStatus(choice);
    setMessage("");
    setIsError(false);
    setSubmitting(true);
    setShowSuccessAnim(false);

    try {
      const res = await fetch(`/api/r/${token}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ choice }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        setIsError(true);
        setMessage(data?.error ?? "Something went wrong. Please try again.");
        setSubmitting(false);
        return;
      }

      // Update “server truth”
      setSavedChoice(choice);

      setMessage(
        choice === "attending"
          ? "Thanks — you’re marked as attending."
          : "Thanks — you’re marked as not attending."
      );

      // ✅ Trigger the “thank you” animation
      setShowSuccessAnim(true);

      // ✅ Option A: hide buttons after success (feels “done”)
      setLocked(true);

      window.setTimeout(() => setShowSuccessAnim(false), 1800);
    } catch {
      setIsError(true);
      setMessage("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const showSessionUI = useMemo(() => !loading && !error && !!session, [
    loading,
    error,
    session,
  ]);

  const currentChoiceLabel =
    savedChoice === "attending"
      ? "Attending"
      : savedChoice === "not_attending"
      ? "Not attending"
      : null;

  const onChangeResponse = () => {
    // Re-open the choices; keep savedChoice shown so they remember what they last picked
    setLocked(false);
    setMessage("");
    setIsError(false);
    setShowSuccessAnim(false);
    setStatus("idle");
  };

  return (
    <div className="min-h-screen bg-[#ededed]">
      {/* Top bar */}
      <header className="bg-[#1f1f1f] text-white">
        <div className="mx-auto max-w-4xl px-6 py-5 flex items-center justify-center">
          <div className="text-lg font-semibold tracking-wide">
            SPRINGSIDE ATHLETIC CLUB
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-6 pt-10 pb-6 text-center">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-wide uppercase text-[#141414]">
          Confirm today’s clinic attendance
        </h1>
      </section>

      {/* Main card */}
      <main className="mx-auto max-w-2xl px-6 pb-14">
        <div className="rounded-2xl bg-white shadow-sm border border-black/5 overflow-hidden">
          <div className="px-6 py-6 sm:px-8 sm:py-7">
            <div className="text-center">
              <div className="text-xs font-semibold uppercase tracking-widest text-black/50">
                Session details
              </div>

              {/* Loading / Error */}
              {loading ? (
                <div className="mt-6 text-sm font-semibold text-black/60">
                  Loading session…
                </div>
              ) : error ? (
                <div className="mt-6 text-sm font-semibold text-red-600">
                  {error}
                </div>
              ) : null}

              {/* Session info */}
              {showSessionUI && session ? (
                <>
                  <div className="mt-3 text-xl sm:text-2xl font-extrabold text-[#151515]">
                    {session.dateLabel}
                  </div>

                  <div className="mt-1 text-base sm:text-lg font-semibold text-black/70">
                    {session.timeLabel}
                  </div>

                  <div className="mt-4 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4">
                    <span className="rounded-full bg-black/5 px-4 py-2 text-sm font-semibold text-black/70">
                      {session.programLabel}
                    </span>
                    <span className="rounded-full bg-black/5 px-4 py-2 text-sm font-semibold text-black/70">
                      {session.groupLabel}
                    </span>
                  </div>

                  {session.locationLabel ? (
                    <div className="mt-4 text-sm text-black/50">
                      {session.locationLabel}
                    </div>
                  ) : null}

                  {/* Current saved selection (shows when they come back later) */}
                  {currentChoiceLabel ? (
                    <div className="mt-4 text-xs font-semibold text-black/45">
                      Current selection:{" "}
                      <span className="text-black/70">{currentChoiceLabel}</span>
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>

            {/* Buttons / Done-state */}
            {showSessionUI ? (
              <>
                {/* If not locked, show the two choices */}
                {!locked ? (
                  <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <button
                      disabled={submitting}
                      onClick={() => onChoose("attending")}
                      className={`w-full rounded-full bg-[#1f1f1f] px-6 py-4 text-white font-bold uppercase shadow-sm hover:opacity-90 transition ${
                        submitting ? "opacity-60 cursor-not-allowed" : ""
                      }`}
                    >
                      {submitting && status === "attending"
                        ? "Submitting…"
                        : "✅ Attending"}
                    </button>

                    <button
                      disabled={submitting}
                      onClick={() => onChoose("not_attending")}
                      className={`w-full rounded-full border border-[#1f1f1f] bg-white px-6 py-4 font-bold uppercase text-[#1f1f1f] hover:bg-black/5 transition ${
                        submitting ? "opacity-60 cursor-not-allowed" : ""
                      }`}
                    >
                      {submitting && status === "not_attending"
                        ? "Submitting…"
                        : "❌ Not attending"}
                    </button>
                  </div>
                ) : (
                  // ✅ Locked “done” state
                  <div className="mt-8">
                    <div className="rounded-xl px-4 py-4 bg-green-50 text-green-700 border border-green-200 text-center">
                      <div className="flex items-center justify-center gap-2 text-sm font-semibold">
                        <span
                          className={`inline-flex h-7 w-7 items-center justify-center rounded-full bg-green-600 text-white ${
                            showSuccessAnim ? "animate-bounce" : ""
                          }`}
                          aria-hidden="true"
                        >
                          ✓
                        </span>
                        <span
                          className={`${showSuccessAnim ? "animate-pulse" : ""}`}
                        >
                          {message
                            ? message
                            : "Thanks — your response has been saved."}
                        </span>
                      </div>

                      <div className="mt-2 text-xs text-green-700/80">
                        If you need to change it, you can update your response
                        below.
                      </div>
                    </div>

                    <button
                      onClick={onChangeResponse}
                      className="mt-4 w-full rounded-full border border-[#1f1f1f] bg-white px-6 py-3 text-sm font-bold uppercase text-[#1f1f1f] hover:bg-black/5 transition"
                    >
                      Change response
                    </button>
                  </div>
                )}

                {/* Error banner (still shown even if locked=false) */}
                {isError && message ? (
                  <div className="mt-6 rounded-xl px-4 py-3 text-center text-sm font-semibold bg-red-50 text-red-600 border border-red-200">
                    {message}
                  </div>
                ) : null}

                {/* Hint only when nothing has been submitted yet and not locked */}
                {!message && !locked ? (
                  <div className="mt-6 text-center text-xs text-black/45">
                    You can submit again anytime — your latest response will
                    replace the old one.
                  </div>
                ) : null}
              </>
            ) : null}
          </div>

          {/* Footer */}
          <div className="bg-[#f6f6f6] px-6 py-4 text-center text-xs text-black/50">
            If you made a mistake, you can submit again — the latest response
            will count.
          </div>
        </div>
      </main>
    </div>
  );
}
