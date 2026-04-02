"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Session } from "./page";

type CourtMap = Record<string, string[][]>;

function getSessionTitle(session: Session) {
  if (session.programType === "RED_BALL") {
    return "Red Ball";
  }

  if (session.level !== null) {
    return `Level ${session.level}`;
  }

  return session.programType;
}

function formatTime(time: string) {
  const [hourString, minute] = time.split(":");
  let hour = Number(hourString);
  const suffix = hour >= 12 ? "PM" : "AM";

  hour = hour % 12;
  if (hour === 0) hour = 12;

  return `${hour}:${minute} ${suffix}`;
}

function getCourtCount(kidCount: number) {
  if (kidCount <= 4) return 1;
  if (kidCount <= 8) return 2;
  if (kidCount <= 12) return 3;
  if (kidCount <= 16) return 4;
  return 5;
}

function shuffleArray(names: string[]) {
  const copy = [...names];

  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy;
}

function generateCourts(names: string[]) {
  if (names.length === 0) return [];

  const shuffled = shuffleArray(names);
  const courtCount = getCourtCount(shuffled.length);
  const courts: string[][] = Array.from({ length: courtCount }, () => []);

  shuffled.forEach((name, index) => {
    courts[index % courtCount].push(name);
  });

  return courts;
}

export default function CoachBoard({ sessions }: { sessions: Session[] }) {
  const router = useRouter();
  const [generatedCourts, setGeneratedCourts] = useState<CourtMap>({});

  const sortedSessions = useMemo(() => {
    return [...sessions].sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [sessions]);

  function handleGenerate(session: Session) {
    const names = session.attendingKidNames ?? [];
    const courts = generateCourts(names);

    setGeneratedCourts((prev) => ({
      ...prev,
      [session.id]: courts,
    }));
  }

  function handleClear(sessionId: string) {
    setGeneratedCourts((prev) => {
      const next = { ...prev };
      delete next[sessionId];
      return next;
    });
  }

  return (
    <main style={styles.page}>
      <div style={styles.inner}>
        <div style={styles.topRow}>
          <div>
            <h1 style={styles.heading}>Coach View</h1>
            <p style={styles.subheading}>Today’s sessions</p>
          </div>

          <div style={styles.topActions}>
            <Link href="/headcount" style={styles.navLinkBtn}>
              Headcount
            </Link>

            <Link href="/history" style={styles.navLinkBtn}>
              History
            </Link>

            <button style={styles.refreshButton} onClick={() => router.refresh()}>
              Refresh
            </button>
          </div>
        </div>

        {sortedSessions.length === 0 ? (
          <div style={styles.emptyState}>No sessions scheduled for today.</div>
        ) : (
          <div style={styles.cardList}>
            {sortedSessions.map((session) => {
              const names = session.attendingKidNames ?? [];
              const courts = generatedCourts[session.id] ?? [];

              return (
                <section key={session.id} style={styles.card}>
                  <h2 style={styles.cardTitle}>{getSessionTitle(session)}</h2>

                  <p style={styles.time}>
                    {formatTime(session.startTime)} - {formatTime(session.endTime)}
                  </p>

                  <div style={styles.countBlock}>
                    <div style={styles.countNumber}>
                      {session.attendingKidsCount ?? 0}
                    </div>
                    <div style={styles.countLabel}>kids attending</div>
                  </div>

                  <div style={styles.sectionBlock}>
                    <h3 style={styles.namesHeading}>Attending</h3>

                    {names.length > 0 ? (
                      <div style={styles.namePills}>
                        {names.map((name, index) => (
                          <span key={`${session.id}-${index}`} style={styles.pill}>
                            {name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p style={styles.emptyText}>No names yet</p>
                    )}
                  </div>

                  <div style={styles.buttonRow}>
                    <button
                      style={styles.generateButton}
                      onClick={() => handleGenerate(session)}
                      disabled={names.length === 0}
                    >
                      Generate Courts
                    </button>

                    {courts.length > 0 && (
                      <button
                        style={styles.clearButton}
                        onClick={() => handleClear(session.id)}
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  {courts.length > 0 && (
                    <div style={styles.courtsGrid}>
                      {courts.map((court, index) => (
                        <div key={`${session.id}-court-${index}`} style={styles.courtCard}>
                          <h4 style={styles.courtTitle}>Court {index + 1}</h4>

                          <div style={styles.courtNames}>
                            {court.map((name, nameIndex) => (
                              <div
                                key={`${session.id}-court-${index}-${nameIndex}`}
                                style={styles.courtName}
                              >
                                {name}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    backgroundColor: "#0f172a",
    fontFamily: "Arial, sans-serif",
    padding: "32px 24px",
  },
  inner: {
    maxWidth: "820px",
    margin: "0 auto",
  },
  topRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "16px",
    marginBottom: "24px",
    flexWrap: "wrap",
  },
  topActions: {
    display: "flex",
    gap: "10px",
    alignItems: "center",
    flexWrap: "wrap",
  },
  heading: {
    fontSize: "32px",
    margin: "0 0 6px 0",
    color: "#ffffff",
  },
  subheading: {
    fontSize: "16px",
    color: "#cbd5e1",
    margin: 0,
  },
  navLinkBtn: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "10px 14px",
    borderRadius: "10px",
    backgroundColor: "#e2e8f0",
    color: "#111827",
    fontSize: "14px",
    fontWeight: 600,
    textDecoration: "none",
  },
  refreshButton: {
    border: "none",
    borderRadius: "10px",
    padding: "10px 14px",
    backgroundColor: "#e2e8f0",
    color: "#111827",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
  },
  emptyState: {
    backgroundColor: "#ffffff",
    borderRadius: "16px",
    padding: "20px",
    color: "#111827",
    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
  },
  cardList: {
    display: "grid",
    gap: "16px",
  },
  card: {
    borderRadius: "16px",
    padding: "18px 20px",
    backgroundColor: "#ffffff",
    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
  },
  cardTitle: {
    fontSize: "22px",
    margin: "0 0 6px 0",
    color: "#111827",
  },
  time: {
    fontSize: "15px",
    color: "#6b7280",
    margin: "0 0 14px 0",
  },
  countBlock: {
    marginBottom: "16px",
  },
  countNumber: {
    fontSize: "42px",
    fontWeight: "bold",
    color: "#111827",
    lineHeight: 1,
  },
  countLabel: {
    fontSize: "14px",
    color: "#6b7280",
    marginTop: "6px",
  },
  sectionBlock: {
    marginBottom: "16px",
  },
  namesHeading: {
    fontSize: "16px",
    margin: "0 0 8px 0",
    color: "#111827",
  },
  namePills: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
  },
  pill: {
    padding: "8px 12px",
    borderRadius: "999px",
    backgroundColor: "#e5e7eb",
    fontSize: "14px",
    color: "#111827",
  },
  emptyText: {
    color: "#6b7280",
    margin: 0,
  },
  buttonRow: {
    display: "flex",
    gap: "10px",
    marginBottom: "16px",
  },
  generateButton: {
    border: "none",
    borderRadius: "10px",
    padding: "10px 14px",
    backgroundColor: "#2563eb",
    color: "#ffffff",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
  },
  clearButton: {
    border: "1px solid #d1d5db",
    borderRadius: "10px",
    padding: "10px 14px",
    backgroundColor: "#ffffff",
    color: "#111827",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
  },
  courtsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "12px",
  },
  courtCard: {
    backgroundColor: "#f8fafc",
    border: "1px solid #e5e7eb",
    borderRadius: "14px",
    padding: "14px",
  },
  courtTitle: {
    margin: "0 0 10px 0",
    fontSize: "16px",
    color: "#111827",
  },
  courtNames: {
    display: "grid",
    gap: "8px",
  },
  courtName: {
    fontSize: "14px",
    color: "#111827",
    padding: "6px 8px",
    backgroundColor: "#ffffff",
    borderRadius: "8px",
    border: "1px solid #e5e7eb",
  },
};