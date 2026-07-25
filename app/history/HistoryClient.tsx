"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";

type HistoryClientProps = {
  role: "ADMIN" | "COACH";
};

type ClinicSession = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  programType: string;
  level: string | null;

  fullSessionCount: number;
  makeUpCount: number;
  singleDateCount: number;
};

type SessionResponse = {
  familyCode: string;
  choice: string;
  kidNames: string[];
  createdAt: string;
};

type KidRow = {
  kidKey: string;
  kidName: string;
  familyCode: string;
};

function expected(session: ClinicSession) {
  return (
    session.fullSessionCount +
    session.makeUpCount +
    session.singleDateCount
  );
}

function normName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export default function HistoryClient({
  role,
}: HistoryClientProps) {
  const [sessions, setSessions] = useState<ClinicSession[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [kidsBySession, setKidsBySession] = useState<
    Record<string, KidRow[]>
  >({});

  const [attendance, setAttendance] = useState<
    Record<string, Record<string, boolean>>
  >({});

  const [rsvpKidKeysBySession, setRsvpKidKeysBySession] = useState<
    Record<string, string[]>
  >({});

  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [loadingDetails, setLoadingDetails] = useState<
    Record<string, boolean>
  >({});
  const [savedMsg, setSavedMsg] = useState<Record<string, string>>({});
  const [pageError, setPageError] = useState<string>("");
  const [logoutBusy, setLogoutBusy] = useState<boolean>(false);

  const styles = useMemo(() => {
    const card: React.CSSProperties = {
      border: "1px solid #2a2a33",
      borderRadius: 16,
      padding: 16,
      background: "rgba(255,255,255,0.02)",
      boxShadow: "0 0 0 1px rgba(0,0,0,0.12) inset",
    };

    const muted: React.CSSProperties = {
      opacity: 0.75,
    };

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
      }) as React.CSSProperties;

    const pillBtn = (
      variant: "primary" | "neutral" | "success",
      disabled: boolean,
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
        return {
          ...base,
          background: "white",
          color: "#111",
        };
      }

      return {
        ...base,
        background: "#1b1b22",
        color: "white",
      };
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

    const logoutBtn: React.CSSProperties = {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "10px 12px",
      borderRadius: 12,
      border: "1px solid #ef4444",
      background: "transparent",
      color: "#f87171",
      fontWeight: 800,
      cursor: logoutBusy ? "not-allowed" : "pointer",
      opacity: logoutBusy ? 0.65 : 1,
    };

    return {
      card,
      muted,
      chip,
      pillBtn,
      navLinkBtn,
      logoutBtn,
    };
  }, [logoutBusy]);

  async function loadSessions() {
    setPageError("");

    try {
      const res = await fetch("/api/sessions", {
        cache: "no-store",
      });

      if (!res.ok) {
        const text = await res.text();

        setPageError(
          `GET /api/sessions failed (${res.status}): ${text}`,
        );

        return;
      }

      const data = await res.json();

      if (!Array.isArray(data)) {
        setPageError("Unexpected sessions response.");
        return;
      }

      setSessions(data);
    } catch (error: unknown) {
      if (error instanceof Error) {
        setPageError(error.message);
      } else {
        setPageError("Failed to load sessions.");
      }
    }
  }

  async function handleLogout() {
    setPageError("");
    setLogoutBusy(true);

    try {
      const res = await fetch("/api/auth/logout", {
        method: "POST",
      });

      if (!res.ok) {
        const text = await res.text();

        throw new Error(text || "Logout failed");
      }

      window.location.href = "/login";
    } catch (error: unknown) {
      if (error instanceof Error) {
        setPageError(error.message);
      } else {
        setPageError("Logout failed.");
      }

      setLogoutBusy(false);
    }
  }

  useEffect(() => {
    loadSessions();
  }, []);

  function getSummary(sessionId: string) {
    const rsvpKidKeys = rsvpKidKeysBySession[sessionId] ?? [];
    const sessionAttendance = attendance[sessionId] ?? {};

    const rsvpYes = rsvpKidKeys.length;

    let attended = 0;

    for (const key of rsvpKidKeys) {
      if (sessionAttendance[key] ?? true) {
        attended += 1;
      }
    }

    const noShow = Math.max(0, rsvpYes - attended);
    const walkIns = Math.max(0, attended - rsvpYes);

    return {
      rsvpYes,
      attended,
      noShow,
      walkIns,
    };
  }

  async function loadSessionDetails(sessionId: string) {
    setPageError("");

    setLoadingDetails((previous) => ({
      ...previous,
      [sessionId]: true,
    }));

    try {
      const responsesResult = await fetch(
        `/api/sessions/${sessionId}/responses`,
        {
          cache: "no-store",
        },
      );

      if (!responsesResult.ok) {
        const text = await responsesResult.text();

        setPageError(
          `GET /responses failed (${responsesResult.status}): ${text}`,
        );

        return;
      }

      const data: {
        responses: SessionResponse[];
      } = await responsesResult.json();

      const kidsMap = new Map<string, KidRow>();

      for (const response of data.responses) {
        const choice = String(response.choice ?? "")
          .trim()
          .toLowerCase();

        if (choice !== "attending") {
          continue;
        }

        for (const name of response.kidNames ?? []) {
          const cleanName = String(name ?? "").trim();

          if (!cleanName) {
            continue;
          }

          const kidKey = `${response.familyCode}:${normName(cleanName)}`;

          if (!kidsMap.has(kidKey)) {
            kidsMap.set(kidKey, {
              kidKey,
              kidName: cleanName,
              familyCode: response.familyCode,
            });
          }
        }
      }

      const kids = Array.from(kidsMap.values());

      setKidsBySession((previous) => ({
        ...previous,
        [sessionId]: kids,
      }));

      setRsvpKidKeysBySession((previous) => ({
        ...previous,
        [sessionId]: kids.map((kid) => kid.kidKey),
      }));

      const attendanceResult = await fetch(
        `/api/sessions/${sessionId}/attendance`,
        {
          cache: "no-store",
        },
      );

      if (!attendanceResult.ok) {
        const text = await attendanceResult.text();

        setPageError(
          `GET /attendance failed (${attendanceResult.status}): ${text}`,
        );

        return;
      }

      const savedAttendance: Array<{
        kidKey: string;
        kidName: string;
        familyCode: string | null;
        attended: boolean;
      }> = await attendanceResult.json();

      const savedMap: Record<string, boolean> = {};

      for (const row of savedAttendance) {
        savedMap[row.kidKey] = Boolean(row.attended);
      }

      setAttendance((previous) => {
        const nextForSession: Record<string, boolean> = {
          ...(previous[sessionId] ?? {}),
        };

        for (const kid of kids) {
          if (savedMap[kid.kidKey] !== undefined) {
            nextForSession[kid.kidKey] = savedMap[kid.kidKey];
          } else if (nextForSession[kid.kidKey] === undefined) {
            nextForSession[kid.kidKey] = true;
          }
        }

        return {
          ...previous,
          [sessionId]: nextForSession,
        };
      });
    } catch (error: unknown) {
      if (error instanceof Error) {
        setPageError(error.message);
      } else {
        setPageError("Failed to load session details.");
      }
    } finally {
      setLoadingDetails((previous) => ({
        ...previous,
        [sessionId]: false,
      }));
    }
  }

  async function saveAttendance(sessionId: string) {
    setPageError("");

    setSavedMsg((previous) => ({
      ...previous,
      [sessionId]: "",
    }));

    setSaving((previous) => ({
      ...previous,
      [sessionId]: true,
    }));

    try {
      const kids = kidsBySession[sessionId] ?? [];
      const sessionAttendance = attendance[sessionId] ?? {};

      const payload: Record<
        string,
        {
          kidName: string;
          familyCode: string;
          attended: boolean;
        }
      > = {};

      for (const kid of kids) {
        payload[kid.kidKey] = {
          kidName: kid.kidName,
          familyCode: kid.familyCode,
          attended: sessionAttendance[kid.kidKey] ?? true,
        };
      }

      const res = await fetch(
        `/api/sessions/${sessionId}/attendance`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            attendance: payload,
          }),
        },
      );

      if (!res.ok) {
        const text = await res.text();

        setPageError(
          `POST /attendance failed (${res.status}): ${text}`,
        );

        return;
      }

      setSavedMsg((previous) => ({
        ...previous,
        [sessionId]: `Saved at ${new Date().toLocaleTimeString()}`,
      }));

      window.setTimeout(() => {
        setSavedMsg((previous) => ({
          ...previous,
          [sessionId]: "",
        }));
      }, 3500);
    } catch (error: unknown) {
      if (error instanceof Error) {
        setPageError(error.message);
      } else {
        setPageError("Failed to save attendance.");
      }
    } finally {
      setSaving((previous) => ({
        ...previous,
        [sessionId]: false,
      }));
    }
  }

  return (
    <main
      style={{
        padding: 18,
        maxWidth: 1100,
        margin: "0 auto",
      }}
    >
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
          <h1
            style={{
              fontSize: 34,
              marginBottom: 6,
              letterSpacing: -0.3,
            }}
          >
            Session History
          </h1>

          <p
            style={{
              marginBottom: 16,
              ...styles.muted,
            }}
          >
            Expand a session → toggle actual attendance → Save.
          </p>
        </div>

        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          {role === "ADMIN" && (
            <Link
              href="/headcount"
              style={styles.navLinkBtn}
            >
              Headcount
            </Link>
          )}

          <Link href="/coach" style={styles.navLinkBtn}>
            Coach View
          </Link>

          <button
            type="button"
            onClick={handleLogout}
            disabled={logoutBusy}
            style={styles.logoutBtn}
          >
            {logoutBusy ? "Logging out..." : "Logout"}
          </button>
        </div>
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

      <div
        style={{
          display: "grid",
          gap: 12,
        }}
      >
        {sessions.map((session) => {
          const isOpen = Boolean(expanded[session.id]);
          const kids = kidsBySession[session.id] ?? [];
          const isLoading = Boolean(
            loadingDetails[session.id],
          );
          const summary = getSummary(session.id);

          const hasLoaded =
            rsvpKidKeysBySession[session.id] !== undefined;

          return (
            <div key={session.id} style={styles.card}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  alignItems: "flex-start",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 900,
                      fontSize: 16,
                    }}
                  >
                    {session.date} — {session.startTime}–
                    {session.endTime}
                  </div>

                  <div
                    style={{
                      ...styles.muted,
                      marginTop: 2,
                    }}
                  >
                    {session.programType}

                    {session.level !== null
                      ? ` • Level ${session.level}`
                      : ""}
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
                      <b>Expected</b> {expected(session)}
                    </span>

                    <span style={styles.chip("neutral")}>
                      <b>RSVP</b>{" "}
                      {hasLoaded
                        ? summary.rsvpYes
                        : "— (expand to load)"}
                    </span>

                    <span style={styles.chip("good")}>
                      <b>Attended</b>{" "}
                      {hasLoaded
                        ? summary.attended
                        : "— (expand to load)"}
                    </span>

                    <span
                      style={styles.chip(
                        summary.noShow ? "warn" : "neutral",
                      )}
                    >
                      <b>No-show</b>{" "}
                      {hasLoaded
                        ? summary.noShow
                        : "— (expand to load)"}

                      {hasLoaded && summary.walkIns > 0
                        ? ` • Walk-ins ${summary.walkIns}`
                        : ""}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  style={styles.pillBtn("primary", false)}
                  onClick={() => {
                    setExpanded((previous) => ({
                      ...previous,
                      [session.id]: !previous[session.id],
                    }));

                    if (!kidsBySession[session.id]) {
                      loadSessionDetails(session.id);
                    }
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

                    {savedMsg[session.id] ? (
                      <span
                        style={{
                          fontSize: 12,
                          opacity: 0.75,
                        }}
                      >
                        {savedMsg[session.id]}
                      </span>
                    ) : null}
                  </div>

                  {isLoading ? (
                    <div style={{ opacity: 0.75 }}>
                      Loading…
                    </div>
                  ) : kids.length > 0 ? (
                    <div
                      style={{
                        display: "grid",
                        gap: 8,
                        padding: 10,
                        borderRadius: 12,
                        border: "1px solid #2a2a33",
                        background:
                          "rgba(255,255,255,0.02)",
                      }}
                    >
                      {kids.map((kid) => {
                        const checked =
                          attendance[session.id]?.[
                            kid.kidKey
                          ] ?? true;

                        return (
                          <label
                            key={kid.kidKey}
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
                              onChange={(event) =>
                                setAttendance((previous) => ({
                                  ...previous,
                                  [session.id]: {
                                    ...(previous[
                                      session.id
                                    ] ?? {}),
                                    [kid.kidKey]:
                                      event.target.checked,
                                  },
                                }))
                              }
                              style={{
                                transform: "scale(1.15)",
                              }}
                            />

                            <span
                              style={{
                                fontSize: 14,
                                fontWeight: 700,
                              }}
                            >
                              {kid.kidName}
                            </span>

                            <span
                              style={{
                                opacity: 0.6,
                                fontSize: 12,
                              }}
                            >
                              {kid.familyCode}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ opacity: 0.65 }}>
                      No attending responses found.
                    </div>
                  )}

                  <div
                    style={{
                      display: "flex",
                      gap: 10,
                      marginTop: 12,
                    }}
                  >
                    <button
                      type="button"
                      style={styles.pillBtn(
                        "success",
                        Boolean(saving[session.id]) ||
                          isLoading,
                      )}
                      disabled={
                        Boolean(saving[session.id]) ||
                        isLoading
                      }
                      onClick={() =>
                        saveAttendance(session.id)
                      }
                    >
                      {saving[session.id]
                        ? "Saving..."
                        : "Save Attendance"}
                    </button>

                    <button
                      type="button"
                      style={styles.pillBtn(
                        "neutral",
                        isLoading,
                      )}
                      disabled={isLoading}
                      onClick={() =>
                        loadSessionDetails(session.id)
                      }
                      title="Reload RSVP and saved attendance from the server"
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