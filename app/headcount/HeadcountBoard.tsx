"use client";

import Link from "next/link";
import SessionGenerator from "./SessionGenerator";
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
  level: string | null;
  capacity: number;
  fullSessionCount: number;
  makeUpCount: number;
  singleDateCount: number;

  // Step 4 + Step 6
  responseLink?: { token: string; closedAt?: string | null } | null;

  // Step 5: response totals (number of submissions)
  attendingCount?: number;
  notAttendingCount?: number;

  // kid-based totals + names
  attendingKidsCount?: number;
  notAttendingKidsCount?: number;
  attendingKidNames?: string[];
  notAttendingKidNames?: string[];

  // key+label kids (from /api/sessions)
  attendingKids?: Kid[];
  notAttendingKids?: Kid[];

  lastResponseAt?: string | null;
};

type SessionEditDraft = {
  date: string;
  startTime: string;
  endTime: string;
  programType: string;
  level: string;
  capacity: string;
};

function expected(s: ClinicSession) {
  return s.fullSessionCount + s.makeUpCount + s.singleDateCount;
}

function displayName(s: ClinicSession) {
  if (s.programType === "RED_BALL") return "Red Ball";
  if (s.programType === "JUNIORS" && s.level) return `Level ${s.level}`;
  return s.programType;
}

