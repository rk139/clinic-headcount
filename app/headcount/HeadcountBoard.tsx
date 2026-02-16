"use client";

import { useEffect, useMemo, useState } from "react";

type ClinicSession = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  programType: string;
  level: number | null;
  capacity: number;
  fullSessionCount: number;
  makeUpCount: number;
  singleDateCount: number;

  // Step 4 + Step 6
  responseLink?: { token: string; closedAt?: string | null } | null;

  // Step 5: response totals (number of submissions)
  attendingCount?: number;
  notAttendingCount?: number;

  // ✅ NEW: kid-based totals + names
  attendingKidsCount?: number;
  notAttendingKidsCount?: number;
  attendingKidNames?: string[];
  notAttendingKidNames?: string[];

  lastResponseAt?: string | null;
};

function expected(s: ClinicSession) {
  return s.fullSessionCount + s.makeUpCount + s.singleDateCount;
}

function displayName(s: ClinicSession) {
  if (s.programType === "RED_BALL") return "Red Ball";
  if (s.programType === "JUNIORS" && s.level) return `Level ${s.level}`;
  return s.programType;
}

function uniquePreserveOrder(names: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const n of names) {
    const key = n.trim().toLowerCase();
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(n.trim());
  }
  return out;
}

export default function HeadcountBoard() {
  const [sessions, setSessions] = useState<ClinicSession[]>([]);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string>("");

  const [linkBusyId, setLinkBusyId] = useState<string | null>(null);
  const [copiedSessionId, setCopiedSessionId] = useState<string | null>(null);

  // Step 6 UI state (close/reopen)
  const [closeBusyId, setCloseBusyId] = useState<string | null>(null);

  // ✅ NEW: toggle showing names per session
  const [openNamesForId, setOpenNamesForId] = useState<Record<string, boolean>>(
    {}
  );

  const load = async () => {
    setError("");
    const res = await fetch("/api/sessions", { cache: "no-store" });
    const data = (await res.json()) as ClinicSession[];
    setSessions(data);
  };

  useEffect(() => {
    load();
  }, []);

  const byDate = useMemo(() => {
    const m = new Map<string, ClinicSession[]>();
    for (const s of sessions) {
      const arr = m.get(s.date) ?? [];
      arr.push(s);
      m.set(s.date, arr);
    }
    return m;
  }, [sessions]);

  const dates = useMemo(() => Array.from(byDate.keys()).sort(), [byDate]);

  const updateLocal = (id: string, patch: Partial<ClinicSession>) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...patch } : s))
    );
  };

  const saveRow = async (s: ClinicSession) => {
    setSaving((prev) => ({ ...prev, [s.id]: true }));
    setError("");

    try {
      const res = await fetch(`/api/sessions/${s.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullSessionCount: s.fullSessionCount,
          makeUpCount: s.makeUpCount,
          singleDateCount: s.singleDateCount,
        }),
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `Save failed (${res.status})`);
      }

      await load();
    } catch (e: any) {
      setError(e?.message ?? "Save failed");
    } finally {
      setSaving((prev) => ({ ...prev, [s.id]: false }));
    }
  };

  const generateLink = async (sessionId: string) => {
    setError("");
    setLinkBusyId(sessionId);

    try {
      const res = await fetch("/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });

      if (!res.ok) {
        const msg = await res.json().catch(() => ({}));
        throw new Error(msg?.error || `Failed to generate link`);
      }

      await load();
    } catch (e: any) {
      setError(e?.message ?? "Failed to generate link");
    } finally {
      setLinkBusyId(null);
    }
  };

  const copyLink = async (token: string, sessionId: string) => {
    const url = `${window.location.origin}/r/${token}`;
    await navigator.clipboard.writeText(url);

    setCopiedSessionId(sessionId);
    setTimeout(() => setCopiedSessionId(null), 900);

    // Hide link locally after copy (DB unchanged)
    setSessions((prev) =>
      prev.map((s) => (s.id === sessionId ? { ...s, responseLink: null } : s))
    );
  };

  // Step 6: close link (manual)
  const closeLink = async (sessionId: string) => {
    setError("");
    setCloseBusyId(sessionId);

    try {
      const res = await fetch(`/api/links/${sessionId}/close`, {
        method: "POST",
      });
      if (!res.ok) {
        const msg = await res.json().catch(() => ({}));
        throw new Error(msg?.error || "Failed to close link");
      }
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Failed to close link");
    } finally {
      setCloseBusyId(null);
    }
  };

  // Step 6: reopen link (manual)
  const reopenLink = async (sessionId: string) => {
    setError("");
    setCloseBusyId(sessionId);

    try {
      const res = await fetch(`/api/links/${sessionId}/close`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const msg = await res.json().catch(() => ({}));
        throw new Error(msg?.error || "Failed to reopen link");
      }
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Failed to reopen link");
    } finally {
      setCloseBusyId(null);
    }
  };

  const styles = {
    page: {
      minHeight: "100vh",
      padding: 24,
      fontFamily: "system-ui",
      background: "#0b0b0f",
      color: "#eaeaf0",
    } as React.CSSProperties,
    subText: { color: "#a1a1aa" } as React.CSSProperties,
    topRow: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      marginBottom: 18,
    } as React.CSSProperties,
    refreshBtn: {
      padding: "6px 10px",
      borderRadius: 10,
      border: "1px solid #2a2a33",
      background: "transparent",
      color: "#d4d4db",
      cursor: "pointer",
    } as React.CSSProperties,
    dateHeader: {
      fontSize: 18,
      marginBottom: 10,
      color: "#eaeaf0",
    } as React.CSSProperties,
    card: {
      border: "1px solid #2a2a33",
      borderRadius: 14,
      padding: 14,
      background: "#0f0f16",
    } as React.CSSProperties,
    metaRow: {
      marginTop: 10,
      display: "flex",
      gap: 16,
      flexWrap: "wrap",
      color: "#d4d4db",
      alignItems: "center",
    } as React.CSSProperties,
    row: {
      marginTop: 12,
      display: "flex",
      gap: 12,
      flexWrap: "wrap",
      alignItems: "center",
    } as React.CSSProperties,
    label: { color: "#d4d4db" } as React.CSSProperties,
    input: {
      width: 84,
      marginLeft: 6,
      background: "#0b0b0f",
      color: "#eaeaf0",
      border: "1px solid #2a2a33",
      borderRadius: 10,
      padding: "6px 8px",
      outline: "none",
    } as React.CSSProperties,
    saveBtn: (isSaving: boolean) =>
      ({
        padding: "8px 14px",
        borderRadius: 12,
        border: "none",
        background: isSaving ? "#2a2a33" : "#22c55e",
        color: isSaving ? "#b7b7c3" : "#0b0b0f",
        fontWeight: 700,
        cursor: isSaving ? "not-allowed" : "pointer",
        marginLeft: "auto",
      }) as React.CSSProperties,
    linkChip: {
      fontSize: 12,
      padding: "4px 8px",
      borderRadius: 10,
      border: "1px solid #2a2a33",
      background: "#0b0b0f",
      color: "#d4d4db",
    } as React.CSSProperties,
    linkBtn: (disabled: boolean) =>
      ({
        padding: "6px 10px",
        borderRadius: 10,
        border: "1px solid #2a2a33",
        background: disabled ? "#14141c" : "transparent",
        color: disabled ? "#7c7c88" : "#d4d4db",
        cursor: disabled ? "not-allowed" : "pointer",
      }) as React.CSSProperties,
    errorBox: {
      marginBottom: 16,
      color: "#fecaca",
      background: "#2a0f12",
      border: "1px solid #7f1d1d",
      padding: "10px 12px",
      borderRadius: 12,
    } as React.CSSProperties,

    // ✅ NEW: names UI
    namesBtn: {
      padding: "6px 10px",
      borderRadius: 10,
      border: "1px solid #2a2a33",
      background: "transparent",
      color: "#d4d4db",
      cursor: "pointer",
    } as React.CSSProperties,
    namesPanel: {
      marginTop: 10,
      border: "1px solid #2a2a33",
      borderRadius: 12,
      background: "#0b0b0f",
      padding: 10,
      color: "#d4d4db",
    } as React.CSSProperties,
    namePill: {
      display: "inline-block",
      fontSize: 12,
      padding: "4px 8px",
      borderRadius: 999,
      border: "1px solid #2a2a33",
      background: "#0f0f16",
      color: "#eaeaf0",
      marginRight: 8,
      marginBottom: 8,
    } as React.CSSProperties,
  };

  return (
    <main style={styles.page}>
      <h1 style={{ fontSize: 30, marginBottom: 8 }}>Clinic Headcount</h1>
      <p style={{ marginBottom: 14, ...styles.subText }}>
        Expected = Full Session + Make-up + Single-date
      </p>

      <div style={styles.topRow}>
        <button onClick={load} style={styles.refreshBtn}>
          Refresh
        </button>
        <span style={styles.subText}>
          Tip: edit counts → Save (persists to database)
        </span>
      </div>

      {error ? (
        <div style={styles.errorBox}>
          <strong>Error:</strong> {error}
        </div>
      ) : null}

      {dates.map((date) => {
        const daySessions = byDate.get(date)!;

        return (
          <section key={date} style={{ marginBottom: 24 }}>
            <h2 style={styles.dateHeader}>{date}</h2>

            <div style={{ display: "grid", gap: 12 }}>
              {daySessions.map((s) => {
                const hasLink = !!s.responseLink?.token;
                const isClosed = !!s.responseLink?.closedAt;
                const busy = linkBusyId === s.id || closeBusyId === s.id;

                // ✅ NEW: kid name derived values (with dedupe)
                const yesNames = uniquePreserveOrder(s.attendingKidNames ?? []);
                const noNames = uniquePreserveOrder(s.notAttendingKidNames ?? []);

                const yesKids = s.attendingKidsCount ?? yesNames.length;
                const noKids = s.notAttendingKidsCount ?? noNames.length;

                const isNamesOpen = !!openNamesForId[s.id];

                const toggleNames = () =>
                  setOpenNamesForId((prev) => ({
                    ...prev,
                    [s.id]: !prev[s.id],
                  }));

                return (
                  <div key={s.id} style={styles.card}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <strong style={{ fontSize: 18 }}>{displayName(s)}</strong>
                      <span style={styles.subText}>
                        {s.startTime}–{s.endTime}
                      </span>
                    </div>

                    <div style={styles.metaRow}>
                      <span>Capacity: {s.capacity}</span>
                      <span>
                        Expected:{" "}
                        <strong style={{ color: "#eaeaf0" }}>{expected(s)}</strong>
                      </span>

                      <span>
                        Responses:{" "}
                        <strong style={{ color: "#eaeaf0" }}>
                          {s.attendingCount ?? 0} Yes / {s.notAttendingCount ?? 0} No
                        </strong>
                      </span>

                      {/* ✅ NEW: kid-based totals */}
                      <span>
                        RSVP kids:{" "}
                        <strong style={{ color: "#eaeaf0" }}>
                          {yesKids} Yes / {noKids} No
                        </strong>
                      </span>

                      {/* ✅ NEW: toggle names */}
                      <button type="button" onClick={toggleNames} style={styles.namesBtn}>
                        {isNamesOpen ? "Hide names" : "Show names"}
                      </button>

                      <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                        {!hasLink ? (
                          <button
                            type="button"
                            onClick={() => generateLink(s.id)}
                            disabled={linkBusyId === s.id}
                            style={styles.linkBtn(linkBusyId === s.id)}
                          >
                            {linkBusyId === s.id ? "Generating..." : "Generate Link"}
                          </button>
                        ) : isClosed ? (
                          <>
                            <span style={styles.linkChip}>Link closed</span>
                            <button
                              type="button"
                              onClick={() => reopenLink(s.id)}
                              disabled={busy}
                              style={styles.linkBtn(busy)}
                            >
                              {closeBusyId === s.id ? "Reopening..." : "Reopen"}
                            </button>
                          </>
                        ) : (
                          <>
                            <span style={styles.linkChip}>/r/{s.responseLink!.token}</span>
                            <button
                              type="button"
                              onClick={() => copyLink(s.responseLink!.token, s.id)}
                              disabled={busy}
                              style={styles.linkBtn(busy)}
                            >
                              {copiedSessionId === s.id ? "Copied" : "Copy"}
                            </button>
                            <button
                              type="button"
                              onClick={() => closeLink(s.id)}
                              disabled={busy}
                              style={styles.linkBtn(busy)}
                            >
                              {closeBusyId === s.id ? "Closing..." : "Close"}
                            </button>
                          </>
                        )}
                      </span>
                    </div>

                    {/* ✅ NEW: names panel */}
                    {isNamesOpen ? (
                      <div style={styles.namesPanel}>
                        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                          Attending ({yesNames.length})
                        </div>
                        {yesNames.length ? (
                          <div style={{ marginBottom: 10 }}>
                            {yesNames.map((n) => (
                              <span key={`y-${n}`} style={styles.namePill}>
                                {n}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <div style={{ fontSize: 12, color: "#a1a1aa", marginBottom: 10 }}>
                            No names yet.
                          </div>
                        )}

                        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                          Not attending ({noNames.length})
                        </div>
                        {noNames.length ? (
                          <div>
                            {noNames.map((n) => (
                              <span key={`n-${n}`} style={styles.namePill}>
                                {n}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <div style={{ fontSize: 12, color: "#a1a1aa" }}>
                            No names yet.
                          </div>
                        )}
                      </div>
                    ) : null}

                    <div style={styles.row}>
                      <label style={styles.label}>
                        Full
                        <input
                          type="number"
                          value={s.fullSessionCount}
                          onChange={(e) =>
                            updateLocal(s.id, {
                              fullSessionCount: Number(e.target.value),
                            })
                          }
                          style={styles.input}
                          min={0}
                        />
                      </label>

                      <label style={styles.label}>
                        Make-up
                        <input
                          type="number"
                          value={s.makeUpCount}
                          onChange={(e) =>
                            updateLocal(s.id, { makeUpCount: Number(e.target.value) })
                          }
                          style={styles.input}
                          min={0}
                        />
                      </label>

                      <label style={styles.label}>
                        Single-date
                        <input
                          type="number"
                          value={s.singleDateCount}
                          onChange={(e) =>
                            updateLocal(s.id, {
                              singleDateCount: Number(e.target.value),
                            })
                          }
                          style={styles.input}
                          min={0}
                        />
                      </label>

                      <button
                        onClick={() => saveRow(s)}
                        disabled={!!saving[s.id]}
                        style={styles.saveBtn(!!saving[s.id])}
                      >
                        {saving[s.id] ? "Saving..." : "Save"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </main>
  );
}






