"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";

type ClinicSession = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  programType: string;
  level: number | null;

  fullSessionCount: number;
  makeUpCount: number;
  singleDateCount: number;
};

type SessionResponse = {
  familyCode: string;
  choice: string; // "attending" | "not_attending"
  kidNames: string[];
  createdAt: string;
};

type KidRow = {
  kidKey: string;
  kidName: string;
  familyCode: string;
};

function expected(s: ClinicSession) {
  return s.fullSessionCount + s.makeUpCount + s.singleDateCount;
}

function normName(x: string) {
  return x.trim().replace(/\s+/g, " ").toLowerCase();
}

export default function HistoryPage() {
  const [sessions, setSessions] = useState<ClinicSession[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [kidsBySession, setKidsBySession] = useState<Record<string, KidRow[]>>(
    {}
  );

  // attendance[sessionId][kidKey] = attended
  const [attendance, setAttendance] = useState<
    Record<string, Record<string, boolean>>
  >({});

  // RSVP-attending kid keys (to compute RSVP count / no-shows)
  const [rsvpKidKeysBySession, setRsvpKidKeysBySession] = useState<
    Record<string, string[]>
  >({});

  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [loadingDetails, setLoadingDetails] = useState<Record<string, boolean>>(
    {}
  );
  const [savedMsg, setSavedMsg] = useState<Record<string, string>>({});

  const [pageError, setPageError] = useState<string>("");

  const styles = useMemo(() => {
    const card: React.CSSProperties = {
      border: "1px solid #2a2a33",
      borderRadius: 16,
      padding: 16,
      background: "rgba(255,255,255,0.02)",
      boxShadow: "0 0 0 1px rgba(0,0,0,0.12) inset",
    };

    const muted: React.CSSProperties = { opacity: 0.75 };

    const chip = (kind: "neutral" | "good" | "warn") =>
      ({
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 10px",
        borderRadius: 999,
        border: "1px solid #2a2a33",
        background:
          kind === "good"
            ? "rgba(22,163,74,0.12)"
            : kind === "warn"
            ? "rgba(234,179,8,0.12)"
            : "rgba(255,255,255,0.03)",
        color: "rgba(255,255,255,0.92)",
        fontSize: 12,
        whiteSpace: "nowrap",
      } as React.CSSProperties);

    const pillBtn = (
      variant: "primary" | "neutral" | "success",
      disabled: boolean
    ) => {
      const base: React.CSSProperties = {
        padding: "10px 12px",
        borderRadius: 12,
        border: "1px solid #2a2a33",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.65 : 1,
        fontWeight: 800,
      };

      if (variant === "success") {
        return {
          ...base,
          background: "#16a34a",
          color: "white",
          border: "1px solid #14532d",
        };
      }
      if (variant === "primary") {
        return { ...base, background: "white", color: "#111" };
      }
      return { ...base, background: "#1b1b22", color: "white" };
    };

    const navLinkBtn: React.CSSProperties = {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "10px 12px",
      borderRadius: 12,
      border: "1px solid #2a2a33",
      background: "#1b1b22",
      color: "white",
      fontWeight: 800,
      textDecoration: "none",
    };

    return { card, muted, chip, pillBtn, navLinkBtn };
  }, []);

  async function loadSessions() {
    setPageError("");
    const res = await fetch("/api/sessions", { cache: "no-store" });

    if (!res.ok) {
      const txt = await res.text();
      setPageError(`GET /api/sessions failed (${res.status}): ${txt}`);
      return;
    }

    const data = await res.json();
    setSessions(data);
  }

  useEffect(() => {
    loadSessions();
  }, []);

  function getSummary(sessionId: string) {
    const rsvpKidKeys = rsvpKidKeysBySession[sessionId] ?? [];
    const a = attendance[sessionId] ?? {};

    const rsvpYes = rsvpKidKeys.length;

    let attended = 0;
    for (const key of rsvpKidKeys) {
      if (a[key] ?? true) attended += 1;
    }

    const noShow = Math.max(0, rsvpYes - attended);
    const walkIns = Math.max(0, attended - rsvpYes);

    return { rsvpYes, attended, noShow, walkIns };
  }

  async function loadSessionDetails(sessionId: string) {
    setPageError("");
    setLoadingDetails((p) => ({ ...p, [sessionId]: true }));

    try {
      const res = await fetch(`/api/sessions/${sessionId}/responses`, {
        cache: "no-store",
      });

      if (!res.ok) {
        const txt = await res.text();
        setPageError(`GET /responses failed (${res.status}): ${txt}`);
        return;
      }

      const data: { responses: SessionResponse[] } = await res.json();

      // Build KidRow list from ATTENDING responses only
      const kidsMap = new Map<string, KidRow>();

      for (const r of data.responses) {
        const choice = String(r.choice ?? "").trim().toLowerCase();
        if (choice !== "attending") continue;

        for (const name of r.kidNames ?? []) {
          const clean = String(name ?? "").trim();
          if (!clean) continue;

          const kidKey = `${r.familyCode}:${normName(clean)}`;
          if (!kidsMap.has(kidKey)) {
            kidsMap.set(kidKey, {
              kidKey,
              kidName: clean,
              familyCode: r.familyCode,
            });
          }
        }
      }

      const kids = Array.from(kidsMap.values());
      setKidsBySession((p) => ({ ...p, [sessionId]: kids }));
      setRsvpKidKeysBySession((p) => ({
        ...p,
        [sessionId]: kids.map((k) => k.kidKey),
      }));

      // Load saved attendance
      const ares = await fetch(`/api/sessions/${sessionId}/attendance`, {
        cache: "no-store",
      });

      if (!ares.ok) {
        const txt = await ares.text();
        setPageError(`GET /attendance failed (${ares.status}): ${txt}`);
        return;
      }

      const saved: Array<{
        kidKey: string;
        kidName: string;
        familyCode: string | null;
        attended: boolean;
      }> = await ares.json();

      const savedMap: Record<string, boolean> = {};
      for (const row of saved) savedMap[row.kidKey] = !!row.attended;

      // Default toggles to true, override with saved values
      setAttendance((prev) => {
        const nextForSession: Record<string, boolean> = {
          ...(prev[sessionId] ?? {}),
        };

        for (const k of kids) {
          if (savedMap[k.kidKey] !== undefined)
            nextForSession[k.kidKey] = savedMap[k.kidKey];
          else if (nextForSession[k.kidKey] === undefined)
            nextForSession[k.kidKey] = true;
        }

        return { ...prev, [sessionId]: nextForSession };
      });
    } finally {
      setLoadingDetails((p) => ({ ...p, [sessionId]: false }));
    }
  }

  async function saveAttendance(sessionId: string) {
    setPageError("");
    setSavedMsg((p) => ({ ...p, [sessionId]: "" }));
    setSaving((p) => ({ ...p, [sessionId]: true }));

    try {
      const kids = kidsBySession[sessionId] ?? [];
      const a = attendance[sessionId] ?? {};

      const payload: Record<
        string,
        { kidName: string; familyCode: string; attended: boolean }
      > = {};

      for (const k of kids) {
        payload[k.kidKey] = {
          kidName: k.kidName,
          familyCode: k.familyCode,
          attended: a[k.kidKey] ?? true,
        };
      }

      const res = await fetch(`/api/sessions/${sessionId}/attendance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attendance: payload }),
      });

      if (!res.ok) {
        const txt = await res.text();
        setPageError(`POST /attendance failed (${res.status}): ${txt}`);
        return;
      }

      setSavedMsg((p) => ({
        ...p,
        [sessionId]: `Saved at ${new Date().toLocaleTimeString()}`,
      }));

      window.setTimeout(() => {
        setSavedMsg((p) => ({ ...p, [sessionId]: "" }));
      }, 3500);
    } finally {
      setSaving((p) => ({ ...p, [sessionId]: false }));
    }
  }

  return (
    <main style={{ padding: 18, maxWidth: 1100, margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
          marginBottom: 6,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1 style={{ fontSize: 34, marginBottom: 6, letterSpacing: -0.3 }}>
            Session History
          </h1>
          <p style={{ marginBottom: 16, ...styles.muted }}>
            Expand a session → toggle actual attendance → Save.
          </p>
        </div>

        <Link href="/headcount" style={styles.navLinkBtn}>
          Headcount
        </Link>
      </div>

      {pageError && (
        <div
          style={{
            marginBottom: 12,
            padding: 12,
            border: "1px solid #7a2a2a",
            borderRadius: 12,
            whiteSpace: "pre-wrap",
            background: "rgba(122,42,42,0.12)",
          }}
        >
          {pageError}
        </div>
      )}

      <div style={{ display: "grid", gap: 12 }}>
        {sessions.map((s) => {
          const isOpen = !!expanded[s.id];
          const kids = kidsBySession[s.id] ?? [];
          const isLoading = !!loadingDetails[s.id];
          const sum = getSummary(s.id);

          const hasLoaded = !!rsvpKidKeysBySession[s.id];

          return (
            <div key={s.id} style={styles.card}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  alignItems: "flex-start",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 900, fontSize: 16 }}>
                    {s.date} — {s.startTime}–{s.endTime}
                  </div>
                  <div style={{ ...styles.muted, marginTop: 2 }}>
                    {s.programType}
                    {s.level != null ? ` • Level ${s.level}` : ""}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 8,
                      marginTop: 10,
                    }}
                  >
                    <span style={styles.chip("neutral")}>
                      <b>Expected</b> {expected(s)}
                    </span>

                    <span style={styles.chip("neutral")}>
                      <b>RSVP</b>{" "}
                      {hasLoaded ? sum.rsvpYes : "— (expand to load)"}
                    </span>

                    <span style={styles.chip("good")}>
                      <b>Attended</b>{" "}
                      {hasLoaded ? sum.attended : "— (expand to load)"}
                    </span>

                    <span style={styles.chip(sum.noShow ? "warn" : "neutral")}>
                      <b>No-show</b>{" "}
                      {hasLoaded ? sum.noShow : "— (expand to load)"}
                      {hasLoaded && sum.walkIns > 0 ? ` • Walk-ins ${sum.walkIns}` : ""}
                    </span>
                  </div>
                </div>

                <button
                  style={styles.pillBtn("primary", false)}
                  onClick={() => {
                    setExpanded((p) => ({ ...p, [s.id]: !p[s.id] }));
                    if (!kidsBySession[s.id]) loadSessionDetails(s.id);
                  }}
                >
                  {isOpen ? "Hide" : "Expand"}
                </button>
              </div>

              {isOpen && (
                <div style={{ marginTop: 14 }}>
                  <div
                    style={{
                      fontWeight: 900,
                      marginBottom: 8,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <span>Actual attendance</span>
                    {savedMsg[s.id] ? (
                      <span style={{ fontSize: 12, opacity: 0.75 }}>
                        {savedMsg[s.id]}
                      </span>
                    ) : null}
                  </div>

                  {isLoading ? (
                    <div style={{ opacity: 0.75 }}>Loading…</div>
                  ) : kids.length ? (
                    <div
                      style={{
                        display: "grid",
                        gap: 8,
                        padding: 10,
                        borderRadius: 12,
                        border: "1px solid #2a2a33",
                        background: "rgba(255,255,255,0.02)",
                      }}
                    >
                      {kids.map((k) => {
                        const checked = attendance[s.id]?.[k.kidKey] ?? true;

                        return (
                          <label
                            key={k.kidKey}
                            style={{
                              display: "flex",
                              gap: 10,
                              alignItems: "center",
                              padding: "6px 8px",
                              borderRadius: 10,
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) =>
                                setAttendance((prev) => ({
                                  ...prev,
                                  [s.id]: {
                                    ...(prev[s.id] ?? {}),
                                    [k.kidKey]: e.target.checked,
                                  },
                                }))
                              }
                              style={{ transform: "scale(1.15)" }}
                            />
                            <span style={{ fontSize: 14, fontWeight: 700 }}>
                              {k.kidName}
                            </span>
                            <span style={{ opacity: 0.6, fontSize: 12 }}>
                              {k.familyCode}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ opacity: 0.65 }}>No attending responses found.</div>
                  )}

                  <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                    <button
                      style={styles.pillBtn(
                        "success",
                        !!saving[s.id] || isLoading
                      )}
                      disabled={!!saving[s.id] || isLoading}
                      onClick={() => saveAttendance(s.id)}
                    >
                      {saving[s.id] ? "Saving..." : "Save Attendance"}
                    </button>

                    <button
                      style={styles.pillBtn("neutral", isLoading)}
                      disabled={isLoading}
                      onClick={() => loadSessionDetails(s.id)}
                      title="Reload RSVP + saved attendance from the server"
                    >
                      Refresh details
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}