function formatTimeRange(startTime: string, endTime: string) {
  const formatTime = (time: string) => {
    const [hourText, minute = "00"] = time.split(":");
    const hour24 = Number(hourText);
    const hour12 = hour24 % 12 || 12;
    const period = hour24 >= 12 ? "PM" : "AM";

    return {
      time: `${hour12}:${minute}`,
      period,
    };
  };

  const start = formatTime(startTime);
  const end = formatTime(endTime);

  return start.period === end.period
    ? `${start.time}–${end.time} ${end.period}`
    : `${start.time} ${start.period}–${end.time} ${end.period}`;
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

// display helpers
function baseNameFromLabel(label: string) {
  const idx = label.indexOf(" (");
  return (idx >= 0 ? label.slice(0, idx) : label).trim();
}

function computeDisplayLabelMap(kids: Kid[]) {
  const counts = new Map<string, number>();

  for (const k of kids) {
    const base = baseNameFromLabel(k.label).toLowerCase();

    if (!base) continue;

    counts.set(base, (counts.get(base) ?? 0) + 1);
  }

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
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });

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

  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<SessionEditDraft | null>(null);
  const [editBusyId, setEditBusyId] = useState<string | null>(null);
  const [deleteBusyId, setDeleteBusyId] = useState<string | null>(null);

  const [linkBusyId, setLinkBusyId] = useState<string | null>(null);
  const [copiedSessionId, setCopiedSessionId] = useState<string | null>(null);

  // logout state
  const [logoutBusy, setLogoutBusy] = useState(false);

  // Step 6 UI state (close/reopen)
  const [closeBusyId, setCloseBusyId] = useState<string | null>(null);

  // toggle showing names per session
  const [openNamesForId, setOpenNamesForId] = useState<Record<string, boolean>>(
    {}
  );

  // For session pairings
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
        delay: 150,
        tolerance: 8,
      },
    })
  );

  const logout = async () => {
    setError("");
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
    } catch (e: any) {
      setError(e?.message ?? "Logout failed");
      setLogoutBusy(false);
    }
  };

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
        throw new Error("Unexpected /api/sessions response shape.");
      }

      setSessions(parsed as ClinicSession[]);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load sessions");
      setSessions([]);
    }
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


  const startEditing = (session: ClinicSession) => {
    setError("");
    setEditingSessionId(session.id);
    setEditDraft({
      date: session.date,
      startTime: session.startTime,
      endTime: session.endTime,
      programType: session.programType,
      level: session.level ?? "",
      capacity: String(session.capacity),
    });
  };

  const cancelEditing = () => {
    setEditingSessionId(null);
    setEditDraft(null);
  };

  const updateEditDraft = (
    field: keyof SessionEditDraft,
    value: string,
  ) => {
    setEditDraft((current) =>
      current
        ? {
            ...current,
            [field]: value,
          }
        : current,
    );
  };

  const saveSessionEdits = async (sessionId: string) => {
    if (!editDraft) return;

    setError("");
    setEditBusyId(sessionId);

    try {
      const res = await fetch(`/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          date: editDraft.date,
          startTime: editDraft.startTime,
          endTime: editDraft.endTime,
          programType: editDraft.programType,
          level: editDraft.level.trim() || null,
          capacity: Number(editDraft.capacity),
        }),
      });

      const result = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(
          result?.error || `Failed to update session (${res.status})`,
        );
      }

      cancelEditing();
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Failed to update session");
    } finally {
      setEditBusyId(null);
    }
  };

  const requestDeleteSession = async (
    session: ClinicSession,
    force = false,
  ) => {
    if (!force) {
      const firstConfirmation = window.confirm(
        `Delete ${displayName(session)} on ${session.date} at ${session.startTime}?`,
      );

      if (!firstConfirmation) return;
    }

    setError("");
    setDeleteBusyId(session.id);

    try {
      const query = force ? "?force=true" : "";

      const res = await fetch(`/api/sessions/${session.id}${query}`, {
        method: "DELETE",
      });

      const result = await res.json().catch(() => null);

      if (
        res.status === 409 &&
        result?.requiresConfirmation
      ) {
        const attendanceCount = Number(result.attendanceCount ?? 0);
        const responseCount = Number(result.responseCount ?? 0);

        const forceConfirmed = window.confirm(
          `This session has ${attendanceCount} attendance record(s) and ${responseCount} family response(s). Deleting it will permanently remove that data. Delete anyway?`,
        );

        if (!forceConfirmed) return;

        await requestDeleteSession(session, true);
        return;
      }

      if (!res.ok) {
        throw new Error(
          result?.error || `Failed to delete session (${res.status})`,
        );
      }

      if (editingSessionId === session.id) {
        cancelEditing();
      }

      await load();
    } catch (e: any) {
      setError(e?.message ?? "Failed to delete session");
    } finally {
      setDeleteBusyId(null);
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
        throw new Error((msg as any)?.error || "Failed to generate link");
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

    setSessions((prev) =>
      prev.map((s) => (s.id === sessionId ? { ...s, responseLink: null } : s))
    );
  };

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

  function normFallbackKey(name: string) {
    return `name:${cleanName(name).toLowerCase()}`;
  }

  const generatePairings = (sessionId: string, groupSize = 4) => {
    const s = sessions.find((x) => x.id === sessionId);

    if (!s) return;

    const yesKidsRaw: Kid[] =
      s.attendingKids && Array.isArray(s.attendingKids)
        ? s.attendingKids
        : uniquePreserveOrder((s.attendingKidNames ?? []).map(cleanName))
            .filter(Boolean)
            .map((name) => ({
              key: normFallbackKey(name),
              label: name,
            }));

    const yesKids = uniqueKidsPreserveOrder(yesKidsRaw);
    const kidIds = yesKids.map((k) => k.key);

    if (kidIds.length < 2) {
      setPairingsBySessionId((prev) => ({
        ...prev,
        [sessionId]: [],
      }));

      return;
    }

    const shuffled = shuffle(kidIds);
    const courts = chunk(shuffled, groupSize);

    setPairingsBySessionId((prev) => ({
      ...prev,
      [sessionId]: courts,
    }));
  };

  const clearPairings = (sessionId: string) => {
    setPairingsBySessionId((prev) => {
      const copy = { ...prev };
      delete copy[sessionId];
      return copy;
    });
  };

  const COACH_PIN = "1234";

  const requirePin = () => {
    return (window.prompt("Enter coach PIN:") ?? "").trim();
  };

  const finalizeSession = (sessionId: string) => {
    const pin = requirePin();

    if (pin !== COACH_PIN) {
      alert("WRONG PIN");
      return;
    }

    setFinalizedSessionId((prev) => ({
      ...prev,
      [sessionId]: true,
    }));
  };

  const unlockSession = (sessionId: string) => {
    const pin = requirePin();

    if (pin !== COACH_PIN) {
      alert("WRONG PIN");
      return;
    }

    setFinalizedSessionId((prev) => ({
      ...prev,
      [sessionId]: false,
    }));
  };

  function courtId(sessionId: string, courtIndex: number) {
    return `court:${sessionId}:${courtIndex}`;
  }

  function parseCourtId(id: string) {
    const [prefix, sessionId, idx] = id.split(":");

    if (prefix !== "court") return null;

    const courtIndex = Number(idx);

    if (!sessionId || Number.isNaN(courtIndex)) {
      return null;
    }

    return { sessionId, courtIndex };
  }

  function findCourtForKid(pairings: string[][], kidId: string) {
    for (let i = 0; i < pairings.length; i++) {
      if (pairings[i]?.includes(kidId)) {
        return i;
      }
    }

    return -1;
  }

  const handleDragOver = (sessionId: string) => (e: DragOverEvent) => {
    const activeId = String(e.active.id);
    const overId = e.over?.id ? String(e.over.id) : null;

    if (!overId) return;

    setPairingsBySessionId((prev) => {
      const current = prev[sessionId];

      if (!current || current.length === 0) {
        return prev;
      }

      const fromCourt = findCourtForKid(current, activeId);

      if (fromCourt < 0) {
        return prev;
      }

      const overCourtParsed = parseCourtId(overId);

      let toCourt = -1;

      if (overCourtParsed?.sessionId === sessionId) {
        toCourt = overCourtParsed.courtIndex;
      } else {
        toCourt = findCourtForKid(current, overId);
      }

      if (toCourt < 0 || toCourt === fromCourt) {
        return prev;
      }

      const next = current.map((c) => [...c]);

      next[fromCourt] = next[fromCourt].filter((n) => n !== activeId);
      next[toCourt].push(activeId);

      return {
        ...prev,
        [sessionId]: next,
      };
    });
  };

  const handleDragEnd = (sessionId: string) => (e: DragEndEvent) => {
    const activeId = String(e.active.id);
    const overId = e.over?.id ? String(e.over.id) : null;

    if (!overId) return;

    const overCourtParsed = parseCourtId(overId);

    if (overCourtParsed?.sessionId === sessionId) {
      return;
    }

    setPairingsBySessionId((prev) => {
      const current = prev[sessionId];

      if (!current || current.length === 0) {
        return prev;
      }

      const courtIdx = findCourtForKid(current, activeId);

      if (courtIdx < 0) {
        return prev;
      }

      const overIdx = current[courtIdx].indexOf(overId);
      const activeIdx = current[courtIdx].indexOf(activeId);

      if (activeIdx === -1 || overIdx === -1 || activeIdx === overIdx) {
        return prev;
      }

      const next = current.map((c) => [...c]);

      next[courtIdx] = arrayMove(
        next[courtIdx],
        activeIdx,
        overIdx
      );

      return {
        ...prev,
        [sessionId]: next,
      };
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

    subText: {
      color: "#a1a1aa",
    } as React.CSSProperties,

    topRow: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      marginBottom: 18,
    } as React.CSSProperties,

    topLeftActions: {
      display: "flex",
      gap: 8,
      alignItems: "center",
      flexWrap: "wrap",
    } as React.CSSProperties,

    refreshBtn: {
      padding: "6px 10px",
      borderRadius: 10,
      border: "1px solid #2a2a33",
      background: "transparent",
      color: "#d4d4db",
      cursor: "pointer",
      textDecoration: "none",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
    } as React.CSSProperties,

    navLinkBtn: {
      padding: "6px 10px",
      borderRadius: 10,
      border: "1px solid #2a2a33",
      background: "transparent",
      color: "#d4d4db",
      cursor: "pointer",
      textDecoration: "none",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
    } as React.CSSProperties,

    logoutBtn: {
      padding: "6px 10px",
      borderRadius: 10,
      border: "1px solid #ef4444",
      background: "transparent",
      color: "#f87171",
      cursor: logoutBusy ? "not-allowed" : "pointer",
      opacity: logoutBusy ? 0.6 : 1,
      textDecoration: "none",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
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

    label: {
      color: "#d4d4db",
    } as React.CSSProperties,

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

    editPanel: {
      marginTop: 12,
      padding: 14,
      borderRadius: 12,
      border: "1px solid #374151",
      background: "#0b0f14",
    } as React.CSSProperties,

    editGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
      gap: 12,
    } as React.CSSProperties,

    editField: {
      display: "grid",
      gap: 6,
      fontSize: 12,
      color: "#d4d4db",
    } as React.CSSProperties,

    editInput: {
      width: "100%",
      boxSizing: "border-box",
      background: "#0b0b0f",
      color: "#eaeaf0",
      border: "1px solid #2a2a33",
      borderRadius: 10,
      padding: "8px 10px",
      outline: "none",
    } as React.CSSProperties,

    sessionActions: {
      display: "flex",
      gap: 8,
      justifyContent: "flex-end",
      flexWrap: "wrap",
      marginTop: 10,
    } as React.CSSProperties,

    linkChip: {
      fontSize: 12,
      padding: "4px 8px",
      borderRadius: 10,
      border: "1px solid #2a2a33",
      background: "#0b0b0f",
      color: "#9ca3af",
    } as React.CSSProperties,

    linkBtn: (disabled: boolean, variant?: "copy") =>
      ({
        padding: "6px 10px",
        borderRadius: 10,
        border:
          variant === "copy"
            ? "1px solid #4ade80"
            : "1px solid #2a2a33",
        background: disabled ? "#14141c" : "#0b0b0f",
        color: disabled
          ? "#7c7c88"
          : variant === "copy"
            ? "#4ade80"
            : "#d4d4db",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
        transition: "all 0.15s ease",
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
      border: "1px solid #1f2937",
      borderRadius: 12,
      background: "#0b0f14",
      padding: 12,
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
      <h1 style={{ fontSize: 30, marginBottom: 8 }}>
        Clinic Headcount
      </h1>

      <div style={styles.topRow}>
        <div style={styles.topLeftActions}>
          <button
            type="button"
            onClick={load}
            style={styles.refreshBtn}
          >
            Refresh
          </button>

          <Link href="/history" style={styles.navLinkBtn}>
            History
          </Link>

          <Link href="/coach" style={styles.navLinkBtn}>
            Coach View
          </Link>
        </div>

        <button
          type="button"
          onClick={logout}
          disabled={logoutBusy}
          style={styles.logoutBtn}
        >
          {logoutBusy ? "Logging out..." : "Logout"}
        </button>
      </div>

      <SessionGenerator onSuccess={load} />

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
                const busy =
                  linkBusyId === s.id ||
                  closeBusyId === s.id;

                const yesKidsObj = uniqueKidsPreserveOrder(
                  s.attendingKids ?? []
                );

                const noKidsObj = uniqueKidsPreserveOrder(
                  s.notAttendingKids ?? []
                );

                const { idToDisplay: yesIdToDisplay } =
                  computeDisplayLabelMap(yesKidsObj);

                const { idToDisplay: noIdToDisplay } =
                  computeDisplayLabelMap(noKidsObj);

                const yesNames = yesKidsObj.map(
                  (k) =>
                    yesIdToDisplay.get(k.key) ??
                    k.label
                );

                const noNames = noKidsObj.map(
                  (k) =>
                    noIdToDisplay.get(k.key) ??
                    k.label
                );

                const yesKids =
                  s.attendingKidsCount ??
                  yesNames.length;

                const noKids =
                  s.notAttendingKidsCount ??
                  noNames.length;

                const isNamesOpen =
                  !!openNamesForId[s.id];

                const toggleNames = () =>
                  setOpenNamesForId((prev) => ({
                    ...prev,
                    [s.id]: !prev[s.id],
                  }));

                return (
                  <div key={s.id} style={styles.card}>
                    {editingSessionId === s.id && editDraft ? (
                      <div style={styles.editPanel}>
                        <div style={styles.editGrid}>
                          <label style={styles.editField}>
                            Date
                            <input
                              type="date"
                              value={editDraft.date}
                              onChange={(event) =>
                                updateEditDraft("date", event.target.value)
                              }
                              style={styles.editInput}
                            />
                          </label>

                          <label style={styles.editField}>
                            Start time
                            <input
                              type="time"
                              value={editDraft.startTime}
                              onChange={(event) =>
                                updateEditDraft(
                                  "startTime",
                                  event.target.value,
                                )
                              }
                              style={styles.editInput}
                            />
                          </label>

                          <label style={styles.editField}>
                            End time
                            <input
                              type="time"
                              value={editDraft.endTime}
                              onChange={(event) =>
                                updateEditDraft(
                                  "endTime",
                                  event.target.value,
                                )
                              }
                              style={styles.editInput}
                            />
                          </label>

                          <label style={styles.editField}>
                            Program
                            <select
                              value={editDraft.programType}
                              onChange={(event) =>
                                updateEditDraft(
                                  "programType",
                                  event.target.value,
                                )
                              }
                              style={styles.editInput}
                            >
                              <option value="JUNIORS">Juniors</option>
                              <option value="RED_BALL">Red Ball</option>
                            </select>
                          </label>

                          <label style={styles.editField}>
                            Level
                            <input
                              type="text"
                              value={editDraft.level}
                              onChange={(event) =>
                                updateEditDraft("level", event.target.value)
                              }
                              placeholder="Example: 3/4"
                              style={styles.editInput}
                            />
                          </label>

                          <label style={styles.editField}>
                            Capacity
                            <input
                              type="number"
                              min={1}
                              step={1}
                              value={editDraft.capacity}
                              onChange={(event) =>
                                updateEditDraft(
                                  "capacity",
                                  event.target.value,
                                )
                              }
                              style={styles.editInput}
                            />
                          </label>
                        </div>

                        <div style={styles.sessionActions}>
                          <button
                            type="button"
                            onClick={cancelEditing}
                            disabled={editBusyId === s.id}
                            style={styles.pillBtn(
                              "neutral",
                              editBusyId === s.id,
                            )}
                          >
                            Cancel
                          </button>

                          <button
                            type="button"
                            onClick={() => saveSessionEdits(s.id)}
                            disabled={editBusyId === s.id}
                            style={styles.pillBtn(
                              "success",
                              editBusyId === s.id,
                            )}
                          >
                            {editBusyId === s.id
                              ? "Saving..."
                              : "Save changes"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 12,
                            flexWrap: "wrap",
                          }}
                        >
                          <strong style={{ fontSize: 18 }}>
                            {displayName(s)}
                          </strong>

                          <span style={styles.subText}>
                            {formatTimeRange(s.startTime, s.endTime)}
                          </span>
                        </div>

                        <div style={styles.sessionActions}>
                          <button
                            type="button"
                            onClick={() => startEditing(s)}
                            disabled={deleteBusyId === s.id}
                            style={styles.pillBtn(
                              "primary",
                              deleteBusyId === s.id,
                            )}
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            onClick={() => requestDeleteSession(s)}
                            disabled={deleteBusyId === s.id}
                            style={styles.pillBtn(
                              "danger",
                              deleteBusyId === s.id,
                            )}
                          >
                            {deleteBusyId === s.id
                              ? "Deleting..."
                              : "Delete"}
                          </button>
                        </div>
                      </>
                    )}

                    <div
                      style={{
                        marginTop: 12,
                        padding: "14px 16px",
                        borderRadius: 12,
                        background: "#0b0f14",
                        border: "1px solid #1f2937",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 26,
                          fontWeight: 800,
                          color: "#4ade80",
                        }}
                      >
                        {yesKids} kids attending
                      </div>

                      <div
                        style={{
                          marginTop: 6,
                          marginBottom: 4,
                          color: "#9ca3af",
                        }}
                      >
                        Registered: {s.capacity}
                      </div>

                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginTop: 14,
                          flexWrap: "wrap",
                          gap: 10,
                        }}
                      >
                        <button
                          type="button"
                          onClick={toggleNames}
                          style={styles.namesBtn}
                        >
                          {isNamesOpen
                            ? "Hide names"
                            : "Show names"}
                        </button>

                        <span
                          style={{
                            display: "flex",
                            gap: 8,
                            flexWrap: "wrap",
                          }}
                        >
                          {!hasLink ? (
                            <button
                              type="button"
                              onClick={() =>
                                generateLink(s.id)
                              }
                              disabled={
                                linkBusyId === s.id
                              }
                              style={styles.linkBtn(
                                linkBusyId === s.id
                              )}
                            >
                              {linkBusyId === s.id
                                ? "Generating..."
                                : "Generate Link"}
                            </button>
                          ) : isClosed ? (
                            <>
                              <span style={styles.linkChip}>
                                Link closed
                              </span>

                              <button
                                type="button"
                                onClick={() =>
                                  reopenLink(s.id)
                                }
                                disabled={busy}
                                style={styles.linkBtn(busy)}
                              >
                                {closeBusyId === s.id
                                  ? "Reopening..."
                                  : "Reopen"}
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
                                  copyLink(
                                    s.responseLink!.token,
                                    s.id
                                  )
                                }
                                disabled={busy}
                                style={styles.linkBtn(
                                  busy,
                                  "copy"
                                )}
                              >
                                {copiedSessionId === s.id
                                  ? "Copied"
                                  : "Copy"}
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  closeLink(s.id)
                                }
                                disabled={busy}
                                style={styles.linkBtn(busy)}
                              >
                                {closeBusyId === s.id
                                  ? "Closing..."
                                  : "Close"}
                              </button>
                            </>
                          )}
                        </span>
                      </div>
                    </div>

                    {isNamesOpen ? (
                      <div style={styles.namesPanel}>
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            marginBottom: 6,
                            color: "#4ade80",
                          }}
                        >
                          Attending ({yesNames.length})
                        </div>

                        {yesNames.length ? (
                          <div style={{ marginBottom: 10 }}>
                            {yesNames.map((n, idx) => (
                              <span
                                key={`y-${idx}-${n}`}
                                style={styles.namePill}
                              >
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
                            fontWeight: 600,
                            color: "#a1a1aa",
                            marginBottom: 6,
                          }}
                        >
                          Not attending ({noNames.length})
                        </div>

                        {noNames.length ? (
                          <div>
                            {noNames.map((n, idx) => (
                              <span
                                key={`n-${idx}-${n}`}
                                style={styles.namePill}
                              >
                                {n}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <div
                            style={{
                              fontSize: 12,
                              color: "#a1a1aa",
                            }}
                          >
                            No names yet.
                          </div>
                        )}
                      </div>
                    ) : null}
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