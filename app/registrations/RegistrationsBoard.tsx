"use client";

import { useEffect, useMemo, useState } from "react";

type RegistrationLink = {
  token: string;
  closedAt: string | null;
  expiresAt: string | null;
};

type ClinicSeries = {
  id: string;
  name: string;
  programType: string;
  level: string | null;
  startDate: string;
  endDate: string;
  registrationOpen: boolean;
  registrationLink: RegistrationLink | null;
  _count: {
    sessions: number;
    registrations: number;
  };
};

type SeriesDraft = {
  name: string;
  programType: string;
  level: string;
  startDate: string;
  endDate: string;
  registrationOpen: boolean;
};

const emptyDraft: SeriesDraft = {
  name: "",
  programType: "JUNIORS",
  level: "",
  startDate: "",
  endDate: "",
  registrationOpen: false,
};

function displayProgram(series: ClinicSeries) {
  if (series.programType === "RED_BALL") {
    return "Red Ball";
  }

  if (series.programType === "JUNIORS" && series.level) {
    return `Juniors Level ${series.level}`;
  }

  return series.programType;
}

export default function RegistrationsBoard() {
  const [series, setSeries] = useState<ClinicSeries[]>([]);
  const [draft, setDraft] = useState<SeriesDraft>(emptyDraft);

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<SeriesDraft | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadSeries = async () => {
    setError("");

    try {
      const response = await fetch("/api/series", {
        cache: "no-store",
      });

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          result?.error || `Failed to load series (${response.status})`,
        );
      }

      if (!Array.isArray(result)) {
        throw new Error("Unexpected series response.");
      }

      setSeries(result);
    } catch (caughtError: any) {
      setError(caughtError?.message ?? "Failed to load series");
      setSeries([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSeries();
  }, []);

  const totalRegistrations = useMemo(
    () =>
      series.reduce(
        (total, item) => total + item._count.registrations,
        0,
      ),
    [series],
  );

  const updateDraft = (
    field: keyof SeriesDraft,
    value: string | boolean,
  ) => {
    setDraft((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const updateEditDraft = (
    field: keyof SeriesDraft,
    value: string | boolean,
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

  const createSeries = async (event: React.FormEvent) => {
    event.preventDefault();

    setError("");
    setCreating(true);

    try {
      const response = await fetch("/api/series", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: draft.name,
          programType: draft.programType,
          level: draft.level,
          startDate: draft.startDate,
          endDate: draft.endDate,
          registrationOpen: draft.registrationOpen,
        }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          result?.error || `Failed to create series (${response.status})`,
        );
      }

      setDraft(emptyDraft);
      await loadSeries();
    } catch (caughtError: any) {
      setError(caughtError?.message ?? "Failed to create series");
    } finally {
      setCreating(false);
    }
  };

  const startEditing = (item: ClinicSeries) => {
    setEditingId(item.id);
    setEditDraft({
      name: item.name,
      programType: item.programType,
      level: item.level ?? "",
      startDate: item.startDate,
      endDate: item.endDate,
      registrationOpen: item.registrationOpen,
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditDraft(null);
  };

  const saveSeries = async (id: string) => {
    if (!editDraft) {
      return;
    }

    setError("");
    setSavingId(id);

    try {
      const response = await fetch(`/api/series/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(editDraft),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          result?.error || `Failed to update series (${response.status})`,
        );
      }

      cancelEditing();
      await loadSeries();
    } catch (caughtError: any) {
      setError(caughtError?.message ?? "Failed to update series");
    } finally {
      setSavingId(null);
    }
  };

  const deleteSeries = async (item: ClinicSeries) => {
    const confirmed = window.confirm(
      `Delete "${item.name}"?`,
    );

    if (!confirmed) {
      return;
    }

    setError("");
    setDeletingId(item.id);

    try {
      const response = await fetch(`/api/series/${item.id}`, {
        method: "DELETE",
      });

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          result?.error || `Failed to delete series (${response.status})`,
        );
      }

      await loadSeries();
    } catch (caughtError: any) {
      setError(caughtError?.message ?? "Failed to delete series");
    } finally {
      setDeletingId(null);
    }
  };

  const styles = {
    summaryGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
      gap: 12,
      marginBottom: 18,
    } as React.CSSProperties,

    summaryCard: {
      border: "1px solid #2a2a33",
      borderRadius: 14,
      padding: 16,
      background: "#0f0f16",
    } as React.CSSProperties,

    summaryLabel: {
      fontSize: 12,
      color: "#a1a1aa",
      marginBottom: 6,
    } as React.CSSProperties,

    summaryValue: {
      fontSize: 28,
      fontWeight: 800,
    } as React.CSSProperties,

    panel: {
      border: "1px solid #2a2a33",
      borderRadius: 14,
      padding: 18,
      background: "#0f0f16",
      marginBottom: 18,
    } as React.CSSProperties,

    grid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
      gap: 12,
    } as React.CSSProperties,

    field: {
      display: "grid",
      gap: 6,
      fontSize: 12,
      color: "#d4d4db",
    } as React.CSSProperties,

    input: {
      width: "100%",
      boxSizing: "border-box",
      background: "#0b0b0f",
      color: "#eaeaf0",
      border: "1px solid #2a2a33",
      borderRadius: 10,
      padding: "8px 10px",
      outline: "none",
    } as React.CSSProperties,

    checkboxLabel: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      color: "#d4d4db",
      fontSize: 14,
      marginTop: 12,
    } as React.CSSProperties,

    primaryButton: {
      marginTop: 14,
      padding: "9px 14px",
      borderRadius: 10,
      border: "none",
      background: "#22c55e",
      color: "#0b0b0f",
      fontWeight: 800,
      cursor: creating ? "not-allowed" : "pointer",
      opacity: creating ? 0.6 : 1,
    } as React.CSSProperties,

    errorBox: {
      marginBottom: 16,
      color: "#fecaca",
      background: "#2a0f12",
      border: "1px solid #7f1d1d",
      padding: "10px 12px",
      borderRadius: 12,
    } as React.CSSProperties,

    seriesList: {
      display: "grid",
      gap: 12,
    } as React.CSSProperties,

    seriesCard: {
      border: "1px solid #2a2a33",
      borderRadius: 14,
      padding: 16,
      background: "#0b0b0f",
    } as React.CSSProperties,

    cardHeader: {
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 12,
      flexWrap: "wrap",
    } as React.CSSProperties,

    cardMeta: {
      color: "#a1a1aa",
      marginTop: 4,
    } as React.CSSProperties,

    badges: {
      display: "flex",
      gap: 8,
      flexWrap: "wrap",
      marginTop: 12,
    } as React.CSSProperties,

    badge: {
      padding: "4px 8px",
      borderRadius: 999,
      border: "1px solid #2a2a33",
      color: "#d4d4db",
      fontSize: 12,
    } as React.CSSProperties,

    actions: {
      display: "flex",
      gap: 8,
      flexWrap: "wrap",
      marginTop: 14,
    } as React.CSSProperties,

    button: (
      variant: "neutral" | "primary" | "danger" | "success",
      disabled = false,
    ) =>
      ({
        padding: "7px 11px",
        borderRadius: 10,
        border:
          variant === "danger"
            ? "1px solid #ef4444"
            : variant === "success"
              ? "1px solid #22c55e"
              : variant === "primary"
                ? "1px solid #3b82f6"
                : "1px solid #2a2a33",
        background:
          variant === "danger"
            ? "#ef4444"
            : variant === "success"
              ? "#22c55e"
              : variant === "primary"
                ? "#3b82f6"
                : "transparent",
        color:
          variant === "neutral"
            ? "#d4d4db"
            : "#0b0b0f",
        fontWeight: 700,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
      }) as React.CSSProperties,
  };

  return (
    <>
      <div style={styles.summaryGrid}>
        <div style={styles.summaryCard}>
          <div style={styles.summaryLabel}>Clinic series</div>
          <div style={styles.summaryValue}>{series.length}</div>
        </div>

        <div style={styles.summaryCard}>
          <div style={styles.summaryLabel}>Total registrations</div>
          <div style={styles.summaryValue}>{totalRegistrations}</div>
        </div>
      </div>

      {error ? (
        <div style={styles.errorBox}>
          <strong>Error:</strong> {error}
        </div>
      ) : null}

      <section style={styles.panel}>
        <h2 style={{ marginTop: 0 }}>Create clinic series</h2>

        <form onSubmit={createSeries}>
          <div style={styles.grid}>
            <label style={styles.field}>
              Series name
              <input
                type="text"
                value={draft.name}
                onChange={(event) =>
                  updateDraft("name", event.target.value)
                }
                placeholder="Summer 2026 Juniors"
                style={styles.input}
              />
            </label>

            <label style={styles.field}>
              Program
              <select
                value={draft.programType}
                onChange={(event) =>
                  updateDraft("programType", event.target.value)
                }
                style={styles.input}
              >
                <option value="JUNIORS">Juniors</option>
                <option value="RED_BALL">Red Ball</option>
              </select>
            </label>

            <label style={styles.field}>
              Level
              <input
                type="text"
                value={draft.level}
                onChange={(event) =>
                  updateDraft("level", event.target.value)
                }
                placeholder="Example: 3/4"
                style={styles.input}
              />
            </label>

            <label style={styles.field}>
              Start date
              <input
                type="date"
                value={draft.startDate}
                onChange={(event) =>
                  updateDraft("startDate", event.target.value)
                }
                style={styles.input}
              />
            </label>

            <label style={styles.field}>
              End date
              <input
                type="date"
                value={draft.endDate}
                onChange={(event) =>
                  updateDraft("endDate", event.target.value)
                }
                style={styles.input}
              />
            </label>
          </div>

          <label style={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={draft.registrationOpen}
              onChange={(event) =>
                updateDraft(
                  "registrationOpen",
                  event.target.checked,
                )
              }
            />
            Registration is open
          </label>

          <button
            type="submit"
            disabled={creating}
            style={styles.primaryButton}
          >
            {creating ? "Creating..." : "Create series"}
          </button>
        </form>
      </section>

      <section style={styles.panel}>
        <h2 style={{ marginTop: 0 }}>Existing clinic series</h2>

        {loading ? (
          <p style={{ color: "#a1a1aa" }}>Loading...</p>
        ) : series.length === 0 ? (
          <p style={{ color: "#a1a1aa" }}>
            No clinic series have been created yet.
          </p>
        ) : (
          <div style={styles.seriesList}>
            {series.map((item) => {
              const isEditing =
                editingId === item.id && editDraft;

              return (
                <div key={item.id} style={styles.seriesCard}>
                  {isEditing ? (
                    <>
                      <div style={styles.grid}>
                        <label style={styles.field}>
                          Series name
                          <input
                            type="text"
                            value={editDraft.name}
                            onChange={(event) =>
                              updateEditDraft(
                                "name",
                                event.target.value,
                              )
                            }
                            style={styles.input}
                          />
                        </label>

                        <label style={styles.field}>
                          Program
                          <select
                            value={editDraft.programType}
                            onChange={(event) =>
                              updateEditDraft(
                                "programType",
                                event.target.value,
                              )
                            }
                            style={styles.input}
                          >
                            <option value="JUNIORS">Juniors</option>
                            <option value="RED_BALL">Red Ball</option>
                          </select>
                        </label>

                        <label style={styles.field}>
                          Level
                          <input
                            type="text"
                            value={editDraft.level}
                            onChange={(event) =>
                              updateEditDraft(
                                "level",
                                event.target.value,
                              )
                            }
                            style={styles.input}
                          />
                        </label>

                        <label style={styles.field}>
                          Start date
                          <input
                            type="date"
                            value={editDraft.startDate}
                            onChange={(event) =>
                              updateEditDraft(
                                "startDate",
                                event.target.value,
                              )
                            }
                            style={styles.input}
                          />
                        </label>

                        <label style={styles.field}>
                          End date
                          <input
                            type="date"
                            value={editDraft.endDate}
                            onChange={(event) =>
                              updateEditDraft(
                                "endDate",
                                event.target.value,
                              )
                            }
                            style={styles.input}
                          />
                        </label>
                      </div>

                      <label style={styles.checkboxLabel}>
                        <input
                          type="checkbox"
                          checked={editDraft.registrationOpen}
                          onChange={(event) =>
                            updateEditDraft(
                              "registrationOpen",
                              event.target.checked,
                            )
                          }
                        />
                        Registration is open
                      </label>

                      <div style={styles.actions}>
                        <button
                          type="button"
                          onClick={cancelEditing}
                          disabled={savingId === item.id}
                          style={styles.button(
                            "neutral",
                            savingId === item.id,
                          )}
                        >
                          Cancel
                        </button>

                        <button
                          type="button"
                          onClick={() => saveSeries(item.id)}
                          disabled={savingId === item.id}
                          style={styles.button(
                            "success",
                            savingId === item.id,
                          )}
                        >
                          {savingId === item.id
                            ? "Saving..."
                            : "Save changes"}
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={styles.cardHeader}>
                        <div>
                          <strong style={{ fontSize: 18 }}>
                            {item.name}
                          </strong>

                          <div style={styles.cardMeta}>
                            {displayProgram(item)}
                          </div>

                          <div style={styles.cardMeta}>
                            {item.startDate} through {item.endDate}
                          </div>
                        </div>

                        <span
                          style={{
                            ...styles.badge,
                            color: item.registrationOpen
                              ? "#4ade80"
                              : "#f87171",
                          }}
                        >
                          {item.registrationOpen
                            ? "Registration open"
                            : "Registration closed"}
                        </span>
                      </div>

                      <div style={styles.badges}>
                        <span style={styles.badge}>
                          {item._count.sessions} sessions
                        </span>

                        <span style={styles.badge}>
                          {item._count.registrations} registrations
                        </span>

                        <span style={styles.badge}>
                          {item.registrationLink
                            ? "Registration link created"
                            : "No registration link"}
                        </span>
                      </div>

                      <div style={styles.actions}>
                        <button
                          type="button"
                          onClick={() => startEditing(item)}
                          disabled={deletingId === item.id}
                          style={styles.button(
                            "primary",
                            deletingId === item.id,
                          )}
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          onClick={() => deleteSeries(item)}
                          disabled={deletingId === item.id}
                          style={styles.button(
                            "danger",
                            deletingId === item.id,
                          )}
                        >
                          {deletingId === item.id
                            ? "Deleting..."
                            : "Delete"}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}