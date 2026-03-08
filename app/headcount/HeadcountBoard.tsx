"use client";

import { useEffect, useMemo, useState } from "react";

// drag n drop imports
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";

import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

import { CSS } from "@dnd-kit/utilities";

type Kid = { key: string; label: string };

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

  // ✅ kid-based totals + names
  attendingKidsCount?: number;
  notAttendingKidsCount?: number;
  attendingKidNames?: string[];
  notAttendingKidNames?: string[];

  // ✅ NEW: key+label kids (from /api/sessions)
  attendingKids?: Kid[];
  notAttendingKids?: Kid[];

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

function uniqueKidsPreserveOrder(kids: Kid[]) {
  const seen = new Set<string>();
  const out: Kid[] = [];
  for (const k of kids) {
    const key = k.key.trim().toLowerCase();
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(k);
  }
  return out;
}

function safeSnippet(s: string, max = 400) {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

// pairings helper functions
function shuffle(names: string[]) {
  const arr = [...names];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function chunk(names: string[], groupSize: number) {
  const out: string[][] = [];
  for (let i = 0; i < names.length; i += groupSize) {
    out.push(names.slice(i, i + groupSize));
  }
  return out;
}

function cleanName(n: string) {
  return n.replace(/\s+/g, " ").trim();
}

// ✅ display helpers (only show family hint when name collides)
function baseNameFromLabel(label: string) {
  // "Jack (Smith)" -> "Jack"
  const idx = label.indexOf(" (");
  return (idx >= 0 ? label.slice(0, idx) : label).trim();
}

function computeDisplayLabelMap(kids: Kid[]) {
  // count base-name collisions
  const counts = new Map<string, number>();
  for (const k of kids) {
    const base = baseNameFromLabel(k.label).toLowerCase();
    if (!base) continue;
    counts.set(base, (counts.get(base) ?? 0) + 1);
  }

  // if base-name appears once => show base only; else show full label
  const idToDisplay = new Map<string, string>();
  for (const k of kids) {
    const base = baseNameFromLabel(k.label);
    const c = counts.get(base.toLowerCase()) ?? 0;
    idToDisplay.set(k.key, c <= 1 ? base : k.label);
  }

  return { idToDisplay, counts };
}

function DraggableKidPill({
  id,
  label,
  disabled,
}: {
  id: string;
  label: string;
  disabled: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id, disabled });

  const style: React.CSSProperties = {
    padding: "4px 8px",
    borderRadius: 999,
    border: "1px solid #2a2a33",
    background: "#0f0f16",
    color: "#eaeaf0",
    cursor: disabled ? "not-allowed" : "grab",
    opacity: disabled ? 0.6 : 1,
    boxShadow: isDragging ? "0 6px 18px rgba(0,0,0,0.12)" : undefined,
    transform: CSS.Transform.toString(transform),
    transition,
    userSelect: "none",
    touchAction: "none",
    display: "inline-flex",
    marginRight: 8,
    marginBottom: 8,
  };

  return (
    <span ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {label}
    </span>
  );
}

export default function HeadcountBoard() {
  const [sessions, setSessions] = useState<ClinicSession[]>([]);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string>("");

  const [linkBusyId, setLinkBusyId] = useState<string | null>(null);
  const [copiedSessionId, setCopiedSessionId] = useState<string | null>(null);

  // Step 6 UI state (close/reopen)
  const [closeBusyId, setCloseBusyId] = useState<string | null>(null);

  // ✅ toggle showing names per session
  const [openNamesForId, setOpenNamesForId] = useState<Record<string, boolean>>(
    {}
  );

  // For session pairings
  // NOTE: each string is a Kid.key (ex: "SMITH12:jack"), NOT display label
  const [pairingsBySessionId, setPairingsBySessionId] = useState<
    Record<string, string[][]>
  >({});

  // finalized pairing state
  const [finalizedBySessionId, setFinalizedSessionId] = useState<
    Record<string, boolean>
  >({});

  // drag n drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 150, // press-and-hold a moment
        tolerance: 8, // allow slight finger movement
      },
    })
  );

  const load = async () => {
    setError("");

    try {
      const res = await fetch("/api/sessions", { cache: "no-store" });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(
          `Failed to load sessions (${res.status}). ${safeSnippet(text)}`
        );
      }

      const raw = await res.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        throw new Error(
          `Failed to parse /api/sessions as JSON. ${safeSnippet(raw)}`
        );
      }

      if (
        parsed &&
        typeof parsed === "object" &&
        "error" in parsed &&
        typeof (parsed as any).error === "string"
      ) {
        throw new Error((parsed as any).error);
      }

      if (!Array.isArray(parsed)) {
        throw new Error(`Unexpected /api/sessions response shape.`);
      }

      setSessions(parsed as ClinicSession[]);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load sessions");
      setSessions([]); // keep UI stable
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        throw new Error((msg as any)?.error || `Failed to generate link`);
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
        throw new Error((msg as any)?.error || "Failed to close link");
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
        throw new Error((msg as any)?.error || "Failed to reopen link");
      }
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Failed to reopen link");
    } finally {
      setCloseBusyId(null);
    }
  };

  // fallback key if API didn't send kid keys (dev safety)
  function normFallbackKey(name: string) {
    return `name:${cleanName(name).toLowerCase()}`;
  }

  // Pairings Handlers
  const generatePairings = (sessionId: string, groupSize = 4) => {
    const s = sessions.find((x) => x.id === sessionId);
    if (!s) return;

    // Prefer new keyed kids. Fallback to old names for safety.
    const yesKidsRaw: Kid[] =
      s.attendingKids && Array.isArray(s.attendingKids)
        ? s.attendingKids
        : uniquePreserveOrder((s.attendingKidNames ?? []).map(cleanName))
            .filter(Boolean)
            .map((name) => ({ key: normFallbackKey(name), label: name }));

    const yesKids = uniqueKidsPreserveOrder(yesKidsRaw);
    const kidIds = yesKids.map((k) => k.key);

    if (kidIds.length < 2) {
      setPairingsBySessionId((prev) => ({ ...prev, [sessionId]: [] }));
      return;
    }

    const shuffled = shuffle(kidIds);
    const courts = chunk(shuffled, groupSize);

    setPairingsBySessionId((prev) => ({ ...prev, [sessionId]: courts }));
  };

  const clearPairings = (sessionId: string) => {
    setPairingsBySessionId((prev) => {
      const copy = { ...prev };
      delete copy[sessionId];
      return copy;
    });
  };

  // pin helper functions
  const COACH_PIN = "1234"; // TEMP PIN
  const requirePin = () => (window.prompt("Enter coach PIN:") ?? "").trim();

  // pin handlers
  const finalizeSession = (sessionId: string) => {
    const pin = requirePin();
    if (pin !== COACH_PIN) return alert("WRONG PIN");
    setFinalizedSessionId((prev) => ({ ...prev, [sessionId]: true }));
  };

  const unlockSession = (sessionId: string) => {
    const pin = requirePin();
    if (pin !== COACH_PIN) return alert("WRONG PIN");
    setFinalizedSessionId((prev) => ({ ...prev, [sessionId]: false }));
  };

  // drag n drop functions
  function courtId(sessionId: string, courtIndex: number) {
    return `court:${sessionId}:${courtIndex}`;
  }

  function parseCourtId(id: string) {
    // "court:SESSION:INDEX"
    const [prefix, sessionId, idx] = id.split(":");
    if (prefix !== "court") return null;
    const courtIndex = Number(idx);
    if (!sessionId || Number.isNaN(courtIndex)) return null;
    return { sessionId, courtIndex };
  }

  function findCourtForKid(pairings: string[][], kidId: string) {
    for (let i = 0; i < pairings.length; i++) {
      if (pairings[i]?.includes(kidId)) return i;
    }
    return -1;
  }

  const handleDragOver = (sessionId: string) => (e: DragOverEvent) => {
    const activeId = String(e.active.id);
    const overId = e.over?.id ? String(e.over.id) : null;
    if (!overId) return;

    setPairingsBySessionId((prev) => {
      const current = prev[sessionId];
      if (!current || current.length === 0) return prev;

      const fromCourt = findCourtForKid(current, activeId);
      if (fromCourt < 0) return prev;

      const overCourtParsed = parseCourtId(overId);

      let toCourt = -1;
      if (overCourtParsed?.sessionId === sessionId) {
        toCourt = overCourtParsed.courtIndex;
      } else {
        toCourt = findCourtForKid(current, overId);
      }

      if (toCourt < 0 || toCourt === fromCourt) return prev;

      const next = current.map((c) => [...c]);
      next[fromCourt] = next[fromCourt].filter((n) => n !== activeId);
      next[toCourt].push(activeId);

      return { ...prev, [sessionId]: next };
    });
  };

  const handleDragEnd = (sessionId: string) => (e: DragEndEvent) => {
    const activeId = String(e.active.id);
    const overId = e.over?.id ? String(e.over.id) : null;
    if (!overId) return;

    const overCourtParsed = parseCourtId(overId);
    if (overCourtParsed?.sessionId === sessionId) return;

    setPairingsBySessionId((prev) => {
      const current = prev[sessionId];
      if (!current || current.length === 0) return prev;

      const courtIdx = findCourtForKid(current, activeId);
      if (courtIdx < 0) return prev;

      const overIdx = current[courtIdx].indexOf(overId);
      const activeIdx = current[courtIdx].indexOf(activeId);
      if (activeIdx === -1 || overIdx === -1 || activeIdx === overIdx)
        return prev;

      const next = current.map((c) => [...c]);
      next[courtIdx] = arrayMove(next[courtIdx], activeIdx, overIdx);

      return { ...prev, [sessionId]: next };
    });
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

    pillBtn: (
      variant: "primary" | "neutral" | "danger" | "success",
      disabled: boolean
    ) =>
      ({
        padding: "6px 10px",
        borderRadius: 10,
        border: "1px solid #2a2a33",
        background:
          variant === "success"
            ? "#22c55e"
            : variant === "primary"
            ? "#3b82f6"
            : variant === "danger"
            ? "#ef4444"
            : "transparent",
        color:
          variant === "success" ||
          variant === "primary" ||
          variant === "danger"
            ? "#0b0b0f"
            : "#d4d4db",
        fontWeight: 700,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
      }) as React.CSSProperties,
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

                const yesKidsObj = uniqueKidsPreserveOrder(s.attendingKids ?? []);
                const noKidsObj = uniqueKidsPreserveOrder(s.notAttendingKids ?? []);

                // ✅ build display labels: show family hint only when duplicates exist
                const { idToDisplay: yesIdToDisplay } =
                  computeDisplayLabelMap(yesKidsObj);
                const { idToDisplay: noIdToDisplay } =
                  computeDisplayLabelMap(noKidsObj);

                const yesNames = yesKidsObj.map(
                  (k) => yesIdToDisplay.get(k.key) ?? k.label
                );
                const noNames = noKidsObj.map(
                  (k) => noIdToDisplay.get(k.key) ?? k.label
                );

                // ✅ this is what DnD pills use (ID -> visible text)
                const kidLabelById = yesIdToDisplay;

                const pairings = pairingsBySessionId[s.id];
                const isFinal = !!finalizedBySessionId[s.id];

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
                    <div
                      style={{ display: "flex", justifyContent: "space-between" }}
                    >
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
                          {s.attendingCount ?? 0} Yes /{" "}
                          {s.notAttendingCount ?? 0} No
                        </strong>
                      </span>

                      <span>
                        RSVP kids:{" "}
                        <strong style={{ color: "#eaeaf0" }}>
                          {yesKids} Yes / {noKids} No
                        </strong>
                      </span>

                      <button
                        type="button"
                        onClick={toggleNames}
                        style={styles.namesBtn}
                      >
                        {isNamesOpen ? "Hide names" : "Show names"}
                      </button>

                      <span
                        style={{ marginLeft: "auto", display: "flex", gap: 8 }}
                      >
                        {!hasLink ? (
                          <button
                            type="button"
                            onClick={() => generateLink(s.id)}
                            disabled={linkBusyId === s.id}
                            style={styles.linkBtn(linkBusyId === s.id)}
                          >
                            {linkBusyId === s.id
                              ? "Generating..."
                              : "Generate Link"}
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
                            <span style={styles.linkChip}>
                              /r/{s.responseLink!.token}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                copyLink(s.responseLink!.token, s.id)
                              }
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

                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        marginTop: 10,
                        flexWrap: "wrap",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => generatePairings(s.id)}
                        disabled={isFinal || yesNames.length < 2}
                        style={styles.pillBtn(
                          "success",
                          isFinal || yesNames.length < 2
                        )}
                      >
                        Generate Pairings
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (
                            window.confirm(
                              "Clear all pairings for this session?"
                            )
                          )
                            clearPairings(s.id);
                        }}
                        disabled={isFinal || !pairings}
                        style={styles.pillBtn("neutral", isFinal || !pairings)}
                      >
                        Clear Pairings
                      </button>

                      <button
                        type="button"
                        onClick={() => finalizeSession(s.id)}
                        disabled={isFinal || !pairings || pairings.length === 0}
                        style={styles.pillBtn(
                          "neutral",
                          isFinal || !pairings || pairings.length === 0
                        )}
                      >
                        {isFinal ? "Finalized ✓" : "Finalize"}
                      </button>

                      <button
                        type="button"
                        onClick={() => unlockSession(s.id)}
                        disabled={!isFinal}
                        style={styles.pillBtn("danger", !isFinal)}
                      >
                        Unlock
                      </button>

                      {yesNames.length < 2 ? (
                        <span style={styles.subText}>Not enough kids to pair</span>
                      ) : null}
                    </div>

                    {pairings ? (
                      pairings.length ? (
                        <DndContext
                          sensors={sensors}
                          collisionDetection={closestCenter}
                          onDragOver={isFinal ? undefined : handleDragOver(s.id)}
                          onDragEnd={isFinal ? undefined : handleDragEnd(s.id)}
                        >
                          <div style={{ marginTop: 12 }}>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                marginBottom: 10,
                                padding: "8px 10px",
                                borderRadius: 12,
                                border: "1px solid #2a2a33",
                                background: isFinal ? "#0b1220" : "#0b0b0f",
                              }}
                            >
                              <div
                                style={{
                                  fontWeight: 900,
                                  fontSize: 13,
                                  letterSpacing: 0.3,
                                }}
                              >
                                Court Assignments
                              </div>

                              {isFinal ? (
                                <span
                                  style={{
                                    fontSize: 12,
                                    padding: "4px 8px",
                                    borderRadius: 999,
                                    border: "1px solid #2a2a33",
                                    background: "#0b0b0f",
                                    color: "#d4d4db",
                                    fontWeight: 800,
                                  }}
                                >
                                  🔒 Finalized
                                </span>
                              ) : null}
                            </div>

                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns:
                                  "repeat(auto-fit, minmax(240px, 1fr))",
                                gap: 10,
                                opacity: isFinal ? 0.92 : 1,
                                filter: isFinal ? "saturate(0.95)" : undefined,
                                transition: "opacity 160ms ease",
                              }}
                            >
                              {pairings.map((court, idx) => {
                                const cId = courtId(s.id, idx);

                                return (
                                  <div
                                    key={cId}
                                    id={cId}
                                    style={{
                                      border: "1px solid #2a2a33",
                                      borderRadius: 14,
                                      padding: 12,
                                      background: "#0b0b0f",
                                    }}
                                  >
                                    <div
                                      style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        marginBottom: 10,
                                      }}
                                    >
                                      <div
                                        style={{
                                          fontSize: 13,
                                          fontWeight: 800,
                                        }}
                                      >
                                        Court {idx + 1}
                                      </div>
                                      <div
                                        style={{
                                          fontSize: 12,
                                          color: "#a1a1aa",
                                        }}
                                      >
                                        {court.length} kid
                                        {court.length === 1 ? "" : "s"}
                                      </div>
                                    </div>

                                    <SortableContext
                                      items={court}
                                      strategy={verticalListSortingStrategy}
                                    >
                                      <div
                                        style={{
                                          display: "flex",
                                          gap: 8,
                                          flexWrap: "wrap",
                                        }}
                                      >
                                        {court.map((kidId) => (
                                          <DraggableKidPill
                                            key={kidId}
                                            id={kidId}
                                            label={kidLabelById.get(kidId) ?? kidId}
                                            disabled={isFinal}
                                          />
                                        ))}
                                      </div>
                                    </SortableContext>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </DndContext>
                      ) : (
                        <div style={{ marginTop: 10, ...styles.subText }}>
                          Not enough kids to pair
                        </div>
                      )
                    ) : null}

                    {isNamesOpen ? (
                      <div style={styles.namesPanel}>
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            marginBottom: 6,
                          }}
                        >
                          Attending ({yesNames.length})
                        </div>
                        {yesNames.length ? (
                          <div style={{ marginBottom: 10 }}>
                            {yesNames.map((n, idx) => (
                              <span key={`y-${idx}-${n}`} style={styles.namePill}>
                                {n}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <div
                            style={{
                              fontSize: 12,
                              color: "#a1a1aa",
                              marginBottom: 10,
                            }}
                          >
                            No names yet.
                          </div>
                        )}

                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            marginBottom: 6,
                          }}
                        >
                          Not attending ({noNames.length})
                        </div>
                        {noNames.length ? (
                          <div>
                            {noNames.map((n, idx) => (
                              <span key={`n-${idx}-${n}`} style={styles.namePill}>
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
                            updateLocal(s.id, {
                              makeUpCount: Number(e.target.value),
                            })
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






