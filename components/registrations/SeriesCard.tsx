import type {
    ClinicSeries,
    SeriesDraft,
  } from "@/lib/registration-types";
  
  type SeriesCardProps = {
    item: ClinicSeries;
    isEditing: boolean;
    editDraft: SeriesDraft | null;
    saving: boolean;
    deleting: boolean;
    onStartEditing: (item: ClinicSeries) => void;
    onCancelEditing: () => void;
    onEditDraftChange: (
      field: keyof SeriesDraft,
      value: string | boolean,
    ) => void;
    onSave: (id: string) => void;
    onDelete: (item: ClinicSeries) => void;
    onGenerateRegistrationLink: (seriesId: string) => void;
    onCloseRegistrationLink: (seriesId: string) => void;
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
  
  export default function SeriesCard({
    item,
    isEditing,
    editDraft,
    saving,
    deleting,
    onStartEditing,
    onCancelEditing,
    onEditDraftChange,
    onSave,
    onDelete,
    onGenerateRegistrationLink,
    onCloseRegistrationLink,
  }: SeriesCardProps) {
    const registrationLinkIsActive =
      item.registrationLink !== null &&
      item.registrationLink.closedAt === null;
  
    const copyRegistrationLink = async () => {
      if (!item.registrationLink) {
        return;
      }
  
      const registrationUrl = `${window.location.origin}/r/${item.registrationLink.token}`;
  
      try {
        await navigator.clipboard.writeText(registrationUrl);
        window.alert("Registration link copied.");
      } catch {
        window.prompt(
          "Copy this registration link:",
          registrationUrl,
        );
      }
    };
  
    const styles = {
      card: {
        border: "1px solid #2a2a33",
        borderRadius: 14,
        padding: 16,
        background: "#0b0b0f",
      } as React.CSSProperties,
  
      header: {
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap",
      } as React.CSSProperties,
  
      meta: {
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
  
      actions: {
        display: "flex",
        gap: 8,
        flexWrap: "wrap",
        marginTop: 14,
      } as React.CSSProperties,
  
      linkPanel: {
        marginTop: 14,
        padding: 12,
        borderRadius: 12,
        border: "1px solid #2a2a33",
        background: "#111118",
      } as React.CSSProperties,
  
      linkLabel: {
        margin: 0,
        color: "#a1a1aa",
        fontSize: 12,
        fontWeight: 700,
      } as React.CSSProperties,
  
      linkText: {
        margin: "6px 0 0",
        color: "#93c5fd",
        fontSize: 13,
        overflowWrap: "anywhere",
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
          color: variant === "neutral" ? "#d4d4db" : "#0b0b0f",
          fontWeight: 700,
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.55 : 1,
        }) as React.CSSProperties,
    };
  
    if (isEditing && editDraft) {
      return (
        <div style={styles.card}>
          <div style={styles.grid}>
            <label style={styles.field}>
              Series name
              <input
                type="text"
                value={editDraft.name}
                onChange={(event) =>
                  onEditDraftChange("name", event.target.value)
                }
                required
                style={styles.input}
              />
            </label>
  
            <label style={styles.field}>
              Program
              <select
                value={editDraft.programType}
                onChange={(event) =>
                  onEditDraftChange(
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
                  onEditDraftChange("level", event.target.value)
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
                  onEditDraftChange(
                    "startDate",
                    event.target.value,
                  )
                }
                required
                style={styles.input}
              />
            </label>
  
            <label style={styles.field}>
              End date
              <input
                type="date"
                value={editDraft.endDate}
                onChange={(event) =>
                  onEditDraftChange("endDate", event.target.value)
                }
                required
                style={styles.input}
              />
            </label>
          </div>
  
          <label style={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={editDraft.registrationOpen}
              onChange={(event) =>
                onEditDraftChange(
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
              onClick={onCancelEditing}
              disabled={saving}
              style={styles.button("neutral", saving)}
            >
              Cancel
            </button>
  
            <button
              type="button"
              onClick={() => onSave(item.id)}
              disabled={saving}
              style={styles.button("success", saving)}
            >
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>
        </div>
      );
    }
  
    return (
      <div style={styles.card}>
        <div style={styles.header}>
          <div>
            <strong style={{ fontSize: 18 }}>{item.name}</strong>
  
            <div style={styles.meta}>{displayProgram(item)}</div>
  
            <div style={styles.meta}>
              {item.startDate} through {item.endDate}
            </div>
          </div>
  
          <span
            style={{
              ...styles.badge,
              color: item.registrationOpen ? "#4ade80" : "#f87171",
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
  
          <span
            style={{
              ...styles.badge,
              color: registrationLinkIsActive
                ? "#4ade80"
                : item.registrationLink
                  ? "#fbbf24"
                  : "#d4d4db",
            }}
          >
            {registrationLinkIsActive
              ? "Registration link active"
              : item.registrationLink
                ? "Registration link closed"
                : "No registration link"}
          </span>
        </div>
  
        {registrationLinkIsActive && item.registrationLink ? (
          <div style={styles.linkPanel}>
            <p style={styles.linkLabel}>Public registration link</p>
  
            <p style={styles.linkText}>
              /r/{item.registrationLink.token}
            </p>
  
            <div style={styles.actions}>
              <button
                type="button"
                onClick={() => void copyRegistrationLink()}
                style={styles.button("neutral")}
              >
                Copy link
              </button>
  
              <button
                type="button"
                onClick={() => onCloseRegistrationLink(item.id)}
                style={styles.button("danger")}
              >
                Close link
              </button>
            </div>
          </div>
        ) : (
          <div style={styles.actions}>
            <button
              type="button"
              onClick={() => onGenerateRegistrationLink(item.id)}
              style={styles.button("success")}
            >
              {item.registrationLink
                ? "Reopen registration link"
                : "Generate registration link"}
            </button>
          </div>
        )}
  
        <div style={styles.actions}>
          <button
            type="button"
            onClick={() => onStartEditing(item)}
            disabled={deleting}
            style={styles.button("primary", deleting)}
          >
            Edit
          </button>
  
          <button
            type="button"
            onClick={() => onDelete(item)}
            disabled={deleting}
            style={styles.button("danger", deleting)}
          >
            {deleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    );
  }