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

  const [familyCode, setFamilyCode] = useState<string>("");

  const [status, setStatus] = useState<"idle" | Choice>("idle");
  const [savedChoice, setSavedChoice] = useState<Choice | null>(null);

  const [message, setMessage] = useState<string>("");
  const [isError, setIsError] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [showSuccessAnim, setShowSuccessAnim] = useState(false);

  const [locked, setLocked] = useState(false);

  const [kidNames, setKidNames] = useState<string[]>([""]);
  const [submittedKidNames, setSubmittedKidNames] = useState<string[]>([]);

  function updateKidName(i: number, value: string) {
    setKidNames((prev) => prev.map((v, idx) => (idx === i ? value : v)));
  }

  function addKidField() {
    setKidNames((prev) => [...prev, ""]);
  }

  function removeKidField(i: number) {
    setKidNames((prev) => {
      const next = prev.filter((_, idx) => idx !== i);
      return next.length ? next : [""];
    });
  }

  function cleanedKidNames() {
    return kidNames
      .map((n) => n.trim())
      .filter((n) => n.length > 0)
      .slice(0, 6);
  }

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
          setKidNames([""]);
          setSubmittedKidNames([]);
          return;
        }

        setSession(data.session ?? null);

        setSavedChoice(null);
        setLocked(false);

        setMessage("");
        setIsError(false);
        setShowSuccessAnim(false);
        setStatus("idle");

        setKidNames([""]);
        setSubmittedKidNames([]);
      } catch {
        setError("Something went wrong loading this link.");
        setSession(null);
        setSavedChoice(null);
        setLocked(false);
        setKidNames([""]);
        setSubmittedKidNames([]);
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

    const code = familyCode.trim().toUpperCase();

    if (!code) {
      setIsError(true);
      setMessage("Family Code is required.");
      setSubmitting(false);
      return;
    }

    if (!/^[A-Z]{3,}\d{2}$/.test(code)) {
      setIsError(true);
      setMessage("Family Code must look like MILLER07 (LASTNAME + 2 digits).");
      setSubmitting(false);
      return;
    }

    setFamilyCode(code);

    const names = choice === "attending" ? cleanedKidNames() : [];

    if (choice === "attending" && names.length === 0) {
      setIsError(true);
      setMessage("Please enter at least one kid’s name.");
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch(`/api/r/${token}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          familyCode: code,
          choice,
          kidNames: names,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        setIsError(true);
        setMessage(data?.error ?? "Something went wrong. Please try again.");
        setSubmitting(false);
        return;
      }

      setSavedChoice(choice);
      setSubmittedKidNames(names);

      setMessage(
        choice === "attending"
          ? "Thanks — you’re marked as attending."
          : "Thanks — you’re marked as not attending."
      );

      setShowSuccessAnim(true);
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
    setLocked(false);
    setMessage("");
    setIsError(false);
    setShowSuccessAnim(false);
    setStatus("idle");
  };

  return (
    <div className="min-h-screen bg-[#ededed]">
      <header className="bg-[#1f1f1f] text-white">
        <div className="mx-auto max-w-4xl px-6 py-5 flex items-center justify-center">
          <div className="text-lg font-semibold tracking-wide">
            SPRINGSIDE ATHLETIC CLUB
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-6 pt-10 pb-6 text-center">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-wide uppercase text-[#141414]">
          Confirm today’s clinic attendance
        </h1>
      </section>

      <main className="mx-auto max-w-2xl px-6 pb-14">
        <div className="rounded-2xl bg-white shadow-sm border border-black/5 overflow-hidden">
          <div className="px-6 py-6 sm:px-8 sm:py-7">
            <div className="text-center">
              <div className="text-xs font-semibold uppercase tracking-widest text-black/50">
                Session details
              </div>

              {loading ? (
                <div className="mt-6 text-sm font-semibold text-black/60">
                  Loading session…
                </div>
              ) : error ? (
                <div className="mt-6 text-sm font-semibold text-red-600">
                  {error}
                </div>
              ) : null}

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

                  {currentChoiceLabel ? (
                    <div className="mt-4 text-xs font-semibold text-black/45">
                      Current selection:{" "}
                      <span className="text-black/70">{currentChoiceLabel}</span>
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>

            {showSessionUI && (
              <>
                {!locked && (
                  <>
                    <div className="mt-8">
                      <div className="text-sm font-semibold text-black/70 text-center">
                        Family Code (required)
                      </div>

                      <div className="mt-4">
                        <input
                          value={familyCode}
                          onChange={(e) =>
                            setFamilyCode(e.target.value.toUpperCase())
                          }
                          autoCapitalize="characters"
                          autoCorrect="off"
                          spellCheck={false}
                          inputMode="text"
                          placeholder="e.g. KUMAR12"
                          className="w-full rounded-xl border border-black/15 px-4 py-3 text-sm text-black placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-black/30"
                        />

                        <div className="mt-2 text-xs text-black/45 max-w-sm mx-auto leading-relaxed text-left">
                          <div>
                            Use LAST NAME + 2 digits (example: KUMAR12).
                          </div>
                          <div>
                            Use the same code each time so updates replace your
                            previous response.
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-8">
                      <div className="text-sm font-semibold text-black/70 text-center">
                        Enter kid name(s)
                      </div>

                      <div className="mt-4 space-y-3">
                        {kidNames.map((value, i) => (
                          <div key={i} className="flex gap-2">
                            <input
                              value={value}
                              onChange={(e) =>
                                updateKidName(i, e.target.value)
                              }
                              placeholder={
                                i === 0 ? "Kid name" : `Kid name ${i + 1}`
                              }
                              className="w-full rounded-xl border border-black/15 px-4 py-3 text-sm text-black placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-black/30"
                            />

                            {kidNames.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeKidField(i)}
                                className="shrink-0 rounded-xl border border-black/15 px-3 py-3 text-sm font-semibold text-black/60 hover:bg-black/5"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={addKidField}
                        className="mt-4 w-full rounded-full border border-[#1f1f1f] bg-white px-6 py-3 text-sm font-bold uppercase text-[#1f1f1f] hover:bg-black/5 transition"
                      >
                        + Add another kid
                      </button>
                    </div>

                    <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                  </>
                )}

                {locked && (
                  <div className="mt-8">
                    <div className="rounded-xl px-4 py-4 bg-green-50 text-green-700 border border-green-200 text-center">
                      <div className="flex items-center justify-center gap-2 text-sm font-semibold">
                        <span
                          className={`inline-flex h-7 w-7 items-center justify-center rounded-full bg-green-600 text-white ${
                            showSuccessAnim ? "animate-bounce" : ""
                          }`}
                        >
                          ✓
                        </span>
                        <span
                          className={`${showSuccessAnim ? "animate-pulse" : ""}`}
                        >
                          {message ||
                            "Thanks — your response has been saved."}
                        </span>
                      </div>

                      {savedChoice === "attending" &&
                        submittedKidNames.length > 0 && (
                          <div className="mt-3 text-xs text-green-800/90">
                            <div className="font-semibold">Names:</div>
                            <div className="mt-1">
                              {submittedKidNames.join(", ")}
                            </div>
                          </div>
                        )}

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

                {isError && message && (
                  <div className="mt-6 rounded-xl px-4 py-3 text-center text-sm font-semibold bg-red-50 text-red-600 border border-red-200">
                    {message}
                  </div>
                )}

                {!message && !locked && (
                  <div className="mt-6 text-center text-xs text-black/45">
                    You can submit again anytime — your latest response will
                    replace the old one.
                  </div>
                )}
              </>
            )}
          </div>

          <div className="bg-[#f6f6f6] px-6 py-4 text-center text-xs text-black/50">
            If you made a mistake, you can submit again — the latest response
            will count.
          </div>
        </div>
      </main>
    </div>
  );
}


